import { useEffect, useState, useMemo } from 'react';
import { EXCHANGE_RATES } from '../constants';
import { Workspace, Transaction, Account, Invoice, Currency, AllocationRule } from '../types';
import { cn, parseLocalDate } from '../lib/utils';
import { api } from '../lib/api';
import { motion } from 'motion/react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  DollarSign, 
  ArrowUpRight, 
  ArrowDownRight, 
  Target,
  PieChart as PieChartIcon,
  BarChart3,
  LineChart as LineChartIcon,
  Upload,
  Download,
  AlertCircle,
  Bell,
  CheckCircle2,
  Clock,
  RefreshCw,
  CreditCard,
  Zap,
  Building2,
  History as HistoryIcon,
  ChevronDown,
  Edit,
  Receipt,
  Plus,
  Trash2,
  FileText,
  Send,
  Loader2,
  LayoutGrid,
  Search,
  Printer
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, subDays, startOfYear, endOfYear, isWithinInterval, parseISO } from 'date-fns';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip, 
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  AreaChart,
  Area
} from 'recharts';
import { Button } from './ui/button';
import { ImportTool } from './ImportTool';
import { exportToCSV, exportToExcel, exportToPDF } from '../lib/dataEngine';
import { toast } from 'sonner';
import { UserProfile } from '../types';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./ui/dialog";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "./ui/dropdown-menu";
import { Calendar as CalendarIcon, Filter } from 'lucide-react';

type Period = 'all' | 'this-month' | 'last-month' | 'this-year' | 'last-30-days';

interface DashboardProps {
  workspace: Workspace | null;
  user: UserProfile | null;
  period: string;
  onPeriodChange: (period: any) => void;
  onNavigate: (tab: string, filters?: any) => void;
  transactions: Transaction[];
  invoices: Invoice[];
  accounts: Account[];
  allocationRules: AllocationRule[];
  loading: boolean;
}

export function Dashboard({ 
  workspace, 
  user, 
  period, 
  onPeriodChange, 
  onNavigate,
  transactions: propTransactions,
  invoices: propInvoices,
  accounts: propAccounts,
  allocationRules: propAllocationRules,
  loading: propLoading
}: DashboardProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [allocationRules, setAllocationRules] = useState<AllocationRule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (propTransactions) setTransactions(propTransactions);
    if (propAccounts) setAccounts(propAccounts);
    if (propInvoices) setInvoices(propInvoices);
    if (propAllocationRules) setAllocationRules(propAllocationRules);
    setLoading(propLoading);
  }, [propTransactions, propAccounts, propInvoices, propAllocationRules, propLoading]);
  const [displayCurrency, setDisplayCurrency] = useState<Currency>(workspace?.currency || 'GHS');
  const [breakdown, setBreakdown] = useState<{
    title: string;
    items: any[];
    type: 'transactions' | 'accounts' | 'invoices';
  } | null>(null);

  const openBreakdown = (title: string, type: 'transactions' | 'accounts' | 'invoices', items: any[]) => {
    setBreakdown({ title, items, type });
  };

  useEffect(() => {
    if (workspace?.currency) {
      setDisplayCurrency(workspace.currency);
    }
  }, [workspace?.currency]);

  const convert = (amount: number, sourceCurrency?: Currency) => {
    const baseAmount = amount || 0;
    const targetRate = EXCHANGE_RATES[displayCurrency] || 1;
    const sourceRate = EXCHANGE_RATES[sourceCurrency || workspace?.currency || 'GHS'] || 1;
    return baseAmount * (targetRate / sourceRate);
    return baseAmount * (targetRate / sourceRate);
  };

  // 8. TRUE EXPECTED ACCOUNT BALANCES (calculated from transactions)
  const computedBalances = useMemo(() => {
    const map: Record<string, number> = {};
    accounts.forEach(a => { map[a.id] = 0; });

    transactions.forEach(tx => {
      const amount = tx.amount || 0;
      const isOutflow = tx.type === 'Expense' || tx.type === 'Investment';
      const isInflow = tx.type === 'Income';

      if (tx.accountId === 'auto-allocate') {
        allocationRules.forEach(rule => {
          const allocAmount = (amount * rule.percentage) / 100;
          if (map[rule.targetAccountId] !== undefined) {
            if (isInflow) map[rule.targetAccountId] += allocAmount;
            else if (isOutflow) map[rule.targetAccountId] -= allocAmount;
          }
        });
      } else if (tx.accountId && map[tx.accountId] !== undefined) {
        if (isInflow) map[tx.accountId] += amount;
        else if (isOutflow) map[tx.accountId] -= amount;
      } else {
        const matchedAccount = accounts.find(a => 
          tx.category === a.name || 
          tx.description?.toLowerCase().includes(a.name.toLowerCase()) ||
          tx.payeePayer?.toLowerCase().includes(a.name.toLowerCase())
        );
        if (matchedAccount) {
          if (isInflow) map[matchedAccount.id] += amount;
          else if (isOutflow) map[matchedAccount.id] -= amount;
        }
      }
    });
    return map;
  }, [transactions, accounts, allocationRules]);

  useEffect(() => {
    if (!workspace) return;
    setDisplayCurrency(workspace.currency);
  }, [workspace]);

  const handleExport = async (formatType: 'csv' | 'excel' | 'pdf') => {
    if (!workspace || filteredTransactions.length === 0) {
      toast.error('No data to export for selected period');
      return;
    }

    try {
      const data = filteredTransactions.map(t => ({
        Date: t.date,
        'Payee/Payer': t.payeePayer || '-',
        Description: t.description,
        Category: t.category,
        Amount: t.amount,
        Type: t.type
      }));

      const fileName = `transactions_${period}_${format(new Date(), 'yyyy-MM-dd')}`;

      if (formatType === 'csv') exportToCSV(data, fileName);
      else if (formatType === 'excel') exportToExcel(data, fileName);
      else exportToPDF(data, fileName, `${period.replace('-', ' ').toUpperCase()} Transactions`);
      
      toast.success(`Exported to ${formatType.toUpperCase()}`);
    } catch (error) {
      toast.error('Export failed');
    }
  };

  if (!workspace) return <div className="text-center text-muted-foreground py-20">Select a workspace to view dashboard</div>;
  if (loading) return (
    <div className="flex items-center justify-center py-40">
      <RefreshCw className="h-8 w-8 text-purple-500 animate-spin" />
    </div>
  );

  // Period Filtering Logic
  const getInvoiceStatus = (invoice: Invoice) => {
    // 1. Explicit Paid status ALWAYS wins
    if (invoice.status === 'Paid') return 'Paid';
    
    // 2. If it's fully paid (within epsilon), treat as Paid
    const amountNum = invoice.amount || 0;
    const paidAmountNum = invoice.paidAmount || 0;
    if (paidAmountNum >= (amountNum - 0.005) && amountNum > 0) return 'Paid';
    
    try {
      const dDate = parseLocalDate(invoice.dueDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (!isNaN(dDate.getTime()) && dDate < today) {
        return paidAmountNum > 0 ? 'Partial (Overdue)' : 'Overdue';
      }
    } catch (e) {}
    return invoice.status;
  };

  const getFilteredTransactions = () => {
    if (period === 'all') return transactions;
    
    const now = new Date();
    let start: Date;
    let end: Date = now;

    switch (period) {
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
        return transactions;
    }

    return transactions.filter(t => {
      if (!t.date) return false;
      
      // Period filter
      let isInPeriod = true;
      try {
        const tDate = parseLocalDate(t.date);
        if (isNaN(tDate.getTime())) isInPeriod = false;
        else isInPeriod = isWithinInterval(tDate, { start, end });
      } catch (e) {
        isInPeriod = false;
      }

      if (!isInPeriod) return false;

      return true;
    });
  };

  const filteredTransactions = getFilteredTransactions();

  // Helper to get flags (with fallback for old transactions)
  const getFlags = (t: Transaction) => {
    return {
      affects_cash: t.affects_cash ?? (t.type !== 'Transfer'),
      affects_profit: t.affects_profit ?? ((t.type === 'Income' || t.type === 'Expense') && !t.isLoan),
      affects_investment: t.affects_investment ?? (t.type === 'Investment'),
      affects_debt: t.affects_debt ?? (t.isLoan === true)
    };
  };

  // 1. REVENUE (Income)
  const revenue = filteredTransactions
    .filter(t => t.type === 'Income')
    .reduce((acc, t) => acc + convert(t.amount || 0, t.currency), 0);

  // 2. OUTGOINGS (Expenses + Investments)
  const outgoings = filteredTransactions
    .filter(t => t.type === 'Expense' || t.type === 'Investment')
    .reduce((acc, t) => acc + convert(t.amount || 0, t.currency), 0);

  // 3. INVESTED (Investment only)
  const totalInvested = filteredTransactions
    .filter(t => t.type === 'Investment')
    .reduce((acc, t) => acc + convert(t.amount || 0, t.currency), 0);

  // 4. NET CASH FLOW
  const netCashFlow = revenue - outgoings;
  const savingsRate = revenue > 0 ? (netCashFlow / revenue) * 100 : 0;
  const isOverspent = netCashFlow < 0;

  // 5. DEBT & LOANS (Cumulative - Total Outstanding)
  // Debt: Money we borrowed - Money we repaid
  const debt = transactions
    .filter(t => t.isLoan && t.loanStatus === 'Loan' && t.type === 'Income')
    .reduce((sum, t) => sum + convert(t.amount || 0, t.currency), 0) -
    transactions
    .filter(t => t.isLoan && t.loanStatus === 'Repayment' && t.type === 'Expense')
    .reduce((sum, t) => sum + convert(t.amount || 0, t.currency), 0);

  // Money Owed To Me: Money we lent - Money they repaid
  const moneyOwedToMe = transactions
    .filter(t => t.isLoan && t.loanStatus === 'Loan' && t.type === 'Expense')
    .reduce((sum, t) => sum + convert(t.amount || 0, t.currency), 0) -
    transactions
    .filter(t => t.isLoan && t.loanStatus === 'Repayment' && t.type === 'Income')
    .reduce((sum, t) => sum + convert(t.amount || 0, t.currency), 0);

  // 6. CASH POSITION (Cumulative - All-time Net Flow)
  const allTimeIn = transactions
    .filter(t => t.type === 'Income')
    .reduce((acc, t) => acc + convert(t.amount || 0, t.currency), 0);
  const allTimeOut = transactions
    .filter(t => t.type === 'Expense' || t.type === 'Investment')
    .reduce((acc, t) => acc + convert(t.amount || 0, t.currency), 0);
  const allTimeNet = allTimeIn - allTimeOut;

  // 7. ACCOUNT BALANCES (Sum of all account balances)
  const sumAccounts = accounts.reduce((sum, a) => sum + convert(a.balance || 0, a.currency as Currency), 0);
  
  // Mismatch check: Database account balances should equal their true expected computed balances
  const balanceMismatch = accounts.some(a => Math.abs((a.balance || 0) - (computedBalances[a.id] || 0)) > 0.1);

  const syncBalances = async () => {
    if (!workspace) return;
    const toastId = toast.loading('Synchronizing account balances...');
    
    try {
      // Update backend via API using mathematically computed balances
      const promises = accounts.map(a => {
        const newBalance = computedBalances[a.id] || 0;
        if (Math.abs(newBalance - (a.balance || 0)) > 0.01) {
          return api.updateAccount(workspace.id, a.id, { balance: newBalance });
        }
        return Promise.resolve();
      });

      await Promise.all(promises);
      toast.success('Account balances synchronized', { id: toastId });
      
      // Trigger UI refresh
      window.dispatchEvent(new CustomEvent('refresh-data'));
    } catch (error) {
      console.error('Sync error:', error);
      toast.error('Failed to synchronize balances', { id: toastId });
    }
  };

  // Ratios for insights
  // Monthly Comparison Data
  const getMonthlyData = () => {
    const months: { [key: string]: any } = {};
    const last6Months = Array.from({ length: 6 }, (_, i) => {
      const d = subDays(new Date(), i * 30);
      return format(d, 'MMM yyyy');
    }).reverse();

    last6Months.forEach(m => {
      months[m] = { month: m, income: 0, outgoings: 0 };
    });

    transactions.forEach(t => {
      try {
        const tDate = parseLocalDate(t.date);
        if (isNaN(tDate.getTime())) return;
        const m = format(tDate, 'MMM yyyy');
        if (months[m]) {
          if (t.type === 'Income') {
            const cat = t.isLoan ? 'Loans' : (t.category || 'Other Income');
            months[m].income += t.amount || 0;
            months[m][cat] = (months[m][cat] || 0) + (t.amount || 0);
          } else if (t.type === 'Expense' || t.type === 'Investment') {
            months[m].outgoings += t.amount || 0;
          }
        }
      } catch (e) {
        // Skip invalid dates
      }
    });

    return Object.values(months);
  };

  const monthlyData = getMonthlyData();
  
  // Get all unique income categories present in monthlyData
  const incomeCategoriesInTrend = Array.from(new Set(
    monthlyData.flatMap(m => Object.keys(m).filter(k => k !== 'month' && k !== 'income' && k !== 'outgoings'))
  ));

  // Simple Insights
  const insights = [
    isOverspent ? {
      title: "Overspent Alert",
      message: `You've spent ${displayCurrency} ${convert(Math.abs(netCashFlow)).toLocaleString()} more than you earned this period.`,
      type: 'negative'
    } : {
      title: "Positive Cash Flow",
      message: `Great job! You have ${displayCurrency} ${convert(netCashFlow).toLocaleString()} left over after all expenses.`,
      type: 'positive'
    },
    revenue > 0 ? {
      title: workspace.type === 'Business' ? "Business Activity" : "Financial Profile",
      message: `${workspace.type === 'Business' ? 'Your business' : 'You'} achieved a net flow of ${displayCurrency} ${convert(netCashFlow).toLocaleString()} this period.`,
      type: netCashFlow > 0 ? 'positive' : 'negative'
    } : null,
    totalInvested > 0 ? {
      title: "Wealth Building",
      message: `You've put ${displayCurrency} ${convert(totalInvested).toLocaleString()} into investments. Keep it up!`,
      type: 'positive'
    } : null
  ].filter(Boolean);

  // Invoice Analytics (Filtered by period if applicable, but usually invoices are overall)
  const filteredInvoices = period === 'all' ? invoices : invoices.filter(i => {
    if (!i.createdAt) return false;
    try {
      // Invoices createdAt is usually an ISO string with time
      const iDate = parseISO(i.createdAt);
      if (isNaN(iDate.getTime())) return false;
      const now = new Date();
      let start: Date;
      let end: Date = now;

      switch (period) {
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
          return true;
      }
      return isWithinInterval(iDate, { start, end });
    } catch (e) {
      return false;
    }
  });

  const totalInvoiced = filteredInvoices.reduce((acc, i) => acc + (i.amount || 0), 0);
  const paidAmountTotal = filteredInvoices.reduce((acc, i) => acc + (i.paidAmount || 0), 0);
  const outstandingAmount = filteredInvoices.reduce((acc, i) => acc + ((i.amount || 0) - (i.paidAmount || 0)), 0);
  
  const conversionRate = totalInvoiced > 0 ? (paidAmountTotal / totalInvoiced) * 100 : 0;
  // Overdue Reminders - Always check ALL invoices, not just filtered ones
  const overdueInvoices = invoices.filter(i => {
    const status = getInvoiceStatus(i);
    return status.includes('Overdue') && i.status !== 'Paid';
  });

  const sendReminder = (invoice: Invoice) => {
    toast.success(`Reminder sent to ${invoice.clientName} for ${displayCurrency} ${convert(invoice.amount).toLocaleString()}`);
  };

  // Chart Data: Money In (Include loans for full transparency)
  const incomeCategories = filteredTransactions
    .filter(t => t.type === 'Income')
    .reduce((acc: any, t) => {
      const cat = t.isLoan ? 'Loans Received' : (t.category || 'Uncategorized');
      acc[cat] = (acc[cat] || 0) + (t.amount || 0);
      return acc;
    }, {});
  const incomeSourceData = Object.entries(incomeCategories).map(([name, value]) => ({ name, value: value as number }));

  // Chart Data: Money Out Breakdown
  const getMoneyOutData = () => {
    // Show categories for the workspace
    const categories = filteredTransactions
      .filter(t => t.type === 'Expense' || t.type === 'Investment')
      .reduce((acc: any, t) => {
        const cat = t.category || 'Uncategorized';
        acc[cat] = (acc[cat] || 0) + t.amount;
        return acc;
      }, {});
    return Object.entries(categories).map(([name, value]) => ({ name, value: value as number }));
  };

  const moneyOutData = getMoneyOutData();

  // Chart Data: Spending by Category
  const expenseCategoriesData = filteredTransactions
    .filter(t => t.type === 'Expense' && !t.isLoan)
    .reduce((acc: any, t) => {
      const cat = t.category || 'Uncategorized';
      acc[cat] = (acc[cat] || 0) + t.amount;
      return acc;
    }, {});
  const spendingByCategoryData = Object.entries(expenseCategoriesData).map(([name, value]) => ({ name, value }));

  // Chart Data: Investment by Category
  const investmentCategoriesData = filteredTransactions
    .filter(t => t.type === 'Investment')
    .reduce((acc: any, t) => {
      const cat = t.category || 'Uncategorized';
      acc[cat] = (acc[cat] || 0) + t.amount;
      return acc;
    }, {});
  const investmentAllocationData = Object.entries(investmentCategoriesData).map(([name, value]) => ({ name, value }));

  // Chart Data: Money Over Time (Trend)
  const getTrendInterval = () => {
    const now = new Date();
    switch (period) {
      case 'this-month':
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case 'last-month':
        const lastMonth = subDays(startOfMonth(now), 1);
        return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) };
      case 'this-year':
        return { start: startOfYear(now), end: endOfYear(now) };
      case 'all':
        // For 'all', we might want to show the last 90 days or something reasonable if data is huge
        // But let's stick to last 30 days for trend if not specified
        return { start: subDays(now, 29), end: now };
      case 'last-30-days':
      default:
        return { start: subDays(now, 29), end: now };
    }
  };

  const trendInterval = getTrendInterval();
  const trendDays = trendInterval.start && trendInterval.end && trendInterval.start <= trendInterval.end 
    ? eachDayOfInterval(trendInterval) 
    : [];

  let runningBalance = 0;
  // Calculate initial running balance for trend if not starting from 'all'
  if (period !== 'all' && trendInterval.start && trendInterval.end) {
    const beforeTransactions = transactions.filter(t => {
      if (!t.date) return false;
      try {
        const tDate = parseLocalDate(t.date);
        return !isNaN(tDate.getTime()) && tDate < trendInterval.start;
      } catch (e) {
        return false;
      }
    });
    const bIncome = beforeTransactions.filter(t => t.type === 'Income').reduce((acc, t) => acc + (t.amount || 0), 0);
    const bExpense = beforeTransactions.filter(t => t.type === 'Expense').reduce((acc, t) => acc + (t.amount || 0), 0);
    const bInvestments = beforeTransactions.filter(t => t.type === 'Investment').reduce((acc, t) => acc + (t.amount || 0), 0);
    runningBalance = bIncome - bExpense - bInvestments;
  }

  const trendData = trendDays.map(day => {
    const dayTransactions = transactions.filter(t => {
      if (!t.date) return false;
      try {
        const tDate = parseLocalDate(t.date);
        return !isNaN(tDate.getTime()) && isSameDay(tDate, day);
      } catch (e) {
        return false;
      }
    });
    const dayIncome = dayTransactions.filter(t => t.type === 'Income').reduce((acc, t) => acc + (t.amount || 0), 0);
    const dayExpense = dayTransactions.filter(t => t.type === 'Expense').reduce((acc, t) => acc + (t.amount || 0), 0);
    const dayInvestments = dayTransactions.filter(t => t.type === 'Investment').reduce((acc, t) => acc + (t.amount || 0), 0);
    runningBalance += (dayIncome - dayExpense - dayInvestments);
    return {
      date: format(day, 'MMM d'),
      fullDate: format(day, 'yyyy-MM-dd'),
      balance: runningBalance,
      invested: dayInvestments
    };
  });

  const investmentTrendData = trendDays.map(day => {
    const dayInvestments = transactions.filter(t => {
      if (!t.date || t.type !== 'Investment') return false;
      try {
        const tDate = parseLocalDate(t.date);
        return !isNaN(tDate.getTime()) && isSameDay(tDate, day);
      } catch (e) {
        return false;
      }
    }).reduce((acc, t) => acc + (t.amount || 0), 0);
    return {
      date: format(day, 'MMM d'),
      fullDate: format(day, 'yyyy-MM-dd'),
      amount: dayInvestments
    };
  });

  const COLORS = [
    '#3b82f6', // Blue
    '#10b981', // Emerald
    '#f59e0b', // Amber
    '#ef4444', // Red
    '#8b5cf6', // Violet
    '#ec4899', // Pink
    '#06b6d4', // Cyan
    '#f97316', // Orange
    '#84cc16', // Lime
    '#14b8a6', // Teal
    '#a855f7', // Purple
    '#a855f7', // Purple
  ];

  const salesTarget = workspace?.salesTarget || 0;

  useEffect(() => {
    if (!workspace?.enableAutomatedReminders) return;
    const now = new Date();
    const overdue = invoices.filter(inv => {
      if (inv.status !== 'Overdue' && inv.status !== 'Sent') return false;
      if (!inv.dueDate) return false;
      const due = new Date(inv.dueDate);
      if (due >= now) return false;
      if (inv.lastAutomatedReminderSentAt) {
        const lastSent = new Date(inv.lastAutomatedReminderSentAt);
        const daysSince = (now.getTime() - lastSent.getTime()) / 86400000;
        if (daysSince < 7) return false;
      }
      return true;
    });
    overdue.forEach(inv => {
      api.updateInvoice(workspace.id, inv.id, { lastAutomatedReminderSentAt: now.toISOString() }).then(() => {
        toast.warning(`Overdue: ${inv.clientName} — ${displayCurrency} ${inv.amount?.toLocaleString()} overdue since ${new Date(inv.dueDate).toLocaleDateString()}`);
      });
    });
  }, [workspace?.enableAutomatedReminders, invoices]);

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8">
        <div className="space-y-1">
          <h1 className="text-4xl font-black tracking-tight text-foreground">Dashboard</h1>
          <p className="text-muted-foreground font-medium">Welcome back to {workspace.name}.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {/* Period Selector */}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="outline" className="rounded-2xl h-10 px-4 font-bold text-xs flex items-center gap-2 border-border shadow-sm hover:bg-muted bg-card">
                  <CalendarIcon className="h-4 w-4 text-purple-500" />
                  {period === 'all' ? 'All Time' : 
                   period === 'this-month' ? 'This Month' :
                   period === 'last-month' ? 'Last Month' :
                   period === 'this-year' ? 'This Year' : 'Last 30 Days'}
                  <ChevronDown className="h-3 w-3 opacity-50" />
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="rounded-xl p-2 w-48">
              <DropdownMenuItem onClick={() => onPeriodChange('all')} className="rounded-lg font-medium">All Time</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onPeriodChange('this-month')} className="rounded-lg font-medium">This Month</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onPeriodChange('last-month')} className="rounded-lg font-medium">Last Month</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onPeriodChange('this-year')} className="rounded-lg font-medium">This Year</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onPeriodChange('last-30-days')} className="rounded-lg font-medium">Last 30 Days</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Currency Switcher */}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button 
                  variant="outline" 
                  className="rounded-2xl h-10 px-4 font-bold text-xs flex items-center gap-2 border-border shadow-sm hover:bg-muted bg-card"
                >
                  <span className="text-purple-600">{displayCurrency}</span>
                  <ChevronDown className="h-3 w-3 opacity-50" />
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="rounded-xl p-2 w-32">
              {(['GHS', 'USD', 'GBP', 'EUR'] as Currency[]).map((cur) => (
                <DropdownMenuItem 
                  key={cur} 
                  onClick={() => setDisplayCurrency(cur)}
                  className={cn(
                    "rounded-lg font-medium",
                    displayCurrency === cur && "bg-purple-50 text-purple-600"
                  )}
                >
                  {cur}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <ImportTool workspace={workspace} />
            
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button 
                    variant="outline" 
                    size="icon"
                    className="rounded-2xl h-10 w-10 border-border shadow-sm hover:bg-muted bg-card flex items-center justify-center p-0"
                    title="Export Data"
                  >
                    <Download className="h-4 w-4 text-purple-500" />
                  </Button>
                }
              />
              <DropdownMenuContent align="end" className="rounded-xl p-2 w-40">
                <DropdownMenuItem onClick={() => handleExport('csv')} className="rounded-lg font-medium flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-blue-500" />
                  CSV Format
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport('excel')} className="rounded-lg font-medium flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-emerald-500" />
                  Excel Format
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport('pdf')} className="rounded-lg font-medium flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-rose-500" />
                  PDF Document
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Validation Warning */}
      {balanceMismatch && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 p-4 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-rose-100 flex items-center justify-center">
              <AlertCircle className="h-5 w-5 text-rose-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-rose-900">Financial Mismatch Detected</p>
              <p className="text-xs text-rose-700">One or more of your account balances don't match their transaction history. Sync to correct.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="border-rose-200 text-rose-700 hover:bg-rose-100 rounded-xl font-bold text-[10px] flex items-center gap-1"
              onClick={syncBalances}
            >
              <RefreshCw className="h-3 w-3" />
              Sync Balances
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="border-rose-200 text-rose-700 hover:bg-rose-100 rounded-xl font-bold text-[10px]"
              onClick={() => onNavigate('accounts')}
            >
              Review Accounts
            </Button>
          </div>
        </motion.div>
      )}

      {/* Cash Balance Section */}
      <div className="grid gap-4 md:grid-cols-1 mb-8" id="tour-metrics">
        <Card 
          className="border-border bg-card shadow-sm hover:shadow-md transition-all group overflow-hidden relative cursor-pointer"
          onClick={() => openBreakdown('Cash Position Breakdown', 'transactions', transactions)}
        >
          <div className="absolute top-0 left-0 w-1 h-full bg-purple-600" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="space-y-1">
              <CardTitle className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Total Cash Balance</CardTitle>
              <CardDescription className="text-[10px] font-bold">Sum of all verified account balances</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 rounded-full hover:bg-purple-50 text-purple-600"
                onClick={(e) => {
                  e.stopPropagation();
                  syncBalances();
                }}
                title="Sync balances with transactions"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
              <div className="h-10 w-10 rounded-xl bg-purple-50 flex items-center justify-center">
                <Wallet className="h-5 w-5 text-purple-600" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-1">
              <div className="text-4xl font-black text-foreground tracking-tight">
                {displayCurrency} {allTimeNet.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-100 text-[10px] font-black tracking-wider px-1.5 h-5 rounded-sm">
                  TOTAL LIQUID ASSETS
                </Badge>
                <div className="text-[10px] items-center gap-1 font-bold text-muted-foreground/60 tracking-widest flex hover:text-purple-600 cursor-pointer transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    openBreakdown('Account Balances', 'accounts', accounts);
                  }}
                >
                  <Building2 className="h-3 w-3" />
                  {accounts.length} LINKED ACCOUNTS
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-4 text-[10px] font-bold text-muted-foreground">
              <div className="flex items-center gap-1">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Verified across {accounts.length} accounts
              </div>
              {balanceMismatch && (
                <div className="flex items-center gap-1 text-rose-500 bg-rose-50 px-2 py-1 rounded-full">
                  <AlertCircle className="h-3 w-3" />
                  Mismatch: {displayCurrency} {convert(Math.abs(sumAccounts - allTimeNet)).toLocaleString()} difference
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Financial Core Metrics */}
      <div className={cn("grid gap-4 md:grid-cols-2 mb-8", workspace?.enableInvestments !== false ? "lg:grid-cols-4" : "lg:grid-cols-3")}>
        <Card 
          className="border-border bg-card shadow-sm hover:shadow-md transition-all cursor-pointer group"
          onClick={() => openBreakdown('Income Breakdown', 'transactions', filteredTransactions.filter(t => t.type === 'Income'))}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Total Income</CardTitle>
            <div className="h-8 w-8 rounded-xl bg-emerald-50 flex items-center justify-center group-hover:scale-110 transition-transform">
              <ArrowUpRight className="h-4 w-4 text-emerald-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-black text-foreground">
              {displayCurrency} {revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-[10px] text-muted-foreground font-bold mt-1">Earnings this period</p>
          </CardContent>
        </Card>

        <Card 
          className="border-border bg-card shadow-sm hover:shadow-md transition-all group cursor-pointer"
          onClick={() => openBreakdown('Outgoings Breakdown', 'transactions', filteredTransactions.filter(t => t.type === 'Expense' || t.type === 'Investment'))}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Total Outgoings</CardTitle>
            <div className="h-8 w-8 rounded-xl bg-rose-50 flex items-center justify-center group-hover:scale-110 transition-transform">
              <ArrowDownRight className="h-4 w-4 text-rose-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-black text-rose-500">
              {displayCurrency} {outgoings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-[10px] text-muted-foreground font-bold mt-1">Spent & Invested</p>
          </CardContent>
        </Card>

        <Card 
          className="border-border bg-card shadow-sm hover:shadow-md transition-all group cursor-pointer"
          onClick={() => openBreakdown('Net Flow Breakdown', 'transactions', filteredTransactions)}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Net Cash Flow</CardTitle>
            <div className={cn(
              "h-8 w-8 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform",
              isOverspent ? "bg-rose-50" : "bg-blue-50"
            )}>
              <TrendingUp className={cn("h-4 w-4", isOverspent ? "text-rose-600 rotate-180" : "text-blue-600")} />
            </div>
          </CardHeader>
          <CardContent>
            <div className={cn("text-xl font-black", isOverspent ? "text-rose-500" : "text-blue-600")}>
              {displayCurrency} {netCashFlow.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-[10px] text-muted-foreground font-bold">Inflow vs Outflow</p>
              {savingsRate > 0 && (
                <Badge className="bg-emerald-500/10 text-emerald-600 border-0 text-[10px] font-black py-0 h-4 px-1.5 rounded-sm">
                  {savingsRate.toFixed(1)}% Yield
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {workspace?.enableInvestments !== false && (
        <Card 
          className="border-border bg-card shadow-sm hover:shadow-md transition-all group cursor-pointer"
          onClick={() => openBreakdown('Investment Breakdown', 'transactions', filteredTransactions.filter(t => t.type === 'Investment'))}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Invested</CardTitle>
            <div className="h-8 w-8 rounded-xl bg-purple-50 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Target className="h-4 w-4 text-purple-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-black text-purple-600">
              {displayCurrency} {totalInvested.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-[10px] text-muted-foreground font-bold mt-1">Growing your wealth</p>
          </CardContent>
        </Card>
        )}
      </div>

      {workspace?.enableLoansDebts !== false && (
      <div className="grid gap-4 md:grid-cols-1 mb-8">
        <Card 
          className="border-border bg-card shadow-sm hover:shadow-rose-500/5 transition-all group cursor-pointer"
          onClick={() => openBreakdown('Loans & Debts Breakdown', 'transactions', transactions.filter(t => t.isLoan))}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Loans & Debts</CardTitle>
            <HistoryIcon className="h-4 w-4 text-rose-500" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-black text-foreground">
              {displayCurrency} {(debt + moneyOwedToMe).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="flex items-center gap-4 mt-1">
              <span className="text-[10px] font-bold text-rose-500">Debt (You owe): {displayCurrency} {debt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              <span className="text-[10px] font-bold text-emerald-500">Owed to you: {displayCurrency} {moneyOwedToMe.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          </CardContent>
        </Card>
      </div>
      )}

      {/* Flow Breakdown */}

      {/* INVOICE ANALYTICS */}
      {invoices.length > 0 && (
        <div className="grid gap-4 md:grid-cols-3 mb-8">
          <Card 
            className="border-border bg-card shadow-sm hover:shadow-md transition-all group cursor-pointer"
            onClick={() => openBreakdown('Total Invoiced', 'invoices', filteredInvoices)}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Total Invoiced</CardTitle>
              <div className="h-8 w-8 rounded-xl bg-blue-50 flex items-center justify-center group-hover:scale-110 transition-transform">
                <FileText className="h-4 w-4 text-blue-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-black text-blue-600">
                {displayCurrency} {totalInvoiced.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <p className="text-[10px] text-muted-foreground font-bold mt-1">Total value billed</p>
            </CardContent>
          </Card>

          <Card 
            className="border-border bg-card shadow-sm hover:shadow-md transition-all group cursor-pointer"
            onClick={() => openBreakdown('Outstanding Invoices', 'invoices', filteredInvoices.filter(i => (i.amount || 0) > (i.paidAmount || 0)))}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Outstanding</CardTitle>
              <div className="h-8 w-8 rounded-xl bg-amber-50 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Clock className="h-4 w-4 text-amber-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-black text-amber-600">
                {displayCurrency} {outstandingAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <p className="text-[10px] text-muted-foreground font-bold mt-1">Awaiting collection</p>
            </CardContent>
          </Card>

          <Card className="border-border bg-card shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Collection Rate</CardTitle>
              <div className="h-8 w-8 rounded-xl bg-emerald-50 flex items-center justify-center">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-xl font-black text-emerald-600">
                  {conversionRate.toFixed(1)}%
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-muted-foreground font-bold">Collected: {displayCurrency} {paidAmountTotal.toLocaleString()}</p>
                </div>
              </div>
              <Progress value={conversionRate} className="h-2 bg-emerald-100 mt-2" />
            </CardContent>
          </Card>
        </div>
      )}

      {/* TREND CHART */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-8"
      >
        <Card className="border-border bg-card shadow-sm h-full overflow-hidden relative">
          <CardHeader className="pb-8">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <LineChartIcon className="h-5 w-5 text-purple-500" />
              Cash Balance Trend
            </CardTitle>
            <CardDescription>Daily running balance for the selected period</CardDescription>
          </CardHeader>
          <CardContent className="p-0 h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--popover)', border: '1px solid var(--border)', borderRadius: '8px' }}
                  itemStyle={{ color: 'var(--popover-foreground)' }}
                  formatter={(value: number) => [`${displayCurrency} ${convert(value).toLocaleString()}`, 'Balance']}
                  labelStyle={{ color: 'var(--muted-foreground)' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="balance" 
                  stroke="#8b5cf6" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorBalance)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </motion.div>

      {/* Charts Section */}
      <div className="grid gap-8 grid-cols-1 mt-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Card className="border-border bg-card/50 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-purple-500" />
                Money Flow
              </CardTitle>
              <CardDescription>Income vs Outgoings (Last 6 Months)</CardDescription>
            </CardHeader>
            <CardContent className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border" vertical={false} />
                  <XAxis dataKey="month" stroke="currentColor" className="text-muted-foreground" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="currentColor" className="text-muted-foreground" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'var(--popover)', border: '1px solid var(--border)', borderRadius: '8px' }}
                    itemStyle={{ color: 'var(--popover-foreground)' }}
                    formatter={(value: number) => [`${displayCurrency} ${convert(value).toLocaleString()}`, '']}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '20px' }} />
                  {incomeCategoriesInTrend.map((cat, index) => (
                    <Bar 
                      key={cat} 
                      dataKey={cat} 
                      name={cat} 
                      stackId="income" 
                      fill={COLORS[index % COLORS.length]} 
                      radius={index === incomeCategoriesInTrend.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} 
                      className="cursor-pointer"
                      onClick={(data: any) => {
                        const month = data.month;
                        const category = cat;
                        const items = transactions.filter(t => {
                          try {
                            const tDate = parseLocalDate(t.date);
                            if (isNaN(tDate.getTime())) return false;
                            const m = format(tDate, 'MMM yyyy');
                            const tCat = t.isLoan ? 'Loans' : (t.category || 'Other Income');
                            return m === month && tCat === category;
                          } catch (e) {
                            return false;
                          }
                        });
                        openBreakdown(`${category} - ${month}`, 'transactions', items);
                      }}
                    />
                  ))}
                  <Bar 
                    dataKey="outgoings" 
                    name="Money Out" 
                    fill="#f43f5e" 
                    radius={[4, 4, 0, 0]} 
                    className="cursor-pointer"
                    onClick={(data: any) => {
                      const month = data.month;
                      const items = transactions.filter(t => {
                        try {
                          const tDate = parseLocalDate(t.date);
                          if (isNaN(tDate.getTime())) return false;
                          const m = format(tDate, 'MMM yyyy');
                          return m === month && (t.type === 'Expense' || t.type === 'Investment');
                        } catch (e) {
                          return false;
                        }
                      });
                      openBreakdown(`Outgoings - ${month}`, 'transactions', items);
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        <div className="grid gap-8 md:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <Card className="border-border bg-card/50 shadow-sm h-full">
              <CardHeader>
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-emerald-500" />
                  Where Your Money Comes From
                </CardTitle>
                <CardDescription>Breakdown of income sources</CardDescription>
              </CardHeader>
              <CardContent className="h-[350px] flex flex-col sm:flex-row items-center justify-center gap-8">
                {incomeSourceData.length > 0 ? (
                  <>
                    <div className="w-full h-full max-w-[200px] max-h-[200px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={incomeSourceData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                            animationDuration={1500}
                            className="cursor-pointer"
                            onClick={(data: any) => {
                              const category = data.name;
                              const items = filteredTransactions.filter(t => 
                                t.type === 'Income' && 
                                (t.isLoan ? 'Loans Received' : (t.category || 'Uncategorized')) === category
                              );
                              openBreakdown(`${category} Breakdown`, 'transactions', items);
                            }}
                          >
                            {incomeSourceData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip 
                            contentStyle={{ backgroundColor: 'var(--popover)', border: '1px solid var(--border)', borderRadius: '8px' }}
                            itemStyle={{ color: 'var(--popover-foreground)' }}
                            formatter={(value: number) => [`${displayCurrency} ${convert(value).toLocaleString()}`, '']}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex-1 space-y-2 w-full overflow-y-auto max-h-[250px] pr-2">
                      {incomeSourceData.map((entry, index) => (
                        <div key={entry.name} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <div className="h-3 w-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                            <span className="text-muted-foreground font-medium">{entry.name}</span>
                          </div>
                          <span className="font-bold text-foreground">{displayCurrency} {convert(entry.value).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-20 text-muted-foreground">
                    <TrendingUp className="h-10 w-10 mx-auto mb-2 opacity-20" />
                    <p>No income recorded for this period</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <Card className="border-border bg-card/50 shadow-sm h-full">
              <CardHeader>
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <TrendingDown className="h-5 w-5 text-rose-500" />
                  Where Your Money Goes
                </CardTitle>
                <CardDescription>Breakdown of spending and investments</CardDescription>
              </CardHeader>
              <CardContent className="h-[350px] flex flex-col sm:flex-row items-center justify-center gap-8">
                {moneyOutData.length > 0 ? (
                  <>
                    <div className="w-full h-full max-w-[200px] max-h-[200px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={moneyOutData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                            animationDuration={1500}
                            className="cursor-pointer"
                            onClick={(data: any) => {
                              const category = data.name;
                              const items = filteredTransactions.filter(t => 
                                (t.type === 'Expense' || t.type === 'Investment') && 
                                (t.category || 'Uncategorized') === category
                              );
                              openBreakdown(`${category} Breakdown`, 'transactions', items);
                            }}
                          >
                            {moneyOutData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip 
                            contentStyle={{ backgroundColor: 'var(--popover)', border: '1px solid var(--border)', borderRadius: '8px' }}
                            itemStyle={{ color: 'var(--popover-foreground)' }}
                            formatter={(value: number) => [`${displayCurrency} ${convert(value).toLocaleString()}`, '']}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex-1 space-y-2 w-full overflow-y-auto max-h-[250px] pr-2">
                      {moneyOutData.map((entry, index) => (
                        <div key={entry.name} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <div className="h-3 w-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                            <span className="text-muted-foreground font-medium">{entry.name}</span>
                          </div>
                          <span className="font-bold text-foreground">{displayCurrency} {convert(entry.value).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-20 text-muted-foreground">
                    <TrendingDown className="h-10 w-10 mx-auto mb-2 opacity-20" />
                    <p>No spending recorded for this period</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>

      <div className="grid gap-8 md:grid-cols-3 mt-8">
        {/* Overdue Reminders */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="md:col-span-1"
        >
          <Card 
          className="border-border bg-card/50 shadow-sm hover:shadow-purple-500/5 transition-all group cursor-pointer"
          onClick={() => openBreakdown('Overdue Invoices Breakdown', 'invoices', overdueInvoices)}
        >
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-rose-500" />
              Overdue Invoices
            </CardTitle>
            <Badge variant="destructive" className="rounded-full">{overdueInvoices.length}</Badge>
          </CardHeader>
            <CardContent className="space-y-4">
              {overdueInvoices.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle2 className="h-10 w-10 text-emerald-500/20 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">All caught up!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {overdueInvoices.slice(0, 3).map((invoice) => (
                    <div key={invoice.id} className="flex items-center justify-between p-3 rounded-xl bg-rose-500/5 border border-rose-500/10">
                      <div className="min-w-0">
                        <p className="text-xs font-bold truncate">{invoice.clientName}</p>
                        <p className="text-[10px] text-muted-foreground">
                          Due: {displayCurrency} {convert(invoice.amount - (invoice.paidAmount || 0), invoice.currency).toLocaleString()}
                        </p>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => sendReminder(invoice)} className="h-8 w-8 p-0 rounded-full hover:bg-rose-500 hover:text-white">
                        <Bell className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Sales Target */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="md:col-span-2"
        >
      <Card className="border-border bg-card/50 shadow-sm h-full cursor-pointer hover:bg-muted/5 transition-colors" onClick={() => openBreakdown('Sales Breakdown', 'transactions', filteredTransactions.filter(t => t.type === 'Income'))}>
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-purple-500" />
              Sales Target
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={(e) => {
                e.stopPropagation();
                window.dispatchEvent(new CustomEvent('change-tab', { detail: 'settings' }));
              }}
              className="h-8 text-[10px] font-black uppercase tracking-widest text-purple-600"
            >
              Adjust
            </Button>
          </CardTitle>
          <CardDescription>Target for real sales (no loans)</CardDescription>
        </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-2xl font-bold text-foreground">{displayCurrency} {revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  <p className="text-sm text-muted-foreground">Current Sales</p>
                </div>
                <div className="text-right space-y-1">
                  <p className="text-2xl font-bold text-muted-foreground">{displayCurrency} {convert(salesTarget).toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground">Target</p>
                </div>
              </div>
              <Progress value={salesTarget > 0 ? (revenue / convert(salesTarget)) * 100 : 0} className="h-3 bg-purple-100" />
              <p className="text-xs text-muted-foreground text-center">
                {salesTarget > 0 ? Math.round((revenue / convert(salesTarget)) * 100) : 0}% of your target reached
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Breakdown Dialog */}
      <Dialog open={!!breakdown} onOpenChange={(open) => !open && setBreakdown(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col p-0 overflow-hidden rounded-3xl border-none shadow-2xl">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle className="text-2xl font-black tracking-tight">{breakdown?.title}</DialogTitle>
            <DialogDescription className="text-xs font-bold uppercase tracking-widest text-muted-foreground/50">
              Detailed breakdown of underlying data
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto p-6 pt-2">
            {breakdown?.type === 'accounts' && (
              <div className="space-y-3">
                {breakdown.items.map((account: Account) => (
                  <div key={account.id} className="flex items-center justify-between p-4 rounded-2xl bg-muted/30 border border-border/50">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-purple-50 flex items-center justify-center">
                        <Building2 className="h-5 w-5 text-purple-600" />
                      </div>
                      <div>
                        <p className="font-bold text-sm">{account.name}</p>
                        <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">{account.currency}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-sm">{displayCurrency} {convert(account.balance, account.currency as Currency).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                      {account.currency !== displayCurrency && (
                        <p className="text-[10px] text-muted-foreground font-bold">Original: {account.currency} {account.balance.toLocaleString()}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {breakdown?.type === 'transactions' && (
              <div className="space-y-3">
                {breakdown.items.map((t: Transaction) => (
                  <div key={t.id} className="flex items-center justify-between p-4 rounded-2xl bg-muted/30 border border-border/50">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "h-10 w-10 rounded-xl flex items-center justify-center",
                        t.type === 'Income' ? "bg-emerald-50 text-emerald-600" : 
                        t.type === 'Expense' ? "bg-rose-50 text-rose-600" : "bg-purple-50 text-purple-600"
                      )}>
                        {t.type === 'Income' ? <TrendingUp className="h-5 w-5" /> : 
                         t.type === 'Expense' ? <TrendingDown className="h-5 w-5" /> : <Target className="h-5 w-5" />}
                      </div>
                      <div>
                        <p className="font-bold text-sm truncate max-w-[200px]">{t.description || t.category}</p>
                        <p className="text-[10px] text-muted-foreground font-bold">{t.date} • {t.category}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={cn(
                        "font-black text-sm",
                        t.type === 'Income' ? "text-emerald-600" : 
                        t.type === 'Expense' ? "text-rose-600" : "text-purple-600"
                      )}>
                        {t.type === 'Income' ? '+' : '-'}{displayCurrency} {convert(t.amount, t.currency).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </p>
                      {t.currency !== displayCurrency && (
                        <p className="text-[10px] text-muted-foreground font-bold">{t.currency} {t.amount.toLocaleString()}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {breakdown?.type === 'invoices' && (
              <div className="space-y-3">
                {breakdown.items.map((i: Invoice) => (
                  <div key={i.id} className="flex items-center justify-between p-4 rounded-2xl bg-muted/30 border border-border/50">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-bold text-sm">{i.clientName}</p>
                        <p className="text-[10px] text-muted-foreground font-bold">
                          Due: {(() => {
                            try {
                              if (!i.dueDate) return 'No Due Date';
                              const parsed = parseLocalDate(i.dueDate);
                              return isNaN(parsed.getTime()) ? 'N/A' : format(parsed, 'MMM d, yyyy');
                            } catch (e) {
                              return 'N/A';
                            }
                          })()} • {i.status}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-sm">{displayCurrency} {convert(i.amount, i.currency).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                      <p className="text-[10px] text-muted-foreground font-bold">Paid: {displayCurrency} {convert(i.paidAmount || 0, i.currency).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {breakdown?.items.length === 0 && (
              <div className="text-center py-12">
                <AlertCircle className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
                <p className="text-muted-foreground font-bold">No data found for this breakdown</p>
              </div>
            )}
          </div>

          <div className="p-6 border-t border-border bg-muted/20 flex justify-between items-center">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">
              {breakdown?.items.length} items total
            </p>
            <Button 
              variant="outline" 
              size="sm" 
              className="rounded-xl font-bold text-xs"
              onClick={() => {
                const type = breakdown?.type;
                setBreakdown(null);
                if (type === 'transactions') onNavigate('transactions');
                if (type === 'accounts') onNavigate('accounts');
                if (type === 'invoices') onNavigate('invoices');
              }}
            >
              View Full List
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
