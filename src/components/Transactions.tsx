import { useEffect, useState, useMemo, useCallback } from 'react';
import { api } from '../lib/api';
import { Workspace, Transaction, TransactionType, UserProfile, Account, AllocationRule, Contact } from '../types';
import { cn, getFinancialFlags, parseLocalDate } from '../lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from './ui/dialog';
import { 
  DropdownMenu, 
  DropdownMenuTrigger, 
  DropdownMenuContent, 
  DropdownMenuItem 
} from './ui/dropdown-menu';
import { Plus, Trash2, ArrowUpRight, ArrowDownRight, ArrowLeftRight, Loader2, Download, Upload, Sparkles, Send, Pencil, X, ChevronDown, User as UserIcon } from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO, startOfMonth, endOfMonth, subDays, startOfYear, endOfYear } from 'date-fns';
import { ImportTool } from './ImportTool';
import { exportToCSV, exportToExcel, exportToPDF } from '../lib/dataEngine';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from './ui/alert-dialog';

interface TransactionsProps {
  workspace: Workspace | null;
  workspaces?: Workspace[];
  user: UserProfile | null;
  initialFilters?: any;
  transactions: Transaction[];
  contacts?: Contact[];
  accounts: Account[];
  allocationRules: AllocationRule[];
  loading: boolean;
}

export function Transactions({ 
  workspace, 
  workspaces,
  user, 
  initialFilters,
  transactions: propTransactions,
  contacts: propContacts = [],
  accounts: propAccounts,
  allocationRules: propAllocationRules,
  loading: propLoading
}: TransactionsProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (propTransactions) setTransactions(propTransactions);
    if (propAccounts) setAccounts(propAccounts);
    setLoading(propLoading);
  }, [propTransactions, propAccounts, propLoading]);
  const [isCreating, setIsCreating] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(20);

  // Filtering State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<TransactionType | 'All'>('All');
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterIsLoan, setFilterIsLoan] = useState<'All' | 'Yes' | 'No'>('All');
  const [filterPeriod, setFilterPeriod] = useState<string>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Scenario State
  const [scenario, setScenario] = useState('');
  const [isProcessingScenario, setIsProcessingScenario] = useState(false);

  // New Transaction State
  const [type, setType] = useState<TransactionType>('Income');
  const [amount, setAmount] = useState<string>('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [payeePayer, setPayeePayer] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState(new Date().toTimeString().split(' ')[0].slice(0, 5));
  const [isLoan, setIsLoan] = useState(false);
  const [loanStatus, setLoanStatus] = useState<'Loan' | 'Repayment' | ''>('');
  const [accountId, setAccountId] = useState('');
  const [targetWorkspaceId, setTargetWorkspaceId] = useState('');
  const [allocationRules, setAllocationRules] = useState<AllocationRule[]>([]);
  const [selectedTransactions, setSelectedTransactions] = useState<string[]>([]);
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);
  const [savePayeeAsContact, setSavePayeeAsContact] = useState(false);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  // Calculated suggestions for Payee/Payer
  const suggestedPayees = useMemo(() => {
    const names = new Set<string>();
    
    // 1. From saved contacts (priority)
    propContacts.forEach(c => names.add(c.name));
    
    // 2. From recent transactions
    const counts: Record<string, number> = {};
    transactions.forEach(t => {
      if (t.payeePayer?.trim()) {
        const name = t.payeePayer.trim();
        counts[name] = (counts[name] || 0) + 1;
      }
    });

    const sortedFrequent = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name);

    sortedFrequent.forEach(name => names.add(name));

    return Array.from(names);
  }, [transactions, propContacts]);

  const [payeeSearchOpen, setPayeeSearchOpen] = useState(false);
  const filteredPayees = useMemo(() => {
    if (!payeePayer.trim()) return suggestedPayees.slice(0, 10);
    return suggestedPayees
      .filter(name => name.toLowerCase().includes(payeePayer.toLowerCase()))
      .slice(0, 10);
  }, [payeePayer, suggestedPayees]);

  useEffect(() => {
    if (initialFilters) {
      if (initialFilters.type) setFilterType(initialFilters.type);
      if (initialFilters.category) setFilterCategory(initialFilters.category);
      if (initialFilters.date) {
        setStartDate(initialFilters.date);
        setEndDate(initialFilters.date);
      }
      if (initialFilters.isLoan !== undefined) setFilterIsLoan(initialFilters.isLoan ? 'Yes' : 'No');
      if (initialFilters.period) setFilterPeriod(initialFilters.period);
    }
  }, [initialFilters]);

  useEffect(() => {
    if (editingTransaction) {
      setType(editingTransaction.type as any);
      setAmount(editingTransaction.amount.toString());
      setCategory(editingTransaction.category);
      setDescription(editingTransaction.description || '');
      setPayeePayer(editingTransaction.payeePayer || '');
      setDate(editingTransaction.date);
      setTime(editingTransaction.time || '');
      setIsLoan(editingTransaction.isLoan || false);
      setLoanStatus(editingTransaction.isLoan ? (editingTransaction.loanStatus || 'Loan') : '');
      setAccountId(editingTransaction.accountId || '');
      setTargetWorkspaceId(editingTransaction.workspaceId || workspace?.id || '');
    } else {
      setType('Income');
      setAmount('');
      setCategory('');
      setDescription('');
      setPayeePayer('');
      setDate(format(new Date(), 'yyyy-MM-dd'));
      setTime(format(new Date(), 'HH:mm'));
      setIsLoan(false);
      setLoanStatus('Loan');
      setAccountId('');
      setTargetWorkspaceId(workspace?.id || '');
      
      // Set default account if available
      const defaultAcc = accounts.find(a => a.isDefault);
      if (defaultAcc) setAccountId(defaultAcc.id);
      else if (accounts.length > 0) setAccountId(accounts[0].id);
      else setAccountId('');
    }
  }, [editingTransaction, accounts, workspace]);

  const autoClassify = useCallback((desc: string) => {
    if (!desc) return;
    const d = desc.toLowerCase();
    let detectedType: TransactionType | null = null;
    let detectedLoan = false;

    if (d.includes('loan') || d.includes('borrowed') || d.includes('repay')) {
      detectedLoan = true;
    }

    if (d.includes('sale') || d.includes('client') || d.includes('consulting') || d.includes('revenue') ||
        d.includes('salary') || d.includes('payroll')) {
      detectedType = 'Income';
    } else if (d.includes('rent') || d.includes('software') || d.includes('aws') || d.includes('marketing') ||
               d.includes('food') || d.includes('grocery') || d.includes('dinner') || d.includes('movie') || d.includes('personal')) {
      detectedType = 'Expense';
    } else if (d.includes('stock') || d.includes('crypto') || d.includes('bitcoin') || d.includes('real estate')) {
      detectedType = 'Investment';
    }

    if (detectedType) setType(detectedType);
    // ponytail: Investment + loan is contradictory, skip loan flag
    if (detectedLoan && detectedType !== 'Investment') setIsLoan(true);
  }, []);

  useEffect(() => {
    if (!workspace) return;
  }, [workspace]);

  const incomeCategories = workspace.incomeCategories || ['Sales', 'Consulting', 'Investment', 'Interest', 'Rental Income', 'Gift', 'Other'];
  const expenseCategories = workspace.expenseCategories || ['Rent', 'Software', 'Marketing', 'Salary', 'Utilities', 'Travel', 'Supplies', 'Insurance', 'Taxes', 'Maintenance', 'Entertainment', 'Food & Dining', 'Transportation', 'Other'];
  const investmentCategories = workspace.investmentCategories || ['Stocks', 'Crypto', 'Real Estate', 'Bonds', 'Mutual Funds', 'Other'];

  useEffect(() => {
    // When type changes, if the current category is not in the new type's categories, reset it
    if (type === 'Income') {
      if (!incomeCategories.includes(category)) setCategory('');
    } else if (type === 'Expense') {
      if (!expenseCategories.includes(category)) setCategory('');
    } else if (type === 'Investment') {
      if (!investmentCategories.includes(category)) setCategory('');
    } else if (type === 'Transfer') {
      setCategory('Transfer');
    }
  }, [type, incomeCategories, expenseCategories, investmentCategories]);

  const createTransaction = async () => {
    if (!workspace) return;
    
    const amountNum = Number(amount);
    if (!amountNum || amountNum === 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    
    if (!category) {
      toast.error('Please select a category');
      return;
    }

    if (!accountId) {
      toast.error('Please select an account');
      return;
    }

    try {
      const flags = getFinancialFlags({ type, isLoan });
      
      const transactionData: Record<string, any> = {
        id: editingTransaction ? editingTransaction.id : (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2)),
        workspaceId: targetWorkspaceId || workspace.id,
        type,
        amount: amountNum,
        currency: workspace.currency,
        category,
        date,
        time,
        description,
        payeePayer,
        isLoan,
        accountId,
        ...flags,
        savePayeeAsContact // Handled on backend
      };
      if (isLoan) transactionData.loanStatus = loanStatus;

      if (editingTransaction) {
        if (targetWorkspaceId && targetWorkspaceId !== workspace.id) {
          // Copy & Delete fallback to move to a new workspace safely
          // Note: We don't prompt for a new account here, so it might use an invalid accountId in the new workspace
          // until the user edits it there. For a true fix, we'd need them to select the target account.
          const moveData = {
            ...transactionData,
            id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2),
            workspaceId: targetWorkspaceId
          };
          await api.createTransaction(targetWorkspaceId, moveData);
          await api.deleteTransaction(workspace.id, editingTransaction.id);
          toast.success('Transaction moved to new workspace');
        } else {
          await api.updateTransaction(workspace.id, editingTransaction.id, transactionData);
          toast.success('Transaction updated');
        }
      } else {
        await api.createTransaction(workspace.id, transactionData);
        toast.success('Transaction recorded');
      }
      
      setAmount('');
      setCategory('');
      setDescription('');
      setPayeePayer('');
      setSavePayeeAsContact(false);
      setIsCreating(false);
      setEditingTransaction(null);
      window.dispatchEvent(new CustomEvent('refresh-data'));
    } catch (error) {
      console.error('Error saving transaction:', error);
      toast.error(editingTransaction ? 'Failed to update transaction' : 'Failed to record transaction');
    }
  };

  const deleteTransaction = async (id: string) => {
    if (!workspace) return;
    const loadingToast = toast.loading('Deleting transaction and syncing accounts...');

    try {
      await api.deleteTransaction(workspace.id, id);
      toast.dismiss(loadingToast);
      toast.success('Transaction deleted');
      window.dispatchEvent(new CustomEvent('refresh-data'));
    } catch (error: any) {
      console.error('Delete transaction failed:', error);
      toast.dismiss(loadingToast);
      toast.error('Failed to delete transaction');
    }
  };

  const bulkDeleteTransactions = async () => {
    if (!workspace || selectedTransactions.length === 0) return;

    setIsDeletingBulk(true);
    try {
      for (const id of selectedTransactions) {
        await api.deleteTransaction(workspace.id, id);
      }
      setSelectedTransactions([]);
      toast.success(`${selectedTransactions.length} transactions deleted`);
      window.dispatchEvent(new CustomEvent('refresh-data'));
    } catch (error) {
      console.error('Error bulk deleting transactions:', error);
      toast.error('Failed to delete transactions');
    } finally {
      setIsDeletingBulk(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedTransactions.length === paginatedTransactions.length) {
      setSelectedTransactions([]);
    } else {
      setSelectedTransactions(paginatedTransactions.map(t => t.id));
    }
  };

  const toggleSelectTransaction = (id: string) => {
    setSelectedTransactions(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const formatTransactionDate = (dateStr: string, tTime?: string) => {
    try {
      const date = parseLocalDate(dateStr);
      if (isNaN(date.getTime())) return dateStr || 'N/A';
      
      const dateFormat = user?.preferences?.dateFormat || 'MMM d, yyyy';
      const showTime = user?.preferences?.transactionFields?.showTime !== false;
      
      if (showTime && tTime) {
        let displayTime = tTime;
        if (user?.preferences?.timeFormat === '12h') {
          const [hours, minutes] = tTime.split(':');
          const h = parseInt(hours);
          const ampm = h >= 12 ? 'PM' : 'AM';
          const h12 = h % 12 || 12;
          displayTime = `${h12}:${minutes} ${ampm}`;
        }
        return `${format(date, dateFormat)} • ${displayTime}`;
      }
      return format(date, dateFormat);
    } catch (e) {
      return dateStr || 'N/A';
    }
  };

  const filteredTransactions = useMemo(() => transactions.filter(t => {
    const matchesSearch = t.description.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         t.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (t.payeePayer || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === 'All' || t.type === filterType;
    const matchesCategory = filterCategory === 'All' || t.category === filterCategory;
    const matchesIsLoan = filterIsLoan === 'All' || (filterIsLoan === 'Yes' ? t.isLoan : !t.isLoan);
    
    const tDate = parseLocalDate(t.date);
    if (isNaN(tDate.getTime())) return false;
    
    const matchesStart = !startDate || tDate >= parseLocalDate(startDate);
    const matchesEnd = !endDate || tDate <= parseLocalDate(endDate);

    return matchesSearch && matchesType && matchesCategory && matchesIsLoan && matchesStart && matchesEnd;
  }), [transactions, searchQuery, filterType, filterCategory, filterIsLoan, startDate, endDate]);

  const sortedTransactions = useMemo(() => 
    [...filteredTransactions].sort((a, b) => {
      const timeA = a.time || '00:00';
      const timeB = b.time || '00:00';
      const datetimeA = `${a.date}T${timeA}`;
      const datetimeB = `${b.date}T${timeB}`;
      
      if (sortOrder === 'desc') {
        return datetimeB.localeCompare(datetimeA) || (b.createdAt || '').localeCompare(a.createdAt || '');
      } else {
        return datetimeA.localeCompare(datetimeB) || (a.createdAt || '').localeCompare(b.createdAt || '');
      }
    }),
    [filteredTransactions, sortOrder]
  );

  // Pagination Logic
  const totalPages = Math.ceil(sortedTransactions.length / rowsPerPage);
  const paginatedTransactions = sortedTransactions.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  useEffect(() => {
    if (filterPeriod === 'all') {
      setStartDate('');
      setEndDate('');
      return;
    }

    const now = new Date();
    let start: Date;
    let end: Date = now;

    switch (filterPeriod) {
      case 'this-month':
        start = startOfMonth(now);
        end = endOfMonth(now);
        break;
      case 'last-month':
        const lastMonth = subDays(startOfMonth(now), 1);
        start = startOfMonth(lastMonth);
        end = endOfMonth(lastMonth);
        break;
      case 'this-year':
        start = startOfYear(now);
        end = endOfYear(now);
        break;
      case 'last-30-days':
        start = subDays(now, 30);
        break;
      default:
        return;
    }

    setStartDate(format(start, 'yyyy-MM-dd'));
    setEndDate(format(end, 'yyyy-MM-dd'));
  }, [filterPeriod]);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterType, filterCategory, filterIsLoan, startDate, endDate]);

  const handleExport = async (formatType: 'csv' | 'excel' | 'pdf') => {
    if (!workspace) return;
    
    const loadingToast = toast.loading(`Preparing full database export (${formatType.toUpperCase()})...`);
    
    try {
      // Fetch ALL transactions for the workspace to ensure "all data at once"
      const allTx = await api.getTransactions(workspace.id);
      allTx.sort((a: any, b: any) => b.date.localeCompare(a.date));
      
      // Filter the full dataset manually to match current UI filters
      const dataToExport = allTx.filter(t => {
        const matchesSearch = t.description.toLowerCase().includes(searchQuery.toLowerCase()) || 
                             t.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
                             (t.payeePayer || '').toLowerCase().includes(searchQuery.toLowerCase());
        const matchesType = filterType === 'All' || t.type === filterType;
        const matchesCategory = filterCategory === 'All' || t.category === filterCategory;
        const matchesIsLoan = filterIsLoan === 'All' || (filterIsLoan === 'Yes' ? t.isLoan : !t.isLoan);
        
        const tDate = parseLocalDate(t.date);
        if (isNaN(tDate.getTime())) return false;
        
        const matchesStart = !startDate || tDate >= parseLocalDate(startDate);
        const matchesEnd = !endDate || tDate <= parseLocalDate(endDate);

        return matchesSearch && matchesType && matchesCategory && matchesIsLoan && matchesStart && matchesEnd;
      });

      if (dataToExport.length === 0) {
        toast.dismiss(loadingToast);
        toast.error('No data to export with current filters');
        return;
      }

      const formattedData = dataToExport.map(t => {
        let displayDate = t.date;
        try {
          const d = parseLocalDate(t.date);
          if (!isNaN(d.getTime())) displayDate = format(d, 'MMM d, yyyy');
        } catch (e) {}
        
        return {
          'Date': displayDate,
          'Type': t.type,
          'Amount': t.amount,
          'Currency': t.currency,
          'Category': t.category,
          'Payee/Payer': t.payeePayer || '-',
          'Description': t.description
        };
      });

      const filename = `transactions_full_export_${format(new Date(), 'yyyy-MM-dd')}`;

      if (formatType === 'csv') exportToCSV(formattedData, filename);
      else if (formatType === 'excel') exportToExcel(formattedData, filename);
      else exportToPDF(formattedData, filename, 'Transactions Full Report');
      
      toast.dismiss(loadingToast);
      toast.success(`Export of ${formattedData.length} records completed`);
    } catch (error) {
      console.error('Export failed:', error);
      toast.dismiss(loadingToast);
      toast.error('Failed to retrieve full history. Please check your connection.');
    }
  };

  const handleScenarioSubmit = () => {
    if (!scenario.trim()) return;
    
    toast.success("Scenario Sent!", {
      description: <span className="text-slate-700 font-medium">Izy is processing your transaction details now.</span>,
      icon: <Sparkles className="h-4 w-4 text-blue-600" />,
      className: "bg-white border-2 border-blue-600 text-slate-900 font-bold shadow-2xl",
    });
    
    setScenario('');
    window.dispatchEvent(new CustomEvent('open-izy-with-scenario', { detail: scenario }));
  };

  if (!workspace) return null;

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-foreground">Transactions</h1>
          <p className="text-sm md:text-base text-muted-foreground font-medium">
            Track every penny moving in and out.{' '}
            {transactions.length >= 5000 && (
              <span className="text-blue-500 font-bold ml-2"> Showing latest 5000 items.</span>
            )}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Quick Scenario Input */}
          <div className="relative group flex-1 md:min-w-[300px]">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
            <div className="relative flex items-center bg-card border border-border rounded-2xl p-1 shadow-sm">
              <div className="pl-3 text-blue-600">
                <Sparkles className="h-4 w-4" />
              </div>
              <input 
                type="text" 
                placeholder="Describe a scenario..." 
                value={scenario}
                onChange={(e) => setScenario(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleScenarioSubmit()}
                className="flex-1 bg-transparent border-none focus:ring-0 text-sm px-3 h-10 outline-none"
              />
              <Button 
                size="sm" 
                onClick={handleScenarioSubmit}
                className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white h-9 w-9 p-0"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button 
                  variant="outline" 
                  size="icon"
                  className="rounded-2xl h-12 w-12 border-border bg-card hover:bg-accent font-bold flex items-center justify-center"
                  title="Export Data"
                >
                  <Download className="h-5 w-5" />
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="rounded-xl p-2 w-32">
              <DropdownMenuItem onClick={() => handleExport('csv')} className="rounded-lg font-medium">CSV</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('excel')} className="rounded-lg font-medium">Excel</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('pdf')} className="rounded-lg font-medium">PDF</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="flex items-center gap-3">
            {selectedTransactions.length > 0 && (
              <AlertDialog>
                <AlertDialogTrigger render={
                  <Button 
                    variant="destructive" 
                    size="sm"
                    disabled={isDeletingBulk}
                    className="rounded-xl h-12 px-4 font-bold flex items-center gap-2 animate-in fade-in slide-in-from-right-4"
                  >
                    {isDeletingBulk ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    <span>Delete ({selectedTransactions.length})</span>
                  </Button>
                } />
                <AlertDialogContent className="rounded-3xl border-2 border-rose-100 shadow-2xl">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-2xl font-black text-slate-900">Delete {selectedTransactions.length} Transactions?</AlertDialogTitle>
                    <AlertDialogDescription className="text-slate-600 font-medium leading-relaxed">
                      This will permanently remove these transactions and reverse their account balances. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter className="gap-3 sm:gap-0 mt-4">
                    <AlertDialogCancel render={<Button variant="outline" className="rounded-2xl border-2 border-slate-200 font-bold hover:bg-slate-50 transition-all" />}>Go Back</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={bulkDeleteTransactions} 
                      className="rounded-2xl bg-rose-600 hover:bg-rose-700 font-bold shadow-lg shadow-rose-200 transition-all active:scale-95"
                    >
                      Yes, Delete All
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <div className="flex-1 sm:flex-none">
              <ImportTool workspace={workspace} />
            </div>
            
            <Dialog open={isCreating || !!editingTransaction} onOpenChange={(open) => {
              if (!open) {
                setIsCreating(false);
                setEditingTransaction(null);
              }
            }}>
              <DialogTrigger render={
                <Button 
                  onClick={() => setIsCreating(true)}
                  className="flex-1 sm:flex-none rounded-2xl h-12 px-6 bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20 font-bold flex items-center gap-2"
                >
                  <Plus className="h-5 w-5" />
                  <span className="inline">Record</span>
                  <span className="hidden sm:inline">Transaction</span>
                </Button>
              } />
              <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto rounded-[2.5rem] border-border bg-card shadow-2xl">
              <DialogHeader className="relative flex flex-row items-center justify-between">
                <DialogTitle className="text-2xl font-black pr-8">{editingTransaction ? 'Edit Transaction' : 'Record Financial Activity'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-6 py-4" onKeyDown={(e) => e.key === 'Enter' && createTransaction()}>
                <div className="space-y-2">
                  <Label className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Type</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-1 bg-muted rounded-xl">
                    {['Income', 'Expense', 'Investment'].map((t) => (
                      <Button
                        key={t}
                        variant={type === t ? 'default' : 'ghost'}
                        onClick={() => setType(t as any)}
                        className={cn(
                          "rounded-lg font-bold h-10 text-xs sm:text-sm transition-all",
                          type === t ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:bg-background/50"
                        )}
                      >
                        {t}
                      </Button>
                    ))}
                  </div>
                </div>
                {type !== 'Investment' && (<>
                  <div className="space-y-2">
                    <Label className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Is this a Loan?</Label>
                    <div className="flex items-center h-12 gap-2">
                        <input 
                          type="checkbox" 
                          id="isLoan"
                          checked={isLoan}
                          onChange={(e) => setIsLoan(e.target.checked)}
                          className="h-5 w-5 rounded border-border text-blue-600 focus:ring-blue-500"
                        />
                        <Label htmlFor="isLoan" className="text-sm font-medium cursor-pointer">Yes, it's a loan</Label>
                      </div>
                    </div>
                    {isLoan && (
                      <div className="space-y-2">
                        <Label className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Loan Type</Label>
                        <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-xl border border-border">
                          {['Loan', 'Repayment'].map((s) => (
                            <Button
                              key={s}
                              type="button"
                              variant={loanStatus === s ? 'default' : 'ghost'}
                              onClick={() => setLoanStatus(s as any)}
                              className={cn(
                                "flex-1 rounded-lg font-bold h-10 text-xs transition-all",
                                loanStatus === s ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:bg-background/50"
                              )}
                            >
                              {s}
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Amount</Label>
                    <Input 
                      type="number" 
                      placeholder="0.00" 
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="h-12 rounded-xl border-border bg-background"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Date</Label>
                    <Input 
                      type="date" 
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="h-12 rounded-xl border-border bg-background"
                    />
                    <p className="text-[10px] text-muted-foreground font-medium px-1">
                      Selected: <span className="text-blue-600 font-bold">{formatTransactionDate(date)}</span>
                    </p>
                  </div>
                  {(user?.preferences?.transactionFields?.showTime !== false || !!editingTransaction) && (
                    <div className="space-y-2 sm:col-span-2 md:col-span-1">
                      <Label className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Time</Label>
                      <Input 
                        type="time" 
                        value={time}
                        onChange={(e) => setTime(e.target.value)}
                        className="h-12 rounded-xl border-border bg-background"
                      />
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Account</Label>
                  <select 
                    className="w-full rounded-xl border border-border bg-background px-3 h-12 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                  >
                    <option value="">Select Account</option>
                    {type === 'Income' && allocationRules.length > 0 && (
                      <option value="auto-allocate">✨ Auto-allocate (Revenue Splitter)</option>
                    )}
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.id}>{acc.name}</option>
                    ))}
                  </select>
                </div>
                  
                  {editingTransaction && workspaces && workspaces.length > 1 && (
                    <div className="space-y-2">
                      <Label className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Workspace (Move)</Label>
                      <select 
                        className="w-full rounded-xl border border-border bg-background px-3 h-12 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                        value={targetWorkspaceId}
                        onChange={(e) => setTargetWorkspaceId(e.target.value)}
                      >
                        {workspaces.map(ws => (
                          <option key={ws.id} value={ws.id}>{ws.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                  <Label className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Category</Label>
                  <select 
                    className="w-full rounded-xl border border-border bg-background px-3 h-12 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    <option value="">Select Category</option>
                    {type === 'Income' ? (
                      (incomeCategories).map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))
                    ) : type === 'Expense' ? (
                      (expenseCategories).map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))
                    ) : type === 'Investment' ? (
                      (investmentCategories).map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))
                    ) : (
                      <option value="Transfer">Transfer</option>
                    )}
                  </select>
                </div>
                {(user?.preferences?.transactionFields?.showPayeePayer !== false || !!editingTransaction) && (
                  <div className="space-y-2 relative">
                    <Label className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Payee / Payer</Label>
                    <div className="relative">
                      <Input 
                        placeholder="e.g. Total Energies, John Doe..." 
                        value={payeePayer}
                        onChange={(e) => {
                          setPayeePayer(e.target.value);
                          setPayeeSearchOpen(true);
                        }}
                        onFocus={() => setPayeeSearchOpen(true)}
                        onBlur={() => setTimeout(() => setPayeeSearchOpen(false), 200)}
                        className="h-12 rounded-xl border-border bg-background"
                      />
                      {payeeSearchOpen && filteredPayees.length > 0 && (
                        <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-xl shadow-xl max-h-48 overflow-y-auto overflow-x-hidden p-1">
                          <div className="px-2 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                            <Sparkles className="h-3 w-3 text-blue-500" />
                            Suggestions
                          </div>
                          {filteredPayees.map((name) => {
                            const isSaved = propContacts.some(c => c.name === name);
                            return (
                              <button
                                key={name}
                                type="button"
                                onClick={() => {
                                  setPayeePayer(name);
                                  setPayeeSearchOpen(false);
                                }}
                                className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-accent hover:text-accent-foreground transition-colors flex items-center justify-between group"
                              >
                                <div className="flex items-center gap-2">
                                  {isSaved && <UserIcon className="h-3 w-3 text-blue-500" />}
                                  <span className="font-medium">{name}</span>
                                </div>
                                <Plus className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    {payeePayer.trim() && !propContacts.some(c => c.name.toLowerCase() === payeePayer.toLowerCase().trim()) && (
                      <div className="flex items-center gap-2 px-1">
                        <input 
                          type="checkbox" 
                          id="saveContact" 
                          checked={savePayeeAsContact} 
                          onChange={(e) => setSavePayeeAsContact(e.target.checked)}
                          className="h-4 w-4 rounded border-border text-blue-600 focus:ring-blue-500"
                        />
                        <Label htmlFor="saveContact" className="text-[10px] font-bold text-muted-foreground uppercase cursor-pointer hover:text-foreground transition-colors">
                          Save as frequent contact
                        </Label>
                      </div>
                    )}
                  </div>
                )}
                {(user?.preferences?.transactionFields?.showDescription !== false || !!editingTransaction) && (
                  <div className="space-y-2">
                    <Label className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Description</Label>
                    <Input 
                      placeholder="Optional details..." 
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      onBlur={(e) => autoClassify(e.target.value)}
                      className="h-12 rounded-xl border-border bg-background"
                    />
                  </div>
                )}
              <DialogFooter>
                <Button variant="outline" onClick={() => {
                  setIsCreating(false);
                  setEditingTransaction(null);
                }} className="rounded-xl h-12 px-6">Cancel</Button>
                <Button onClick={createTransaction} className="rounded-xl h-12 px-8 bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20 font-bold">
                  {editingTransaction ? 'Update Transaction' : 'Save Transaction'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>

    {/* Filtering UI */}
      <div className="space-y-4 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-8 gap-4 bg-card/30 p-4 rounded-2xl border border-border/50">
          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider ml-1">Search</Label>
            <Input 
              placeholder="Search description..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-10 rounded-xl border-border bg-background/50"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider ml-1">Type</Label>
            <select 
              className="w-full rounded-xl border border-border bg-background/50 px-3 h-10 text-sm focus:outline-none"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
            >
              <option value="All">All Types</option>
              <option value="Income">Income</option>
              <option value="Expense">Expense</option>
              <option value="Investment">Investment</option>
              <option value="Transfer">Transfer</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider ml-1">Category</Label>
            <select 
              className="w-full rounded-xl border border-border bg-background/50 px-3 h-10 text-sm focus:outline-none"
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
            >
              <option value="All">All Categories</option>
              {filterType === 'Income' ? (
                incomeCategories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))
              ) : filterType === 'Expense' ? (
                expenseCategories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))
              ) : filterType === 'Investment' ? (
                investmentCategories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))
              ) : filterType === 'Transfer' ? (
                <option value="Transfer">Transfer</option>
              ) : (
                [...new Set([...incomeCategories, ...expenseCategories, ...investmentCategories, 'Transfer'])].sort().map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))
              )}
            </select>
          </div>
          {filterType !== 'Investment' && (
          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider ml-1">Is Loan?</Label>
            <select 
              className="w-full rounded-xl border border-border bg-background/50 px-3 h-10 text-sm focus:outline-none"
              value={filterIsLoan}
              onChange={(e) => setFilterIsLoan(e.target.value as any)}
            >
              <option value="All">All</option>
              <option value="Yes">Yes (Loan)</option>
              <option value="No">No (Normal)</option>
            </select>
          </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider ml-1">Period</Label>
            <select 
              className="w-full rounded-xl border border-border bg-background/50 px-3 h-10 text-sm focus:outline-none"
              value={filterPeriod}
              onChange={(e) => setFilterPeriod(e.target.value)}
            >
              <option value="all">All Time</option>
              <option value="this-month">This Month</option>
              <option value="last-month">Last Month</option>
              <option value="this-year">This Year</option>
              <option value="last-30-days">Last 30 Days</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider ml-1">Start Date</Label>
            <Input 
              type="date" 
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-10 rounded-xl border-border bg-background/50"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider ml-1">End Date</Label>
            <Input 
              type="date" 
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-10 rounded-xl border-border bg-background/50"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider ml-1">Sort</Label>
            <select 
              className="w-full rounded-xl border border-border bg-background/50 px-3 h-10 text-sm focus:outline-none"
              value={sortOrder}
              onChange={(e) => { setSortOrder(e.target.value as 'desc' | 'asc'); setCurrentPage(1); }}
            >
              <option value="desc">Newest First</option>
              <option value="asc">Oldest First</option>
            </select>
          </div>
        </div>

        {/* Summary of Filtered Transactions */}
        <div className="flex flex-wrap gap-4">
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl px-4 py-2 flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <ArrowUpRight className="h-4 w-4 text-emerald-600" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Real Income</p>
              <p className="text-sm font-black text-emerald-700">
                {workspace.currency} {filteredTransactions.filter(t => t.type === 'Income' && !t.isLoan).reduce((sum, t) => sum + (t.amount || 0), 0).toLocaleString()}
              </p>
            </div>
          </div>
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl px-4 py-2 flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-blue-500/20 flex items-center justify-center">
              <Plus className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Loans Received</p>
              <p className="text-sm font-black text-blue-700">
                {workspace.currency} {filteredTransactions.filter(t => t.type === 'Income' && t.isLoan && t.loanStatus === 'Loan').reduce((sum, t) => sum + (t.amount || 0), 0).toLocaleString()}
              </p>
            </div>
          </div>
          <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl px-4 py-2 flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-rose-500/20 flex items-center justify-center">
              <ArrowDownRight className="h-4 w-4 text-rose-600" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-rose-600 uppercase tracking-wider">Total Spending</p>
              <p className="text-sm font-black text-rose-700">
                {workspace.currency} {filteredTransactions.filter(t => t.type === 'Expense' && !t.isLoan).reduce((sum, t) => sum + (t.amount || 0), 0).toLocaleString()}
              </p>
            </div>
          </div>
          <div className="bg-purple-500/10 border border-purple-500/20 rounded-2xl px-4 py-2 flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-purple-500/20 flex items-center justify-center">
              <ArrowUpRight className="h-4 w-4 text-purple-600" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-purple-600 uppercase tracking-wider">Investments</p>
              <p className="text-sm font-black text-purple-700">
                {workspace.currency} {filteredTransactions.filter(t => t.type === 'Investment').reduce((sum, t) => sum + (t.amount || 0), 0).toLocaleString()}
              </p>
            </div>
          </div>
          <div className="bg-slate-500/10 border border-slate-500/20 rounded-2xl px-4 py-2 flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-slate-500/20 flex items-center justify-center">
              <ArrowLeftRight className="h-4 w-4 text-slate-600" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Net Cash Flow</p>
              <p className="text-sm font-black text-slate-700">
                {workspace.currency} {(
                  filteredTransactions.filter(t => t.type === 'Income').reduce((sum, t) => sum + (t.amount || 0), 0) - 
                  filteredTransactions.filter(t => t.type === 'Expense').reduce((sum, t) => sum + (t.amount || 0), 0)
                ).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block">
        <Card className="border-border bg-card/50 shadow-xl backdrop-blur-xl overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="w-[40px]">
                      <input 
                        type="checkbox" 
                        className="h-4 w-4 rounded border-border text-blue-600 focus:ring-blue-500"
                        checked={paginatedTransactions.length > 0 && selectedTransactions.length === paginatedTransactions.length}
                        onChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead className="text-muted-foreground">Date</TableHead>
                    <TableHead className="text-muted-foreground">Type</TableHead>
                    <TableHead className="text-muted-foreground">Category</TableHead>
                    {user?.preferences?.transactionFields?.showPayeePayer !== false && (
                      <TableHead className="text-muted-foreground">Payee/Payer</TableHead>
                    )}
                    {user?.preferences?.transactionFields?.showDescription !== false && (
                      <TableHead className="text-muted-foreground">Description</TableHead>
                    )}
                    <TableHead className="text-muted-foreground text-right">Amount</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedTransactions.map((t) => (
                    <TableRow key={t.id} className={cn("border-border hover:bg-accent/50", selectedTransactions.includes(t.id) && "bg-accent/30")}>
                      <TableCell>
                        <input 
                          type="checkbox" 
                          className="h-4 w-4 rounded border-border text-blue-600 focus:ring-blue-500"
                          checked={selectedTransactions.includes(t.id)}
                          onChange={() => toggleSelectTransaction(t.id)}
                        />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatTransactionDate(t.date, t.time)}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant="outline" 
                          className={cn(
                            "text-[10px] uppercase tracking-wider",
                            t.isLoan ? (t.type === 'Income' ? "border-blue-500/50 text-blue-500 bg-blue-500/5" : "border-rose-500/50 text-rose-500 bg-rose-500/5") :
                            t.type === 'Income' ? "border-emerald-500/50 text-emerald-500" : 
                            t.type === 'Expense' ? "border-rose-500/50 text-rose-500" : 
                            t.type === 'Investment' ? "border-purple-500/50 text-purple-500 bg-purple-500/5" :
                            "border-border text-muted-foreground"
                          )}
                        >
                          {t.isLoan ? (t.loanStatus === 'Repayment' ? 'Repayment' : 'Loan') : t.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium text-foreground">{t.category}</TableCell>
                      {user?.preferences?.transactionFields?.showPayeePayer !== false && (
                        <TableCell className="text-foreground font-semibold">{t.payeePayer || '-'}</TableCell>
                      )}
                      {user?.preferences?.transactionFields?.showDescription !== false && (
                        <TableCell className="text-muted-foreground truncate max-w-[200px]">{t.description || '-'}</TableCell>
                      )}
                      <TableCell className="text-right font-bold text-foreground">
                        {workspace.currency} {t.amount.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => setEditingTransaction(t)}
                            className="text-muted-foreground hover:text-blue-600"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger render={
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="text-muted-foreground hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            } />
                            <AlertDialogContent className="rounded-3xl border-2 border-rose-100 shadow-2xl">
                              <AlertDialogHeader>
                                <AlertDialogTitle className="text-2xl font-black text-slate-900">Delete Transaction?</AlertDialogTitle>
                                <AlertDialogDescription className="text-slate-600 font-medium leading-relaxed">
                                  This will permanently remove this transaction from your records and reverse the balance in your {t.accountId === 'auto-allocate' ? 'allocated accounts' : 'account'}.
                                  {t.invoiceId && (
                                    <span className="block mt-2 font-bold text-rose-600 italic">Note: This will also update the linked invoice status.</span>
                                  )}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter className="gap-3 sm:gap-0 mt-4">
                                <AlertDialogCancel render={<Button variant="outline" className="rounded-2xl border-2 border-slate-200 font-bold hover:bg-slate-50 transition-all" />}>Go Back</AlertDialogCancel>
                                <AlertDialogAction 
                                  onClick={() => deleteTransaction(t.id)} 
                                  className="rounded-2xl bg-rose-600 hover:bg-rose-700 font-bold shadow-lg shadow-rose-200 transition-all active:scale-95"
                                >
                                  Yes, Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredTransactions.length === 0 && !loading && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-20">
                        No transactions found matching your filters.
                      </TableCell>
                    </TableRow>
                  )}
                  {loading && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-20">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-4">
        {paginatedTransactions.map((t) => (
          <Card key={t.id} className={cn("border-border bg-card/50 shadow-sm backdrop-blur-xl transition-all", selectedTransactions.includes(t.id) && "border-blue-500/50 bg-blue-500/5 shadow-md")}>
            <CardContent className="p-4">
              <div className="grid grid-cols-[auto_1fr_auto] gap-4 items-start mb-3">
                <div className="pt-1">
                  <input 
                    type="checkbox" 
                    className="h-5 w-5 rounded border-border text-blue-600 focus:ring-blue-500"
                    checked={selectedTransactions.includes(t.id)}
                    onChange={() => toggleSelectTransaction(t.id)}
                  />
                </div>
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge 
                      variant="outline" 
                      className={cn(
                        "text-[10px] uppercase tracking-wider whitespace-nowrap",
                        t.type === 'Income' ? "border-emerald-500/50 text-emerald-500 bg-emerald-500/5" : 
                        t.type === 'Expense' ? "border-rose-500/50 text-rose-500 bg-rose-500/5" : 
                        t.type === 'Investment' ? "border-purple-500/50 text-purple-500 bg-purple-500/5" :
                        "border-slate-500/50 text-slate-500 bg-slate-500/5"
                      )}
                    >
                      {t.type}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {formatTransactionDate(t.date, t.time)}
                    </span>
                  </div>
                  <h3 className="font-bold text-foreground truncate">{t.category}</h3>
                  {t.payeePayer && <p className="text-xs font-semibold text-purple-600 truncate">{t.payeePayer}</p>}
                </div>
                <div className="text-right shrink-0">
                  <p className="font-black text-lg text-foreground whitespace-nowrap">
                    {workspace.currency} {t.amount.toLocaleString()}
                  </p>
                  <div className="flex items-center justify-end gap-1 mt-1">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => setEditingTransaction(t)}
                      className="h-8 w-8 text-muted-foreground hover:text-blue-600"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger render={
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      } />
                      <AlertDialogContent className="rounded-3xl border-2 border-rose-100 shadow-2xl">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-2xl font-black text-slate-900">Delete Transaction?</AlertDialogTitle>
                          <AlertDialogDescription className="text-slate-600 font-medium leading-relaxed">
                            This will permanently remove this transaction and reverse the balance.
                            {t.invoiceId && (
                              <span className="block mt-2 font-bold text-rose-600 italic">This affects Invoice #{t.invoiceId.slice(-6).toUpperCase()}.</span>
                            )}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="gap-3 sm:gap-0 mt-4">
                          <AlertDialogCancel render={<Button variant="outline" className="rounded-2xl border-2 border-slate-200 font-bold" />}>Go Back</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={() => deleteTransaction(t.id)} 
                            className="rounded-2xl bg-rose-600 hover:bg-rose-700 font-bold"
                          >
                            Yes, Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </div>
              {t.description && (
                <p className="text-sm text-muted-foreground border-t border-border/50 pt-2 mt-2 italic line-clamp-2">
                  {t.description}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
        {filteredTransactions.length === 0 && !loading && (
          <div className="text-center text-muted-foreground py-10 bg-card/30 rounded-2xl border border-dashed border-border">
            No transactions found.
          </div>
        )}
        {loading && (
          <div className="flex justify-center py-10">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {filteredTransactions.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 bg-card/30 p-4 rounded-2xl border border-border/50">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Rows per page:</span>
              <select 
                value={rowsPerPage}
                onChange={(e) => setRowsPerPage(Number(e.target.value))}
                className="bg-background border border-border rounded-lg px-2 py-1 text-xs font-bold focus:outline-none"
              >
                {[20, 50, 100].map(size => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
            </div>
            <span className="text-xs font-bold text-muted-foreground">
              Showing {(currentPage - 1) * rowsPerPage + 1} - {Math.min(currentPage * rowsPerPage, filteredTransactions.length)} of {filteredTransactions.length}
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => prev - 1)}
              className="rounded-xl h-9 px-4 font-bold text-xs"
            >
              Previous
            </Button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum = i + 1;
                if (totalPages > 5 && currentPage > 3) {
                  pageNum = currentPage - 2 + i;
                  if (pageNum > totalPages) pageNum = totalPages - (4 - i);
                }
                if (pageNum <= totalPages) {
                  return (
                    <Button
                      key={pageNum}
                      variant={currentPage === pageNum ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setCurrentPage(pageNum)}
                      className={cn(
                        "h-9 w-9 rounded-xl font-bold text-xs",
                        currentPage === pageNum ? "bg-blue-600 text-white" : ""
                      )}
                    >
                      {pageNum}
                    </Button>
                  );
                }
                return null;
              })}
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(prev => prev + 1)}
              className="rounded-xl h-9 px-4 font-bold text-xs"
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
