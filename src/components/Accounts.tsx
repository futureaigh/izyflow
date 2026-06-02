import { useEffect, useState, useMemo } from 'react';
import { api } from '../lib/api';
import { Workspace, Account, Transaction, AllocationRule, Currency } from '../types';
import { Wallet, Plus, Edit, Trash2, Loader2, Calendar as CalendarIcon, ChevronDown, Filter } from 'lucide-react';
import AccountTransactionsSheet from './AccountTransactionsSheet';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { cn, parseLocalDate } from '../lib/utils';
import { toast } from 'sonner';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { format, startOfMonth, endOfMonth, subDays, startOfYear, endOfYear, isWithinInterval } from 'date-fns';

type Period = 'all' | 'this-month' | 'last-month' | 'this-year' | 'last-30-days';

interface AccountsProps {
  workspace: Workspace | null;
  accounts: Account[];
  transactions: Transaction[];
  allocationRules: AllocationRule[];
  loading: boolean;
}

export function Accounts({ 
  workspace,
  accounts: propAccounts,
  transactions: propTransactions,
  allocationRules: propAllocationRules,
  loading: propLoading
}: AccountsProps) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [allocationRules, setAllocationRules] = useState<AllocationRule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (propAccounts) setAccounts(propAccounts);
    if (propTransactions) setTransactions(propTransactions);
    if (propAllocationRules) setAllocationRules(propAllocationRules);
    setLoading(propLoading);
  }, [propAccounts, propTransactions, propAllocationRules, propLoading]);
  const [editAccount, setEditAccount] = useState<Account | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', isDefault: false });
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [period, setPeriod] = useState<Period>('all');

  useEffect(() => {
    if (!workspace) return;
  }, [workspace]);

  // Period Filtering Logic
  const filteredTransactions = useMemo(() => {
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
      try {
        const tDate = parseLocalDate(t.date);
        return !isNaN(tDate.getTime()) && isWithinInterval(tDate, { start, end });
      } catch (e) {
        return false;
      }
    });
  }, [transactions, period]);

  // Calculate balance: only completed transactions, income minus expenses (net)
  const { balances, unallocatedBalance, allTimeBalances, allTimeUnallocated } = useMemo(() => {
    const map: Record<string, number> = {};
    const allTimeMap: Record<string, number> = {};
    accounts.forEach(a => { 
      map[a.id] = 0; 
      allTimeMap[a.id] = 0;
    });
    let unallocated = 0;
    let allTimeUnallocatedVal = 0;

    // Calculate All-Time Balances first
    transactions.forEach(tx => {
      const amount = tx.amount || 0;
      const isOutflow = tx.type === 'Expense' || tx.type === 'Investment';
      const isInflow = tx.type === 'Income';

      if (tx.accountId === 'auto-allocate') {
        allocationRules.forEach(rule => {
          const allocationAmount = (amount * rule.percentage) / 100;
          if (allTimeMap[rule.targetAccountId] !== undefined) {
            allTimeMap[rule.targetAccountId] += allocationAmount;
          }
        });
        const totalPercentage = allocationRules.reduce((sum, r) => sum + r.percentage, 0);
        if (totalPercentage < 100) {
          allTimeUnallocatedVal += (amount * (100 - totalPercentage)) / 100;
        }
      } else if (tx.accountId && allTimeMap[tx.accountId] !== undefined) {
        if (isInflow) allTimeMap[tx.accountId] += amount;
        else if (isOutflow) allTimeMap[tx.accountId] -= amount;
      } else {
        const matchedAccount = accounts.find(a => 
          tx.category === a.name || 
          tx.description?.toLowerCase().includes(a.name.toLowerCase()) ||
          tx.payeePayer?.toLowerCase().includes(a.name.toLowerCase())
        );
        if (matchedAccount) {
          if (isInflow) allTimeMap[matchedAccount.id] += amount;
          else if (isOutflow) allTimeMap[matchedAccount.id] -= amount;
        } else {
          if (isInflow) allTimeUnallocatedVal += amount;
          else if (isOutflow) allTimeUnallocatedVal -= amount;
        }
      }
    });

    // Calculate Period Balances
    filteredTransactions.forEach(tx => {
      const amount = tx.amount || 0;
      const isOutflow = tx.type === 'Expense' || tx.type === 'Investment';
      const isInflow = tx.type === 'Income';

      if (tx.accountId === 'auto-allocate') {
        allocationRules.forEach(rule => {
          const allocationAmount = (amount * rule.percentage) / 100;
          if (map[rule.targetAccountId] !== undefined) {
            map[rule.targetAccountId] += allocationAmount;
          }
        });
        const totalPercentage = allocationRules.reduce((sum, r) => sum + r.percentage, 0);
        if (totalPercentage < 100) {
          unallocated += (amount * (100 - totalPercentage)) / 100;
        }
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
        } else {
          if (isInflow) unallocated += amount;
          else if (isOutflow) unallocated -= amount;
        }
      }
    });
    return { 
      balances: map, 
      unallocatedBalance: unallocated,
      allTimeBalances: allTimeMap,
      allTimeUnallocated: allTimeUnallocatedVal
    };
  }, [accounts, transactions, filteredTransactions, allocationRules]);

  const totalBalance = Object.values(balances).reduce((s, b) => s + b, 0) + unallocatedBalance;
  const allTimeTotal = Object.values(allTimeBalances).reduce((s, b) => s + b, 0) + allTimeUnallocated;

  const openEdit = (account: Account) => {
    setEditAccount(account);
    setForm({ name: account.name, isDefault: account.isDefault || false });
    setShowForm(true);
  };

  const openNew = () => {
    setEditAccount(null);
    setForm({ name: '', isDefault: false });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!workspace) return;
    if (!form.name.trim()) { toast.error('Name required'); return; }
    
    try {
      if (editAccount) {
        await api.updateAccount(workspace.id, editAccount.id, {
          name: form.name,
          isDefault: form.isDefault
        });
        toast.success('Account updated');
      } else {
        await api.createAccount(workspace.id, {
          id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2),
          workspaceId: workspace.id,
          name: form.name,
          balance: 0,
          currency: workspace.currency,
          isDefault: form.isDefault
        });
        toast.success('Account created');
      }
      setShowForm(false);
      window.dispatchEvent(new CustomEvent('refresh-data'));
    } catch (error) {
      toast.error('Failed to save account');
    }
  };

  const handleDelete = async (id: string) => {
    if (!workspace) return;
    try {
      await api.deleteAccount(workspace.id, id);
      toast.success('Account deleted');
      window.dispatchEvent(new CustomEvent('refresh-data'));
    } catch (error) {
      toast.error('Failed to delete account');
    }
  };

  if (!workspace) return null;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h2 className="text-4xl font-black tracking-tight text-foreground">Accounts</h2>
          <p className="text-muted-foreground font-medium">Manage your internal financial accounts</p>
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
              <DropdownMenuItem onClick={() => setPeriod('all')} className="rounded-lg font-medium">All Time</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setPeriod('this-month')} className="rounded-lg font-medium">This Month</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setPeriod('last-month')} className="rounded-lg font-medium">Last Month</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setPeriod('this-year')} className="rounded-lg font-medium">This Year</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setPeriod('last-30-days')} className="rounded-lg font-medium">Last 30 Days</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button onClick={openNew} className="rounded-2xl h-10 px-6 bg-purple-600 hover:bg-purple-700 text-white font-bold shadow-lg shadow-purple-500/20">
            <Plus className="mr-2 h-4 w-4" /> Add Account
          </Button>
        </div>
      </div>

      {/* Total Balance Card */}
      <Card className="border-border bg-card/50 shadow-sm overflow-hidden relative group">
        <div className="absolute top-0 left-0 w-1 h-full bg-purple-600" />
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-baseline gap-8">
            <div className="space-y-1">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">
                {period === 'all' ? 'Total Net Worth' : 'Net Change for Period'}
              </p>
              <div className="flex items-baseline gap-2">
                <p className={cn(
                  "text-4xl font-black tracking-tight tabular-nums",
                  totalBalance >= 0 ? "text-foreground" : "text-rose-500"
                )}>
                  {workspace.currency} {totalBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
                {period !== 'all' && (
                  <Badge variant="outline" className={cn(
                    "text-[10px] font-bold",
                    totalBalance >= 0 ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-rose-50 text-rose-700 border-rose-100"
                  )}>
                    {totalBalance >= 0 ? 'Surplus' : 'Deficit'}
                  </Badge>
                )}
              </div>
            </div>

            {period !== 'all' && (
              <>
                <div className="h-12 w-px bg-border hidden md:block" />
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Current Total Balance</p>
                  <p className="text-xl font-black text-muted-foreground/60 tracking-tight">
                    {workspace.currency} {allTimeTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Account Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {accounts.map(acc => (
          <div 
            key={acc.id} 
            className="bg-card/50 rounded-3xl border border-border p-6 hover:border-purple-500/50 hover:shadow-xl hover:shadow-purple-500/5 transition-all group cursor-pointer relative overflow-hidden flex flex-col" 
            onClick={() => setSelectedAccount(acc)}
          >
            <div className="flex items-start justify-between mb-6">
              <div className="h-12 w-12 rounded-2xl bg-purple-50 flex items-center justify-center border border-purple-100">
                <Wallet className="h-6 w-6 text-purple-600" />
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-muted-foreground hover:text-purple-600 hover:bg-purple-50" onClick={() => openEdit(acc)}>
                  <Edit className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-muted-foreground hover:text-rose-600 hover:bg-rose-50" onClick={() => handleDelete(acc.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-1">
              <h3 className="text-xl font-black text-foreground tracking-tight">{acc.name}</h3>
              <div className="flex items-center gap-2">
                <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">{acc.currency}</p>
                {acc.isDefault && (
                  <Badge variant="outline" className="text-[10px] font-bold border-emerald-500/50 text-emerald-500 bg-emerald-500/5 px-1.5 py-0">
                    Default
                  </Badge>
                )}
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-border/50 space-y-4">
              <div>
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">
                  {period === 'all' ? 'Current Balance' : 'Net Change'}
                </p>
                <p className={cn(
                  'text-3xl font-black tracking-tighter tabular-nums',
                  (balances[acc.id] || 0) >= 0 ? 'text-foreground' : 'text-rose-500'
                )}>
                  {workspace.currency} {(balances[acc.id] || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
              </div>

              {period !== 'all' && (
                <div>
                  <p className="text-[10px] font-black text-muted-foreground/50 uppercase tracking-widest mb-1">Actual Balance</p>
                  <p className="text-sm font-bold text-muted-foreground/60">
                    {workspace.currency} {(allTimeBalances[acc.id] || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                </div>
              )}
            </div>

            <div className="mt-auto pt-4 flex items-center gap-1 text-[10px] font-bold text-purple-600/50 group-hover:text-purple-600 transition-colors">
              <Plus className="h-3 w-3" />
              View Transactions
            </div>
          </div>
        ))}

        {unallocatedBalance !== 0 && (
          <div className="bg-muted/10 rounded-3xl border border-dashed border-border p-6 relative overflow-hidden flex flex-col">
            <div className="flex items-start justify-between mb-6">
              <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center border border-border">
                <Wallet className="h-6 w-6 text-muted-foreground opacity-30" />
              </div>
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-black text-muted-foreground/70 tracking-tight">Unallocated Cash</h3>
              <Badge variant="outline" className="text-[10px] font-bold">
                Auto-calculated
              </Badge>
            </div>
            
            <div className="mt-6 pt-6 border-t border-border/50 space-y-4">
              <div>
                <p className="text-[10px] font-black text-muted-foreground/50 uppercase tracking-widest mb-1">
                  {period === 'all' ? 'Balance' : 'Net Change'}
                </p>
                <p className={cn(
                  'text-3xl font-black tracking-tighter tabular-nums',
                  unallocatedBalance >= 0 ? 'text-muted-foreground/70' : 'text-rose-500/50'
                )}>
                  {workspace.currency} {unallocatedBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
              </div>

              {period !== 'all' && (
                <div>
                  <p className="text-[10px] font-black text-muted-foreground/30 uppercase tracking-widest mb-1">Actual Total</p>
                  <p className="text-sm font-bold text-muted-foreground/40">
                    {workspace.currency} {allTimeUnallocated.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
        {accounts.length === 0 && (
          <div className="col-span-full py-20 text-center border border-dashed border-border rounded-2xl">
            <p className="text-muted-foreground">No accounts created yet.</p>
            <Button variant="link" onClick={openNew}>Create your first account</Button>
          </div>
        )}
      </div>

      {/* Transaction Drill-down */}
      <AccountTransactionsSheet
        account={selectedAccount}
        transactions={transactions}
        accountBalance={balances[selectedAccount?.id || ''] || 0}
        open={!!selectedAccount}
        onClose={() => setSelectedAccount(null)}
      />

      {/* Edit Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-sm bg-popover border-border text-popover-foreground">
          <DialogHeader>
            <DialogTitle className="text-foreground">{editAccount ? 'Edit Account' : 'New Account'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label className="text-muted-foreground">Account Name</Label>
              <Input 
                value={form.name} 
                onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))} 
                className="bg-background border-border text-foreground"
                placeholder="e.g. Main Savings, Petty Cash"
              />
            </div>
            <div className="flex items-center justify-between p-4 rounded-xl bg-muted border border-border">
              <div className="space-y-0.5">
                <Label className="text-foreground">Default Account</Label>
                <p className="text-xs text-muted-foreground">Use this for primary transactions</p>
              </div>
              <Switch checked={form.isDefault} onCheckedChange={v => setForm(prev => ({ ...prev, isDefault: v }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)} className="border-border text-muted-foreground hover:bg-accent">
              Cancel
            </Button>
            <Button onClick={handleSave}>
              Save Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
