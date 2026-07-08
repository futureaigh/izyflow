import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from './ui/sheet';
import { ScrollArea } from './ui/scroll-area';
import { Transaction, Account } from '../types';
import { format } from 'date-fns';
import { Badge } from './ui/badge';
import { cn, parseLocalDate } from '../lib/utils';
import { ArrowUpRight, ArrowDownRight, ArrowLeftRight } from 'lucide-react';

interface AccountTransactionsSheetProps {
  account: Account | null;
  transactions: Transaction[];
  accountBalance: number;
  open: boolean;
  onClose: () => void;
}

export default function AccountTransactionsSheet({
  account,
  transactions,
  accountBalance,
  open,
  onClose
}: AccountTransactionsSheetProps) {
  const accountTransactions = transactions.filter(
    tx => tx.accountId === account?.id || (!tx.accountId && (tx.category === account?.name || tx.description?.includes(account?.name || '')))
  );

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-md bg-background border-border text-foreground">
        <SheetHeader className="mb-6">
          <SheetTitle className="text-2xl font-bold text-foreground">{account?.name}</SheetTitle>
          <SheetDescription className="text-muted-foreground">
            Current Balance: <span className="text-foreground font-semibold">{accountBalance.toLocaleString()}</span>
          </SheetDescription>
        </SheetHeader>
        
        <ScrollArea className="h-[calc(100vh-200px)] pr-4">
          <div className="space-y-4">
            {accountTransactions.length === 0 ? (
              <div className="text-center py-20 text-muted-foreground">
                No transactions found for this account.
              </div>
            ) : (
              accountTransactions.map((tx) => (
                <div 
                  key={tx.id} 
                  className="flex items-center justify-between p-4 rounded-xl border border-border bg-card/50"
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "p-2 rounded-lg",
                      tx.type === 'Income' ? "bg-emerald-500/10 text-emerald-500" : 
                      tx.type === 'Expense' ? "bg-rose-500/10 text-rose-500" : 
                      "bg-muted text-muted-foreground"
                    )}>
                      {tx.type === 'Income' ? <ArrowUpRight className="h-4 w-4" /> : 
                       tx.type === 'Expense' ? <ArrowDownRight className="h-4 w-4" /> : 
                       <ArrowLeftRight className="h-4 w-4" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{tx.category}</p>
                      <p className="text-xs text-muted-foreground">
                        {(() => {
                          try {
                            const tDate = parseLocalDate(tx.date);
                            if (isNaN(tDate.getTime())) return tx.date || 'N/A';
                            return format(tDate, 'MMM d, yyyy');
                          } catch (e) {
                            return tx.date || 'N/A';
                          }
                        })()}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={cn(
                      "text-sm font-bold",
                      tx.type === 'Income' ? "text-emerald-500" : 
                      tx.type === 'Expense' ? "text-rose-500" : 
                      "text-muted-foreground"
                    )}>
                      {tx.type === 'Income' ? '+' : tx.type === 'Expense' ? '-' : ''} {tx.amount.toLocaleString()}
                    </p>
                    {tx.description && (
                      <p className="text-[10px] text-muted-foreground truncate max-w-[100px]">{tx.description}</p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
