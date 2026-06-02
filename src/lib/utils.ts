import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { parseISO } from "date-fns"
import { Transaction } from "../types"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function parseLocalDate(dateStr: string | null | undefined) {
  if (!dateStr) return new Date(NaN);
  
  // Handle YYYY-MM-DD
  if (dateStr.length === 10 && dateStr.includes('-')) {
    const [y, m, d] = dateStr.split('-').map(Number);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
      return new Date(y, m - 1, d);
    }
  }
  
  // Fallback to parseISO for full strings or other formats
  return parseISO(dateStr);
}

export function getFinancialFlags(t: Partial<Transaction>) {
  const type = t.type;
  const isLoan = t.isLoan || false;
  const loanStatus = t.loanStatus || 'Loan';

  return {
    // Transfers don't affect net cash flow.
    affects_cash: type !== 'Transfer',
    
    // Profit only includes income/expenses that are NOT loans or repayments.
    affects_profit: (type === 'Income' || type === 'Expense') && 
                    !isLoan && 
                    loanStatus !== 'Loan' && 
                    loanStatus !== 'Repayment',
    
    affects_investment: type === 'Investment',
    
    // Debt is affected by any transaction marked as a loan or repayment.
    affects_debt: isLoan === true
  };
}
