import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Upload, FileText, FileSpreadsheet, File as FileIcon, X, Loader2, CheckCircle2, AlertCircle, ChevronRight, Settings2 } from 'lucide-react';
import { parseCSV, parseExcel, performOCR } from '../lib/dataEngine';
import { Button } from './ui/button';
import { cn, getFinancialFlags } from '../lib/utils';
import { toast } from 'sonner';
import { Workspace } from '../types';
import { db } from '../firebase';
import { collection, addDoc, getDocs, query, where, updateDoc, doc, increment, writeBatch } from 'firebase/firestore';
import { Transaction, Account } from '../types';

interface ImportToolProps {
  workspace: Workspace;
}

export function ImportTool({ workspace }: ImportToolProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parsedData, setParsedData] = useState<any[] | null>(null);
  const [ocrText, setOcrText] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setIsParsing(true);
    setParsedData(null);
    setOcrText(null);

    try {
      const extension = selectedFile.name.split('.').pop()?.toLowerCase();
      let data: any[] = [];
      
      if (extension === 'csv') {
        data = await parseCSV(selectedFile);
      } else if (extension === 'xlsx' || extension === 'xls') {
        data = await parseExcel(selectedFile);
      } else if (extension === 'pdf' || ['png', 'jpg', 'jpeg'].includes(extension || '')) {
        const text = await performOCR(selectedFile);
        setOcrText(text);
        return;
      } else {
        toast.error('Unsupported file format');
        setFile(null);
        return;
      }

      // Enrich data with Date and Time if missing
      const enrichedData = data.map(item => {
        const getFieldWithKey = (obj: any, fieldNames: string[]) => {
          if (!obj) return { value: undefined, key: undefined };
          const keys = Object.keys(obj);
          for (const name of fieldNames) {
            const key = keys.find(k => k.toLowerCase() === name.replace(/\s/g, '').toLowerCase() || k.toLowerCase() === name.toLowerCase());
            if (key) return { value: obj[key], key };
          }
          return { value: undefined, key: undefined };
        };

        const dateAliases = ['date', 'transaction date', 'created at', 'timestamp', 'day', 'date/time', 'datetime'];
        const timeAliases = ['time', 'transaction time', 'hour', 'clock', 'date/time', 'datetime'];
        const payeeAliases = ['payee', 'payer', 'payee/payer', 'contact', 'merchant', 'vendor', 'client', 'customer', 'to', 'from', 'recipient', 'sender'];
        
        const { value: rawDate, key: dateKey } = getFieldWithKey(item, dateAliases);
        const { value: rawTime, key: timeKey } = getFieldWithKey(item, timeAliases);
        const { value: rawPayee, key: payeeKey } = getFieldWithKey(item, payeeAliases);
        
        let dateVal = '';
        let timeVal = '';

        if (rawDate) {
          const str = String(rawDate);
          // If it looks like a full ISO or space-separated datetime, try to split
          if (str.includes(' ') || str.includes('T')) {
            const parts = str.split(/[ T]/);
            dateVal = parts[0];
            timeVal = parts[1] ? parts[1].split('.')[0] : ''; // Remove milliseconds if present
          } else {
            dateVal = str;
          }
        }

        if (rawTime && !timeVal) {
          const str = String(rawTime);
          if (str.includes(' ') || str.includes('T')) {
            const parts = str.split(/[ T]/);
            timeVal = parts[1] ? parts[1].split('.')[0] : parts[0];
          } else {
            timeVal = str;
          }
        }

        // Fallbacks if still empty
        if (!dateVal) dateVal = new Date().toLocaleDateString();
        if (!timeVal) timeVal = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        let payeeVal = String(rawPayee || '');
        
        // If payee is empty, try to extract from other fields (like description)
        if (!payeeVal) {
          const descAliases = ['description', 'desc', 'note', 'memo', 'details'];
          const { value: desc } = getFieldWithKey(item, descAliases);
          if (desc) {
            const strDesc = String(desc);
            const lowerDesc = strDesc.toLowerCase();
            if (lowerDesc.includes(' to ')) {
              payeeVal = strDesc.split(/ to /i)[1];
            } else if (lowerDesc.includes(' from ')) {
              payeeVal = strDesc.split(/ from /i)[1];
            } else if (lowerDesc.includes(' for ')) {
              payeeVal = strDesc.split(/ for /i)[1];
            }
          }
        }

        // Create a clean object with Date, Time, and Payee/Payer as the FIRST keys
        const newItem: any = {
          'Date': dateVal,
          'Time': timeVal,
          'Payee/Payer': payeeVal || '-',
        };

        // Add other keys, avoiding duplicates of ANY consumed keys
        const consumedKeys = new Set([dateKey, timeKey, payeeKey].filter(Boolean));
        
        Object.entries(item).forEach(([k, v]) => {
          if (!consumedKeys.has(k)) {
            newItem[k] = v;
          }
        });

        return newItem;
      });

      setParsedData(enrichedData);
    } catch (error) {
      console.error('Import Error:', error);
      toast.error('Failed to parse file');
      setFile(null);
    } finally {
      setIsParsing(false);
    }
  };

  const handleConfirm = async () => {
    if (!parsedData && !ocrText) return;
    
    try {
      setIsParsing(true);
      
      // Fetch existing transactions for this workspace to check for duplicates
      const existingSnap = await getDocs(collection(db, `workspaces/${workspace.id}/transactions`));
      const existingTransactions = existingSnap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction));

      // Fetch accounts to assign imported transactions and update balances
      const accountsSnap = await getDocs(collection(db, `workspaces/${workspace.id}/accounts`));
      const accounts = accountsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Account));
      const defaultAccount = accounts.find(a => a.isDefault) || accounts[0];

      if (!defaultAccount) {
        toast.error('No account found. Please create an account first.');
        setIsParsing(false);
        return;
      }

      const batch = writeBatch(db);
      let batchCount = 0;
      const MAX_BATCH_SIZE = 400; // Firestore limit is 500, keeping it safe

      if (parsedData) {
        // Robust field extraction with aliases
        const getField = (obj: any, mainKey: string, aliases: string[]) => {
          if (!obj) return undefined;
          // First check the normalized keys we created in handleFileChange
          const normalizedKey = Object.keys(obj).find(k => k.toLowerCase() === mainKey.toLowerCase());
          if (normalizedKey && obj[normalizedKey]) return obj[normalizedKey];
          
          // Then check aliases
          const allAliases = [mainKey, ...aliases];
          for (const alias of allAliases) {
            const key = Object.keys(obj).find(k => 
              k.toLowerCase() === alias.toLowerCase() || 
              k.toLowerCase() === alias.replace(/\s/g, '').toLowerCase()
            );
            if (key && obj[key]) return obj[key];
          }
          return undefined;
        };

        const typeAliases = ['transaction type', 'kind', 'transaction'];
        const amountAliases = ['value', 'price', 'total', 'cost', 'sum'];
        const categoryAliases = ['cat', 'group', 'classification', 'label', 'tags'];
        const descAliases = ['desc', 'note', 'memo', 'details', 'particulars'];
        const payeeAliases = ['payee', 'payer', 'payee/payer', 'contact', 'merchant', 'vendor', 'client', 'customer', 'to', 'from', 'recipient', 'sender'];

        // Map parsed data to transactions
        for (const item of parsedData) {
          // 1. Extract and Normalize Type
          let rawType = String(getField(item, 'type', typeAliases) || 'Expense');
          const validTypes = ['Income', 'Expense', 'Transfer', 'Investment'];
          let type: Transaction['type'] = 'Expense';
          
          const matchedType = validTypes.find(t => t.toLowerCase() === rawType.toLowerCase());
          if (matchedType) {
            type = matchedType as Transaction['type'];
          } else {
            // If the "type" column contains something else (like "Utilities"), it's likely the category
            type = 'Expense';
          }

          // 2. Extract and Clean Amount
          const rawAmount = String(getField(item, 'amount', amountAliases) || '0');
          const amount = Number(rawAmount.replace(/[^0-9.-]/g, '')) || 0;

          // 3. Extract Category (with fallback to rawType if it wasn't a valid transaction type)
          let category = String(getField(item, 'category', categoryAliases) || '');
          if (!category && !matchedType && rawType && rawType !== 'Expense') {
            category = rawType;
          }
          if (!category) category = 'Imported';

          // 4. Extract Date and Time (using normalized keys from handleFileChange)
          const date = String(getField(item, 'date', []) || new Date().toLocaleDateString());
          const time = String(getField(item, 'time', []) || '');

          // 5. Extract Description and Payee
          const description = String(getField(item, 'description', descAliases) || getField(item, 'note', []) || 'Imported from file');
          let payeePayer = String(getField(item, 'payee', payeeAliases) || getField(item, 'payee/payer', []) || '');

          // 6. Auto-classification
          let isLoan = false;
          let loanStatus: 'Loan' | 'Repayment' = 'Loan';
          const desc = description.toLowerCase();
          
          if (desc.includes('loan') || desc.includes('borrowed') || desc.includes('repay')) {
            isLoan = true;
            if (desc.includes('repay') || desc.includes('payment')) {
              loanStatus = 'Repayment';
            }
          }

          if (desc.includes('sale') || desc.includes('client') || desc.includes('consulting') || desc.includes('revenue')) {
            type = 'Income';
          } else if (desc.includes('salary') || desc.includes('payroll')) {
            type = 'Income';
          } else if (desc.includes('rent') || desc.includes('software') || desc.includes('aws') || desc.includes('marketing')) {
            type = 'Expense';
          } else if (desc.includes('food') || desc.includes('grocery') || desc.includes('dinner') || desc.includes('movie') || desc.includes('personal')) {
            type = 'Expense';
          } else if (desc.includes('stock') || desc.includes('crypto') || desc.includes('bitcoin') || desc.includes('real estate')) {
            type = 'Investment';
          }

          // If payee is empty, try to extract from description
          if (!payeePayer && description && description !== 'Imported from file') {
            const lowerDesc = description.toLowerCase();
            if (lowerDesc.includes(' to ')) {
              payeePayer = description.split(/ to /i)[1];
            } else if (lowerDesc.includes(' from ')) {
              payeePayer = description.split(/ from /i)[1];
            } else if (lowerDesc.includes(' for ')) {
              payeePayer = description.split(/ for /i)[1];
            }
          }

          // Check for existing transaction that matches core fields
          const existing = existingTransactions.find(t => 
            t.amount === amount && 
            t.type === type && 
            t.date === date
          );

          const flags = getFinancialFlags({ type, isLoan, loanStatus });
          const isOutflow = type === 'Expense' || type === 'Investment';
          const isInflow = type === 'Income';
          const balanceChange = isInflow ? amount : isOutflow ? -amount : 0;

          if (existing) {
            // Smart Merge: Update only missing or default fields
            const updates: any = {};
            if (!existing.time && time) updates.time = time;
            if ((!existing.description || existing.description === 'Imported from file') && description && description !== 'Imported from file') updates.description = description;
            if (!existing.payeePayer && payeePayer) updates.payeePayer = payeePayer;
            if ((!existing.category || existing.category === 'Imported') && category && category !== 'Imported') updates.category = category;
            
            // If existing didn't have an accountId, assign it and update balance
            if (!existing.accountId && defaultAccount) {
              updates.accountId = defaultAccount.id;
              batch.update(doc(db, `workspaces/${workspace.id}/accounts`, defaultAccount.id), {
                balance: increment(balanceChange)
              });
            }

            if (Object.keys(updates).length > 0) {
              batch.update(doc(db, `workspaces/${workspace.id}/transactions`, existing.id), {
                ...updates,
                updatedAt: new Date().toISOString()
              });
              batchCount++;
            }
          } else {
            // Create new transaction
            const txRef = doc(collection(db, `workspaces/${workspace.id}/transactions`));
            batch.set(txRef, {
              workspaceId: workspace.id,
              type,
              amount,
              currency: workspace.currency,
              category,
              date,
              time,
              description,
              payeePayer,
              isLoan,
              loanStatus,
              accountId: defaultAccount.id,
              ...flags,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            });
            
            batch.update(doc(db, `workspaces/${workspace.id}/accounts`, defaultAccount.id), {
              balance: increment(balanceChange)
            });
            batchCount += 2;
          }

          if (batchCount >= MAX_BATCH_SIZE) {
            await batch.commit();
            batchCount = 0;
          }
        }
      } else if (ocrText) {
        // Simple OCR to transaction (one entry)
        const txRef = doc(collection(db, `workspaces/${workspace.id}/transactions`));
        batch.set(txRef, {
          workspaceId: workspace.id,
          type: 'Expense',
          amount: 0, // Manual entry needed
          currency: workspace.currency,
          category: 'OCR Import',
          date: new Date().toISOString(),
          description: ocrText.substring(0, 100),
          accountId: defaultAccount.id,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        batchCount++;
      }

      if (batchCount > 0) {
        await batch.commit();
      }

      toast.success('Data imported successfully');
      setIsOpen(false);
      setFile(null);
      setParsedData(null);
      setOcrText(null);
    } catch (error) {
      console.error('Import Error:', error);
      toast.error('Failed to import data');
    } finally {
      setIsParsing(false);
    }
  };

  return (
    <>
      <Button 
        variant="outline" 
        onClick={() => setIsOpen(true)}
        className="rounded-2xl h-12 w-12 p-0 border-border bg-card hover:bg-accent font-bold flex items-center justify-center"
        title="Import Data"
      >
        <Upload className="h-5 w-5" />
      </Button>

      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl overflow-hidden rounded-[2.5rem] border border-border bg-card p-8 shadow-2xl"
            >
              <button
                onClick={() => setIsOpen(false)}
                className="absolute right-6 top-6 rounded-full p-2 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              >
                <X className="h-6 w-6" />
              </button>

            <div className="mb-8">
              <h2 className="text-3xl font-black tracking-tight text-foreground flex items-center gap-3">
                <Upload className="h-8 w-8 text-indigo-600" />
                Import Data
              </h2>
              <p className="mt-2 text-muted-foreground">
                Upload your CSV, Excel, or PDF files to sync your financial records.
              </p>
            </div>

            {!file ? (
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="group relative h-64 border-2 border-dashed border-border rounded-[2rem] flex flex-col items-center justify-center gap-4 hover:border-indigo-600/50 hover:bg-indigo-50/50 transition-all cursor-pointer"
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  className="hidden" 
                  accept=".csv,.xlsx,.xls,.pdf,image/*"
                />
                <div className="h-16 w-16 rounded-2xl bg-indigo-50 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Upload className="h-8 w-8 text-indigo-600" />
                </div>
                <div className="text-center">
                  <p className="font-bold text-foreground">Click to upload or drag and drop</p>
                  <p className="text-sm text-muted-foreground mt-1">CSV, XLSX, PDF, or Images</p>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="p-6 rounded-3xl border border-border bg-muted/30 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-indigo-600 flex items-center justify-center text-white">
                      {file.name.endsWith('.csv') ? <FileText className="h-6 w-6" /> : 
                       file.name.endsWith('.xlsx') ? <FileSpreadsheet className="h-6 w-6" /> : 
                       <FileIcon className="h-6 w-6" />}
                    </div>
                    <div>
                      <p className="font-bold text-foreground truncate max-w-[200px]">{file.name}</p>
                      <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(2)} KB</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setFile(null)} className="text-rose-600 hover:text-rose-700 hover:bg-rose-50">
                    Remove
                  </Button>
                </div>

                {isParsing ? (
                  <div className="h-48 flex flex-col items-center justify-center gap-4">
                    <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
                    <p className="text-muted-foreground font-medium animate-pulse">Analyzing file content...</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-foreground flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                        Preview Data
                      </h3>
                      <button 
                        onClick={() => setShowAdvanced(!showAdvanced)}
                        className="text-xs font-bold text-muted-foreground hover:text-indigo-600 flex items-center gap-1 transition-colors"
                      >
                        <Settings2 className="h-3 w-3" />
                        {showAdvanced ? 'Hide Advanced' : 'Show Advanced'}
                      </button>
                    </div>

                    <div className="max-h-64 overflow-auto rounded-2xl border border-border bg-background p-0 scrollbar-thin">
                      {parsedData ? (
                        <table className="w-full text-sm border-collapse">
                          <thead>
                            <tr className="border-b border-border bg-muted/20 sticky top-0 z-10">
                              {Object.keys(parsedData[0] || {}).map((k, idx) => (
                                <th 
                                  key={k} 
                                  className={cn(
                                    "text-left py-3 px-4 font-bold uppercase text-[10px] tracking-wider whitespace-nowrap",
                                    (k === 'Date' || k === 'Time') ? "text-indigo-600 bg-indigo-50/50" : "text-muted-foreground",
                                    idx < Object.keys(parsedData[0]).length - 1 && "border-r border-border/30"
                                  )}
                                >
                                  {k}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {parsedData.slice(0, 10).map((row, i) => (
                              <tr key={i} className="border-b border-border/50 last:border-0 hover:bg-muted/10 transition-colors">
                                {Object.entries(row).map(([k, v]: [string, any], j) => (
                                  <td 
                                    key={j} 
                                    className={cn(
                                      "py-3 px-4 text-foreground truncate max-w-[150px] whitespace-nowrap",
                                      (k === 'Date' || k === 'Time') ? "font-bold text-indigo-700 bg-indigo-50/20" : "",
                                      j < Object.keys(row).length - 1 && "border-r border-border/30"
                                    )}
                                  >
                                    {k.toLowerCase() === 'type' ? (
                                      <span className={cn(
                                        "px-2 py-0.5 rounded-full text-[10px] font-bold",
                                        String(v).toLowerCase() === 'income' ? "bg-emerald-100 text-emerald-700" :
                                        String(v).toLowerCase() === 'expense' ? "bg-rose-100 text-rose-700" :
                                        String(v).toLowerCase() === 'investment' ? "bg-purple-100 text-purple-700" :
                                        "bg-blue-100 text-blue-700"
                                      )}>
                                        {String(v)}
                                      </span>
                                    ) : k.toLowerCase() === 'amount' ? (
                                      <span className="font-mono font-bold">
                                        {typeof v === 'number' ? v.toLocaleString() : String(v)}
                                      </span>
                                    ) : String(v)}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : ocrText ? (
                        <div className="space-y-4">
                          <div className="p-4 rounded-xl bg-amber-50 border border-amber-100 flex gap-3">
                            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
                            <p className="text-xs text-amber-800 leading-relaxed">
                              OCR detected text from your document. Please confirm if this looks correct before importing.
                            </p>
                          </div>
                          <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono leading-relaxed bg-muted/50 p-4 rounded-xl">
                            {ocrText}
                          </pre>
                        </div>
                      ) : (
                        <p className="text-center text-muted-foreground py-8">No data found in file.</p>
                      )}
                    </div>

                    {showAdvanced && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="p-4 rounded-2xl border border-border bg-muted/20 space-y-3"
                      >
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Advanced Settings</p>
                        <div className="flex items-center gap-4">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" className="rounded border-border text-indigo-600 focus:ring-indigo-500" defaultChecked />
                            <span className="text-xs text-foreground">Skip duplicates</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" className="rounded border-border text-indigo-600 focus:ring-indigo-500" />
                            <span className="text-xs text-foreground">Auto-categorize</span>
                          </label>
                        </div>
                      </motion.div>
                    )}

                    <div className="flex gap-4 pt-4">
                      <Button variant="outline" onClick={() => setFile(null)} className="flex-1 h-12 rounded-xl border-border">
                        Cancel
                      </Button>
                      <Button onClick={handleConfirm} className="flex-1 h-12 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-500/20">
                        Confirm & Import
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
    </>
  );
}
