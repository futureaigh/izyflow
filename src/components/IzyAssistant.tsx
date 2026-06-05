import { useState, useEffect, useRef } from 'react';
import { Type } from "@google/genai";
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { api } from '../lib/api';
import { X, Send, Bot, User, Loader2, MessageSquare, Sparkles, Check, AlertCircle, PieChart as ChartIcon, TrendingUp, TrendingDown, DollarSign, Download } from 'lucide-react';
import { Transaction, Invoice, Account, Workspace, TransactionType, UserProfile } from '../types';
import { cn } from '../lib/utils';
import { toast } from 'sonner';
import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, LineChart, Line } from 'recharts';
import { exportToCSV, exportToPDF } from '../lib/dataEngine';

interface IzyAssistantProps {
  workspace: Workspace | null;
  user: UserProfile | null;
  transactions: Transaction[];
  invoices: Invoice[];
  accounts: Account[];
  isOpen: boolean;
  onClose: () => void;
  period?: string;
  initialScenario?: string | null;
}

interface PendingTransaction {
  type: TransactionType;
  amount: number;
  category: string;
  description: string;
  payeePayer?: string;
  date: string;
  time?: string;
}

interface PendingInvoice {
  clientName: string;
  amount: number;
  dueDate: string;
  introduction: string;
  status: string;
  currency?: string;
  items?: { description: string; quantity: number; price: number }[];
  paidAmount?: number;
}

interface PendingDelete {
  transactionIds: string[];
  description: string;
}

interface PendingUpdate {
  transactionId: string;
  updates: Partial<PendingTransaction>;
}

interface PendingReport {
  title: string;
  type: 'pie' | 'bar' | 'line' | 'summary';
  data: any[];
  summary?: string;
  recommendation?: string;
}

interface PendingWorkspaceUpdate {
  updates: Partial<Workspace>;
}

interface PendingAccountUpdate {
  accountId: string;
  updates: Partial<Account>;
}

interface PendingPreferenceUpdate {
  updates: Partial<UserProfile['preferences']>;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  pendingTransaction?: PendingTransaction;
  pendingInvoice?: PendingInvoice;
  pendingDelete?: PendingDelete;
  pendingUpdate?: PendingUpdate;
  pendingReport?: PendingReport;
  pendingWorkspaceUpdate?: PendingWorkspaceUpdate;
  pendingAccountUpdate?: PendingAccountUpdate;
  pendingPreferenceUpdate?: PendingPreferenceUpdate;
}

export function IzyAssistant({ workspace, user, transactions, invoices, accounts, isOpen, onClose, period = 'this-month', initialScenario }: IzyAssistantProps) {
  const [messages, setMessages] = useState<Message[]>([
    { 
      role: 'assistant', 
      content: "Hi! I'm Izy. I can help you **record transactions**, **search your records**, or **generate reports**. For technical account help or complex bugs, please use the WhatsApp Support link." 
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const processedScenarioRef = useRef<string | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (isOpen && initialScenario && initialScenario !== processedScenarioRef.current) {
      processedScenarioRef.current = initialScenario;
      sendMessage(initialScenario);
    }
    if (!isOpen) {
      processedScenarioRef.current = null;
    }
  }, [isOpen, initialScenario]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMessage = text.trim();
    if (text === input) setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      
      // Log query for analytics (optional placeholder)
      try {
        if (user?.uid) {
          console.log('izy_query logged for:', user.uid, userMessage);
        }
      } catch (e) {
        console.error('Failed to log izy query:', e);
      }
      
      // Prepare context - more focused
      const context = `
        You are Izy, the expert financial AI assistant for IzyFlow. 
        Your goal is to provide precise answers based ONLY on the data provided below.
        
        WORKSPACE: ${workspace?.name || 'None'} | CURRENCY: ${workspace?.currency || 'GHS'}
        DATE: ${new Date().toISOString().split('T')[0]} | PERIOD: ${period || 'Current View'}
        
        ACCOUNTS:
        ${accounts.map(a => `- ${a.name}: ${workspace?.currency} ${a.balance.toLocaleString()}`).join('\n') || 'None'}
        
        INVOICES:
        - Total: ${invoices.length}
        - Recent: ${invoices.slice(0, 10).map(i => `${i.clientName} (${i.amount}) - ${i.status}`).join(', ')}
        
        TRANSACTION DATA (Compact Format):
        CSV-STYLE: DATE, TYPE, AMOUNT, CATEGORY, DESCRIPTION
        ${transactions.slice(0, 100).map(t => `${t.date}, ${t.type}, ${t.amount}, ${t.category}, ${t.description}`).join('\n')}
        
        INSTRUCTIONS:
        1. ROLE: You are a DATA ASSISTANT. Focus on RECORDING NEW DATA and SEARCHING/SUMMING existing records from the TRANSACTION DATA section.
        2. DATA ENTRY: If the user provides details of a new transaction, use 'proposeTransaction' immediately.
        3. SEARCH & SUM: When asked about spending or income (e.g., "How much did I give to mum?"), filter and sum the amounts from the DATA above. Look for keywords in descriptions.
        4. TECHNICAL SUPPORT HANDOFF: If the user asks technical questions (e.g., "Why is the app slow?", "How do I change my password?", "Reset my account"), STOP and say: "I specialize in managing your financial records. For technical help or billing issues, please contact our human support team directly here: https://wa.me/233507750048"
        5. CONSTRAINTS: Only answer based on the provided data. Do not guess or hallucinate.
        6. BE CONCISE: Direct answers are best.
        
        Stay objective. You are Izy.
      `;

      // History pruning (last 6 messages for focus)
      const history = messages.slice(-6).map(m => ({ 
        role: m.role === 'user' ? 'user' : 'model', 
        parts: [{ text: m.content }] 
      }));

      const response = await api.chat(
        [
          { role: 'user', parts: [{ text: context }] },
          ...history,
          { role: 'user', parts: [{ text: userMessage }] }
        ],
        {
          temperature: 0, // Deterministic for retrieval
          tools: [{
            functionDeclarations: [
              {
                name: "proposeTransaction",
                description: `Propose a new transaction based on a user's description. 
Available Income Categories: ${workspace?.incomeCategories?.join(', ') || 'Sales, Consulting, Investment, Interest, Rental Income, Gift, Other'}.
Available Expense Categories: ${workspace?.expenseCategories?.join(', ') || 'Rent, Software, Marketing, Salary, Utilities, Travel, Supplies, Insurance, Taxes, Maintenance, Entertainment, Food & Dining, Transportation, Other'}.`,
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    type: { type: Type.STRING, enum: ["Income", "Expense", "Transfer", "Investment"], description: "The type of transaction" },
                    amount: { type: Type.NUMBER, description: "The amount of the transaction" },
                    category: { 
                      type: Type.STRING, 
                      description: "The category of the transaction. Use one of the available categories if possible." 
                    },
                    payeePayer: { type: Type.STRING, description: "The name of the payee (for expenses) or payer (for income)" },
                    description: { type: Type.STRING, description: "A brief description of the transaction" },
                    date: { type: Type.STRING, description: "The date of the transaction in YYYY-MM-DD format" },
                    time: { type: Type.STRING, description: "The time of the transaction in HH:mm format (24-hour)" },
                    isLoan: { type: Type.BOOLEAN, description: "Whether this transaction is a loan" },
                    loanStatus: { type: Type.STRING, enum: ["Loan", "Repayment"], description: "The status of the loan" },
                    useFor: { type: Type.STRING, enum: ["Business", "Personal"], description: "Whether this is for business or personal use" }
                  },
                  required: ["type", "amount", "category", "description", "date"]
                }
              },
              {
                name: "proposeInvoice",
                description: "Propose a new invoice based on a user's description.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    clientName: { type: Type.STRING, description: "The name of the client" },
                    amount: { type: Type.NUMBER, description: "The total amount of the invoice" },
                    currency: { type: Type.STRING, description: "The currency of the invoice (e.g. GHS, USD)" },
                    dueDate: { type: Type.STRING, description: "The due date of the invoice in YYYY-MM-DD format" },
                    introduction: { type: Type.STRING, description: "A brief professional introduction or note for the invoice" },
                    status: { type: Type.STRING, enum: ["Draft", "Sent", "Paid", "Partial"], description: "The status of the invoice" },
                    items: { 
                      type: Type.ARRAY, 
                      items: { 
                        type: Type.OBJECT,
                        properties: {
                          description: { type: Type.STRING },
                          quantity: { type: Type.NUMBER },
                          price: { type: Type.NUMBER }
                        }
                      },
                      description: "The items in the invoice"
                    },
                    paidAmount: { type: Type.NUMBER, description: "The amount already paid" }
                  },
                  required: ["clientName", "amount", "dueDate", "introduction"]
                }
              },
              {
                name: "proposeDelete",
                description: "Propose deleting one or more transactions.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    transactionIds: { 
                      type: Type.ARRAY, 
                      items: { type: Type.STRING },
                      description: "The IDs of the transactions to delete" 
                    },
                    description: { type: Type.STRING, description: "A summary of what is being deleted" }
                  },
                  required: ["transactionIds", "description"]
                }
              },
              {
                name: "proposeUpdate",
                description: "Propose updating an existing transaction.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    transactionId: { type: Type.STRING, description: "The ID of the transaction to update" },
                    updates: {
                      type: Type.OBJECT,
                      properties: {
                        type: { type: Type.STRING, enum: ["Income", "Expense", "Transfer", "Investment"] },
                        amount: { type: Type.NUMBER },
                        category: { type: Type.STRING },
                        payeePayer: { type: Type.STRING },
                        description: { type: Type.STRING },
                        date: { type: Type.STRING },
                        time: { type: Type.STRING },
                        isLoan: { type: Type.BOOLEAN },
                        loanStatus: { type: Type.STRING, enum: ["Loan", "Repayment"] },
                        useFor: { type: Type.STRING, enum: ["Business", "Personal"] }
                      },
                      description: "The fields to update"
                    }
                  },
                  required: ["transactionId", "updates"]
                }
              },
              {
                name: "proposeWorkspaceUpdate",
                description: "Propose updating workspace settings (name, currency, categories, targets, etc.)",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    updates: {
                      type: Type.OBJECT,
                      properties: {
                        name: { type: Type.STRING },
                        currency: { type: Type.STRING, enum: ["GHS", "USD", "GBP", "EUR"] },
                        description: { type: Type.STRING },
                        salesTarget: { type: Type.NUMBER },
                        retainerTarget: { type: Type.NUMBER },
                        incomeCategories: { type: Type.ARRAY, items: { type: Type.STRING } },
                        expenseCategories: { type: Type.ARRAY, items: { type: Type.STRING } },
                        investmentCategories: { type: Type.ARRAY, items: { type: Type.STRING } }
                      }
                    }
                  },
                  required: ["updates"]
                }
              },
              {
                name: "proposeAccountUpdate",
                description: "Propose updating an account balance or name.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    accountId: { type: Type.STRING },
                    updates: {
                      type: Type.OBJECT,
                      properties: {
                        name: { type: Type.STRING },
                        balance: { type: Type.NUMBER }
                      }
                    }
                  },
                  required: ["accountId", "updates"]
                }
              },
              {
                name: "proposeUserPreferenceUpdate",
                description: "Propose updating user application preferences.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    updates: {
                      type: Type.OBJECT,
                      properties: {
                        timeFormat: { type: Type.STRING, enum: ["12h", "24h"] },
                        dateFormat: { type: Type.STRING },
                        transactionFields: {
                          type: Type.OBJECT,
                          properties: {
                            showTime: { type: Type.BOOLEAN },
                            showPayeePayer: { type: Type.BOOLEAN },
                            showDescription: { type: Type.BOOLEAN }
                          }
                        }
                      }
                    }
                  },
                  required: ["updates"]
                }
              },
              {
                name: "generateReport",
                description: "Generate an accurate, interactive financial report with charts and summaries. Use this for trends, comparisons, or deep insights. Ensure the data is granular enough for a meaningful report.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING, description: "The title of the report" },
                    type: { type: Type.STRING, enum: ["pie", "bar", "line", "summary"], description: "The type of chart/report" },
                    data: { 
                      type: Type.ARRAY, 
                      items: { type: Type.OBJECT },
                      description: "The data for the chart. For pie: [{name, value}]. For bar/line: [{name, income, expense, balance, etc}]. Include as many data points as possible for accuracy."
                    },
                    summary: { type: Type.STRING, description: "A detailed text summary of the findings and data analysis" },
                    recommendation: { type: Type.STRING, description: "A smart, actionable recommendation based on the data trends" }
                  },
                  required: ["title", "type", "data"]
                }
              }
            ]
          }]
        },
        "gemini-2.5-flash"
      );

      const functionCalls = response.functionCalls;
      if (functionCalls && functionCalls.length > 0) {
        const call = functionCalls[0];
        if (call.name === 'proposeTransaction') {
          const args = call.args as any;
          setMessages(prev => [...prev, { 
            role: 'assistant', 
            content: `I've prepared a transaction record based on your description. Please review the details below:`,
            pendingTransaction: {
              type: args.type,
              amount: args.amount,
              category: args.category,
              payeePayer: args.payeePayer,
              description: args.description,
              date: args.date,
              time: args.time
            }
          }]);
        } else if (call.name === 'proposeInvoice') {
          const args = call.args as any;
          setMessages(prev => [...prev, { 
            role: 'assistant', 
            content: `I've prepared an invoice record based on your description. Please review the details below:`,
            pendingInvoice: {
              clientName: args.clientName,
              amount: args.amount,
              dueDate: args.dueDate,
              introduction: args.introduction,
              status: args.status || 'Draft',
              currency: args.currency,
              items: args.items,
              paidAmount: args.paidAmount
            }
          }]);
        } else if (call.name === 'proposeDelete') {
          const args = call.args as any;
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: `I've identified the following transactions for deletion: ${args.description}. Would you like me to proceed?`,
            pendingDelete: {
              transactionIds: args.transactionIds,
              description: args.description
            }
          }]);
        } else if (call.name === 'proposeUpdate') {
          const args = call.args as any;
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: `I've prepared an update for the transaction. Please review the changes:`,
            pendingUpdate: {
              transactionId: args.transactionId,
              updates: args.updates
            }
          }]);
        } else if (call.name === 'proposeWorkspaceUpdate') {
          const args = call.args as any;
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: `I've prepared an update for your workspace settings. Please review the changes:`,
            pendingWorkspaceUpdate: {
              updates: args.updates
            }
          }]);
        } else if (call.name === 'proposeAccountUpdate') {
          const args = call.args as any;
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: `I've prepared an update for the account. Please review the changes:`,
            pendingAccountUpdate: {
              accountId: args.accountId,
              updates: args.updates
            }
          }]);
        } else if (call.name === 'proposeUserPreferenceUpdate') {
          const args = call.args as any;
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: `I've prepared an update for your application preferences. Please review the changes:`,
            pendingPreferenceUpdate: {
              updates: args.updates
            }
          }]);
        } else if (call.name === 'generateReport') {
          const args = call.args as any;
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: `I've generated a financial report for you.`,
            pendingReport: {
              title: args.title,
              type: args.type,
              data: args.data,
              summary: args.summary,
              recommendation: args.recommendation
            }
          }]);
        }
      } else {
        const assistantMessage = response.text || "I'm sorry, I couldn't process that request.";
        setMessages(prev => [...prev, { role: 'assistant', content: assistantMessage }]);
      }
    } catch (error: any) {
      console.error('AI Error:', error);

      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: `Sorry, I'm having trouble connecting right now. ${error.message?.includes('API_KEY') ? '(Configuration issue)' : '(Network or processing error)'}` 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = () => sendMessage(input);

  const confirmTransaction = async (tx: PendingTransaction, index: number) => {
    if (!workspace) return;
    setIsLoading(true);
    try {
      // Normalize date to YYYY-MM-DD
      let date = tx.date;
      try {
        const d = new Date(tx.date);
        if (!isNaN(d.getTime())) {
          date = d.toISOString().split('T')[0];
        }
      } catch (e) {
        date = new Date().toISOString().split('T')[0];
      }

      const transactionData: any = {
        workspaceId: workspace.id,
        type: tx.type,
        amount: Number(tx.amount) || 0,
        currency: workspace.currency,
        category: tx.category || 'Other',
        date: date,
        description: tx.description || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      if (tx.payeePayer) transactionData.payeePayer = tx.payeePayer;
      if (tx.time) transactionData.time = tx.time;

      const createdTx = await api.createTransaction(workspace.id, transactionData);
      
      toast.success('Transaction recorded successfully!', {
        action: {
          label: 'Undo',
          onClick: async () => {
            try {
              await api.deleteTransaction(workspace.id, createdTx.id);
              toast.success('Transaction removed');
              window.dispatchEvent(new CustomEvent('refresh-data'));
            } catch (e) {
              toast.error('Failed to undo');
            }
          }
        }
      });
      
      window.dispatchEvent(new CustomEvent('refresh-data'));

      // Update messages to show confirmation
      setMessages(prev => prev.map((msg, i) => {
        if (i === index) {
          return { ...msg, content: "Transaction recorded! ✅", pendingTransaction: undefined };
        }
        return msg;
      }));
    } catch (error) {
      console.error('Error saving transaction:', error);
      toast.error('Failed to record transaction');
    } finally {
      setIsLoading(false);
    }
  };

  const confirmInvoice = async (invoice: PendingInvoice, index: number) => {
    if (!workspace) return;
    setIsLoading(true);
    try {
      let dueDate;
      try {
        const d = new Date(invoice.dueDate);
        if (isNaN(d.getTime())) throw new Error('Invalid date');
        dueDate = d.toISOString();
      } catch (e) {
        // Fallback to 7 days from now if date is invalid
        const fallback = new Date();
        fallback.setDate(fallback.getDate() + 7);
        dueDate = fallback.toISOString();
      }

      const invoiceData = {
        workspaceId: workspace.id,
        clientName: invoice.clientName,
        amount: Number(invoice.amount) || 0,
        currency: invoice.currency || workspace.currency,
        dueDate,
        introduction: invoice.introduction || '',
        status: invoice.status || 'Draft',
        items: invoice.items || [{ description: invoice.introduction || 'Service', quantity: 1, price: Number(invoice.amount) || 0 }],
        paidAmount: Number(invoice.paidAmount) || 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await api.createInvoice(workspace.id, invoiceData);
      
      toast.success("Invoice recorded successfully!");
      window.dispatchEvent(new CustomEvent('refresh-data'));

      setMessages(prev => prev.map((msg, i) => {
        if (i === index) {
          return { ...msg, content: "Invoice recorded! ✅", pendingInvoice: undefined };
        }
        return msg;
      }));
    } catch (error) {
      console.error('Error saving invoice:', error);
      toast.error("Failed to record invoice.");
    } finally {
      setIsLoading(false);
    }
  };

  const confirmDelete = async (pending: PendingDelete, index: number) => {
    if (!workspace) return;
    setIsLoading(true);
    try {
      for (const id of pending.transactionIds) {
        await api.deleteTransaction(workspace.id, id);
      }
      
      toast.success(`${pending.transactionIds.length} transaction(s) deleted!`, {
        action: {
          label: 'Undo',
          onClick: async () => {
            try {
              for (const id of pending.transactionIds) {
                const original = transactions.find(t => t.id === id);
                if (original) {
                  await api.createTransaction(workspace.id, original);
                }
              }
              toast.success('Transactions restored');
              window.dispatchEvent(new CustomEvent('refresh-data'));
            } catch (e) {
              toast.error('Failed to restore');
            }
          }
        }
      });
      
      window.dispatchEvent(new CustomEvent('refresh-data'));

      setMessages(prev => prev.map((msg, i) => {
        if (i === index) {
          return { ...msg, content: "Transactions deleted! 🗑️", pendingDelete: undefined };
        }
        return msg;
      }));
    } catch (error) {
      console.error('Error deleting transactions:', error);
      toast.error("Failed to delete transactions.");
    } finally {
      setIsLoading(false);
    }
  };

  const confirmUpdate = async (pending: PendingUpdate, index: number) => {
    if (!workspace) return;
    setIsLoading(true);
    try {
      const updateData = {
        ...pending.updates,
        updatedAt: new Date().toISOString()
      };
      await api.updateTransaction(workspace.id, pending.transactionId, updateData);
      
      toast.success("Transaction updated successfully!");
      window.dispatchEvent(new CustomEvent('refresh-data'));

      setMessages(prev => prev.map((msg, i) => {
        if (i === index) {
          return { ...msg, content: "Transaction updated! ✏️", pendingUpdate: undefined };
        }
        return msg;
      }));
    } catch (error) {
      console.error('Error updating transaction:', error);
      toast.error("Failed to update transaction.");
    } finally {
      setIsLoading(false);
    }
  };

  const confirmWorkspaceUpdate = async (pending: PendingWorkspaceUpdate, index: number) => {
    if (!workspace) return;
    setIsLoading(true);
    try {
      await api.updateWorkspace(workspace.id, {
        ...pending.updates,
        updatedAt: new Date().toISOString()
      });
      
      toast.success("Workspace settings updated!");
      window.dispatchEvent(new CustomEvent('refresh-workspaces'));

      setMessages(prev => prev.map((msg, i) => {
        if (i === index) {
          return { ...msg, content: "Workspace updated! 🏢", pendingWorkspaceUpdate: undefined };
        }
        return msg;
      }));
    } catch (error) {
      console.error('Error updating workspace:', error);
      toast.error("Failed to update workspace.");
    } finally {
      setIsLoading(false);
    }
  };

  const confirmAccountUpdate = async (pending: PendingAccountUpdate, index: number) => {
    if (!workspace) return;
    setIsLoading(true);
    try {
      await api.updateAccount(workspace.id, pending.accountId, {
        ...pending.updates,
        updatedAt: new Date().toISOString()
      });
      
      toast.success("Account updated successfully!");
      window.dispatchEvent(new CustomEvent('refresh-data'));

      setMessages(prev => prev.map((msg, i) => {
        if (i === index) {
          return { ...msg, content: "Account updated! 💰", pendingAccountUpdate: undefined };
        }
        return msg;
      }));
    } catch (error) {
      console.error('Error updating account:', error);
      toast.error("Failed to update account.");
    } finally {
      setIsLoading(false);
    }
  };

  const confirmPreferenceUpdate = async (pending: PendingPreferenceUpdate, index: number) => {
    if (!user) return;
    setIsLoading(true);
    try {
      await api.updateProfile({
        preferences: {
          ...user.preferences,
          ...pending.updates
        },
        updatedAt: new Date().toISOString()
      });
      
      toast.success("Preferences updated!");
      
      setMessages(prev => prev.map((msg, i) => {
        if (i === index) {
          return { ...msg, content: "Preferences updated! ⚙️", pendingPreferenceUpdate: undefined };
        }
        return msg;
      }));
    } catch (error) {
      console.error('Error updating preferences:', error);
      toast.error("Failed to update preferences.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadReport = (report: PendingReport) => {
    try {
      const fileName = `izy_report_${report.title.toLowerCase().replace(/\s+/g, '_')}`;
      
      // Prepare data for export
      const exportData = report.data.map(item => {
        const newItem: any = {};
        Object.entries(item).forEach(([key, value]) => {
          newItem[key.charAt(0).toUpperCase() + key.slice(1)] = value;
        });
        return newItem;
      });

      if (report.summary || report.recommendation) {
        exportToPDF(exportData, fileName, report.title, report.summary, report.recommendation);
      } else {
        exportToCSV(exportData, fileName);
      }
      
      toast.success('Report downloaded successfully');
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download report');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={containerRef}
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="fixed right-0 top-0 bottom-0 h-[100dvh] w-full md:w-[450px] bg-card border-l border-border shadow-2xl z-[90] flex flex-col overscroll-behavior-none"
        >
          {/* Header */}
          <div className="p-4 md:p-6 border-b border-border flex items-center justify-between bg-blue-600 text-white shrink-0 safe-top">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 md:h-12 md:w-12 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm shadow-inner">
                <Bot className="h-6 w-6 md:h-7 md:w-7" />
              </div>
              <div>
                <h3 className="font-black text-lg md:text-xl tracking-tight">Chat with Izy</h3>
                <p className="text-[10px] md:text-xs text-blue-100 flex items-center gap-1 font-bold uppercase tracking-wider">
                  <Sparkles className="h-3 w-3" /> AI Financial Assistant
                </p>
              </div>
            </div>
            <button 
              onClick={onClose} 
              className="p-3 hover:bg-white/10 rounded-full transition-colors active:scale-90"
              aria-label="Close chat"
            >
              <X className="h-7 w-7 md:h-8 md:w-8" />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 md:space-y-6 scrollbar-hide overscroll-contain">
            {messages.map((m, i) => (
              <div key={i} className={cn("flex gap-2 md:gap-3", m.role === 'user' ? "flex-row-reverse" : "flex-row")}>
                <div className={cn(
                  "h-8 w-8 md:h-9 md:w-9 rounded-lg flex items-center justify-center shrink-0 shadow-sm",
                  m.role === 'user' ? "bg-blue-600 text-white" : "bg-muted text-muted-foreground"
                )}>
                  {m.role === 'user' ? <User className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
                </div>
                <div className="space-y-2 max-w-[85%] md:max-w-[80%]">
                  <div className={cn(
                    "p-3 md:p-4 rounded-2xl text-sm leading-relaxed shadow-sm",
                    m.role === 'user' 
                      ? "bg-blue-600 text-white rounded-tr-none" 
                      : "bg-muted text-foreground rounded-tl-none"
                  )}>
                    <div className="prose prose-sm dark:prose-invert max-w-none text-inherit leading-relaxed break-words font-medium">
                      <ReactMarkdown>
                        {m.content}
                      </ReactMarkdown>
                    </div>
                  </div>

                  {m.pendingTransaction && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-card border border-blue-600/30 rounded-xl overflow-hidden shadow-xl"
                    >
                      <div className="p-4 space-y-3 bg-slate-50/90">
                        <div className="flex items-center justify-between">
                          <span className={cn(
                            "text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded shadow-sm",
                            m.pendingTransaction.type === 'Income' ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"
                          )}>
                            {m.pendingTransaction.type}
                          </span>
                          <span className="text-xs text-slate-900 font-mono font-bold">
                            {m.pendingTransaction.date} {m.pendingTransaction.time && `@ ${m.pendingTransaction.time}`}
                          </span>
                        </div>
                        
                        <div className="flex items-baseline gap-1">
                          <span className="text-3xl font-black text-slate-950">{m.pendingTransaction.amount}</span>
                          <span className="text-sm text-slate-800 font-black uppercase">{workspace?.currency}</span>
                        </div>
 
                        <div className="space-y-1 pt-2 border-t border-slate-300">
                          {m.pendingTransaction.payeePayer && (
                            <p className="text-xs font-black text-blue-900 uppercase tracking-tight">{m.pendingTransaction.payeePayer}</p>
                          )}
                          <p className="text-sm font-bold text-slate-950 leading-tight">{m.pendingTransaction.description}</p>
                          <p className="text-[10px] text-slate-800 uppercase tracking-wider font-black bg-slate-300/50 px-2 py-1 rounded inline-block">{m.pendingTransaction.category}</p>
                        </div>
                      </div>
                      
                      <button 
                        onClick={() => confirmTransaction(m.pendingTransaction!, i)}
                        disabled={isLoading}
                        className="w-full p-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
                      >
                        {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                        Confirm & Record
                      </button>
                    </motion.div>
                  )}
                  {m.pendingInvoice && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-card border border-blue-600/30 rounded-xl overflow-hidden shadow-xl"
                    >
                      <div className="p-4 space-y-3 bg-blue-50/90">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded bg-blue-700 text-white shadow-sm">
                            INVOICE
                          </span>
                          <span className="text-xs text-slate-900 font-mono font-bold">
                            Due: {m.pendingInvoice.dueDate}
                          </span>
                        </div>
                        
                        <div className="flex items-baseline gap-1">
                          <span className="text-3xl font-black text-slate-950">{m.pendingInvoice.amount}</span>
                          <span className="text-sm text-slate-800 font-black uppercase">{workspace?.currency}</span>
                        </div>
 
                        <div className="space-y-1 pt-2 border-t border-blue-200">
                          <p className="text-xs font-black text-blue-900 uppercase tracking-tight">{m.pendingInvoice.clientName}</p>
                          <p className="text-sm font-bold text-slate-950 leading-tight">{m.pendingInvoice.introduction}</p>
                          <p className="text-[10px] text-slate-800 uppercase tracking-wider font-black bg-blue-200/50 px-2 py-1 rounded inline-block">{m.pendingInvoice.status}</p>
                        </div>
                      </div>
                      
                      <button 
                        onClick={() => confirmInvoice(m.pendingInvoice!, i)}
                        disabled={isLoading}
                        className="w-full p-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
                      >
                        {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                        Confirm & Record
                      </button>
                    </motion.div>
                  )}
                  {m.pendingDelete && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-card border border-rose-600/30 rounded-xl overflow-hidden shadow-xl"
                    >
                      <div className="p-4 space-y-3 bg-rose-50/90">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded bg-rose-600 text-white shadow-sm">
                            DELETE REQUEST
                          </span>
                        </div>
                        <p className="text-sm font-bold text-slate-950 leading-tight">
                          Delete {m.pendingDelete.transactionIds.length} transaction(s):
                        </p>
                        <p className="text-xs text-slate-700 italic">"{m.pendingDelete.description}"</p>
                      </div>
                      
                      <button 
                        onClick={() => confirmDelete(m.pendingDelete!, i)}
                        disabled={isLoading}
                        className="w-full p-3 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
                      >
                        {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <AlertCircle className="h-3 w-3" />}
                        Confirm Deletion
                      </button>
                    </motion.div>
                  )}
                  {m.pendingUpdate && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-card border border-amber-600/30 rounded-xl overflow-hidden shadow-xl"
                    >
                      <div className="p-4 space-y-3 bg-amber-50/90">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded bg-amber-600 text-white shadow-sm">
                            UPDATE REQUEST
                          </span>
                        </div>
                        <div className="space-y-2">
                          {Object.entries(m.pendingUpdate.updates).map(([key, value]) => (
                            <div key={key} className="flex justify-between text-xs">
                              <span className="font-bold text-slate-600 uppercase">{key}:</span>
                              <span className="text-slate-900">{String(value)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      <button 
                        onClick={() => confirmUpdate(m.pendingUpdate!, i)}
                        disabled={isLoading}
                        className="w-full p-3 bg-amber-600 hover:bg-amber-700 text-white text-xs font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
                      >
                        {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                        Confirm Update
                      </button>
                    </motion.div>
                  )}
                  {m.pendingWorkspaceUpdate && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-card border border-indigo-600/30 rounded-xl overflow-hidden shadow-xl"
                    >
                      <div className="p-4 space-y-3 bg-indigo-50/90">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded bg-indigo-600 text-white shadow-sm">
                            WORKSPACE UPDATE
                          </span>
                        </div>
                        <div className="space-y-2">
                          {Object.entries(m.pendingWorkspaceUpdate.updates).map(([key, value]) => (
                            <div key={key} className="flex justify-between text-xs">
                              <span className="font-bold text-slate-600 uppercase">{key}:</span>
                              <span className="text-slate-900 truncate max-w-[150px]">{String(value)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      <button 
                        onClick={() => confirmWorkspaceUpdate(m.pendingWorkspaceUpdate!, i)}
                        disabled={isLoading}
                        className="w-full p-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
                      >
                        {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                        Confirm Changes
                      </button>
                    </motion.div>
                  )}
                  {m.pendingAccountUpdate && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-card border border-emerald-600/30 rounded-xl overflow-hidden shadow-xl"
                    >
                      <div className="p-4 space-y-3 bg-emerald-50/90">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded bg-emerald-600 text-white shadow-sm">
                            ACCOUNT UPDATE
                          </span>
                        </div>
                        <div className="space-y-2">
                          <p className="text-xs font-bold text-slate-600">ID: {m.pendingAccountUpdate.accountId}</p>
                          {Object.entries(m.pendingAccountUpdate.updates).map(([key, value]) => (
                            <div key={key} className="flex justify-between text-xs">
                              <span className="font-bold text-slate-600 uppercase">{key}:</span>
                              <span className="text-slate-900">{String(value)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      <button 
                        onClick={() => confirmAccountUpdate(m.pendingAccountUpdate!, i)}
                        disabled={isLoading}
                        className="w-full p-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
                      >
                        {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                        Confirm Update
                      </button>
                    </motion.div>
                  )}
                  {m.pendingPreferenceUpdate && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-card border border-slate-600/30 rounded-xl overflow-hidden shadow-xl"
                    >
                      <div className="p-4 space-y-3 bg-slate-50/90">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded bg-slate-600 text-white shadow-sm">
                            PREFERENCE UPDATE
                          </span>
                        </div>
                        <div className="space-y-2">
                          {Object.entries(m.pendingPreferenceUpdate.updates).map(([key, value]) => (
                            <div key={key} className="flex flex-col text-xs">
                              <span className="font-bold text-slate-600 uppercase">{key}:</span>
                              <span className="text-slate-900">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      <button 
                        onClick={() => confirmPreferenceUpdate(m.pendingPreferenceUpdate!, i)}
                        disabled={isLoading}
                        className="w-full p-3 bg-slate-600 hover:bg-slate-700 text-white text-xs font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
                      >
                        {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                        Confirm Preferences
                      </button>
                    </motion.div>
                  )}
                  {m.pendingReport && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-card border border-blue-600/30 rounded-xl overflow-hidden shadow-xl w-full"
                    >
                      <div className="p-4 space-y-4 bg-white">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">{m.pendingReport.title}</h4>
                          <ChartIcon className="h-4 w-4 text-blue-600" />
                        </div>

                        <div className="h-[200px] w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            {m.pendingReport.type === 'pie' ? (
                              <PieChart>
                                <Pie
                                  data={m.pendingReport.data}
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={40}
                                  outerRadius={60}
                                  paddingAngle={5}
                                  dataKey="value"
                                >
                                  {m.pendingReport.data.map((entry: any, index: number) => (
                                    <Cell key={`cell-${index}`} fill={['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][index % 5]} />
                                  ))}
                                </Pie>
                                <Tooltip />
                              </PieChart>
                            ) : m.pendingReport.type === 'bar' ? (
                              <BarChart data={m.pendingReport.data}>
                                <XAxis dataKey="name" hide />
                                <YAxis hide />
                                <Tooltip />
                                <Bar dataKey="income" fill="#10b981" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="expense" fill="#ef4444" radius={[4, 4, 0, 0]} />
                              </BarChart>
                            ) : (
                              <LineChart data={m.pendingReport.data}>
                                <XAxis dataKey="name" hide />
                                <YAxis hide />
                                <Tooltip />
                                <Line type="monotone" dataKey="value" stroke="#2563eb" strokeWidth={2} dot={false} />
                              </LineChart>
                            )}
                          </ResponsiveContainer>
                        </div>

                        {m.pendingReport.summary && (
                          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                            <p className="text-xs text-slate-700 leading-relaxed">{m.pendingReport.summary}</p>
                          </div>
                        )}

                        {m.pendingReport.recommendation && (
                          <div className="p-3 bg-blue-50 rounded-lg border border-blue-100 flex gap-2">
                            <Sparkles className="h-4 w-4 text-blue-600 shrink-0" />
                            <p className="text-xs text-blue-900 font-bold leading-relaxed">{m.pendingReport.recommendation}</p>
                          </div>
                        )}
                      </div>
                      
                      <button 
                        onClick={() => handleDownloadReport(m.pendingReport!)}
                        className="w-full p-3 bg-slate-100 hover:bg-slate-200 text-slate-900 text-[10px] font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-2 border-t border-slate-200"
                      >
                        <Download className="h-3 w-3" />
                        Download Report Data
                      </button>
                    </motion.div>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-3 mr-auto">
                <div className="h-8 w-8 rounded-lg bg-muted text-muted-foreground flex items-center justify-center shrink-0">
                  <Bot className="h-5 w-5" />
                </div>
                <div className="bg-muted p-4 rounded-2xl rounded-tl-none">
                  <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="p-4 md:p-6 border-t border-border bg-card shrink-0 safe-bottom">
            <div className="relative flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Ask Izy anything..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  className="w-full h-12 md:h-14 pl-4 pr-12 rounded-2xl border border-border bg-background focus:ring-2 focus:ring-blue-500/20 transition-all outline-none text-sm md:text-base font-medium shadow-inner"
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 text-blue-600 hover:bg-blue-50 rounded-xl transition-all disabled:opacity-30 active:scale-95"
                >
                  <Send className="h-5 w-5 md:h-6 md:w-6" />
                </button>
              </div>
            </div>
            <p className="mt-3 text-[10px] text-center text-muted-foreground font-medium">
              Izy can make mistakes. Verify important financial data.
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
