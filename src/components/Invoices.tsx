import { useEffect, useState, useMemo } from 'react';
import { Workspace, Invoice, InvoiceItem, Account, AllocationRule, Transaction, InvoiceStatus, TransactionType } from '../types';
import { cn, parseLocalDate } from '../lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from './ui/dialog';
import { Plus, Trash2, FileText, Send, CheckCircle2, AlertCircle, Loader2, Download, FileSpreadsheet, Zap, Edit, Receipt, History, CreditCard, Printer, LayoutGrid, Clock, Search, Eye, Bot, BookOpen, Calendar, Users, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { exportToCSV, exportToExcel, exportToPDF, generateInvoicePDF, generateReceiptPDF } from '../lib/dataEngine';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from './ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from './ui/dropdown-menu';
import { Catalog } from './Catalog';
import { CatalogItem } from '../types';
import { api } from '../lib/api';

interface InvoicesProps {
  workspace: Workspace | null;
  initialFilters?: {
    status?: string;
    search?: string;
  };
  invoices: Invoice[];
  accounts: Account[];
  allocationRules: AllocationRule[];
  loading: boolean;
}

export function Invoices({ 
  workspace, 
  initialFilters,
  invoices: propInvoices,
  accounts: propAccounts,
  allocationRules: propRules,
  loading: propLoading
}: InvoicesProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (propInvoices) setInvoices(propInvoices);
    setLoading(propLoading);
  }, [propInvoices, propLoading]);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isRecordingPayment, setIsRecordingPayment] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isSelectingFromCatalog, setIsSelectingFromCatalog] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>('');
const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [scenario, setScenario] = useState('');
  
  // New/Edit Invoice State
  const [clientName, setClientName] = useState('');
  const [clientBusinessName, setClientBusinessName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [title, setTitle] = useState('');
  const [introduction, setIntroduction] = useState('');
  const [items, setItems] = useState<InvoiceItem[]>([{ name: '', description: '', quantity: 1, price: 0 }]);
  const [dueDate, setDueDate] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('Due on Receipt');
  const [discountType, setDiscountType] = useState<'percentage' | 'flat'>('percentage');
  const [discountValue, setDiscountValue] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [clientSearchOpen, setClientSearchOpen] = useState(false);
  const [businessSearchOpen, setBusinessSearchOpen] = useState(false);

  const uniqueClients = useMemo(() => {
    return Array.from(new Map(invoices.map(inv => [inv.clientName.toLowerCase(), inv])).values())
      .filter(inv => inv.clientName)
      .sort((a, b) => a.clientName.localeCompare(b.clientName));
  }, [invoices]);

  const uniqueBusinesses = useMemo(() => {
    return Array.from(new Map(invoices.map(inv => [inv.clientBusinessName?.toLowerCase(), inv])).values())
      .filter(inv => inv.clientBusinessName)
      .sort((a, b) => (a.clientBusinessName || '').localeCompare(b.clientBusinessName || ''));
  }, [invoices]);

  const filteredClients = useMemo(() => {
    if (!clientName.trim()) return uniqueClients.slice(0, 8);
    return uniqueClients.filter(c => 
      c.clientName.toLowerCase().includes(clientName.toLowerCase())
    ).slice(0, 8);
  }, [clientName, uniqueClients]);

  const filteredBusinesses = useMemo(() => {
    if (!clientBusinessName.trim()) return uniqueBusinesses.slice(0, 8);
    return uniqueBusinesses.filter(b => 
      (b.clientBusinessName || '').toLowerCase().includes(clientBusinessName.toLowerCase())
    ).slice(0, 8);
  }, [clientBusinessName, uniqueBusinesses]);

  const selectClient = (client: Invoice) => {
    setClientName(client.clientName);
    setClientBusinessName(client.clientBusinessName || '');
    setClientEmail(client.clientEmail || '');
    setClientPhone(client.clientPhone || '');
    setClientSearchOpen(false);
    setBusinessSearchOpen(false);
    toast.info(`Selected client: ${client.clientName}`);
  };

  useEffect(() => {
    if (initialFilters) {
      if (initialFilters.status) setActiveTab(initialFilters.status.toLowerCase());
      if (initialFilters.search) setSearchQuery(initialFilters.search);
    }
  }, [initialFilters]);

  useEffect(() => {
    const handleCreateInvoiceWithItem = (event: any) => {
      const item = event.detail as CatalogItem;
      setItems([{ 
        name: item.name, 
        description: item.description, 
        quantity: 1, 
        price: item.price 
      }]);
      setIsCreating(true);
    };

    window.addEventListener('create-invoice-with-item', handleCreateInvoiceWithItem);
    return () => window.removeEventListener('create-invoice-with-item', handleCreateInvoiceWithItem);
  }, []);

  useEffect(() => {
    if (!workspace) return;
    // Removed redundant onSnapshot listener
  }, [workspace]);

  const addItem = () => setItems([...items, { name: '', description: '', quantity: 1, price: 0 }]);
  const removeItem = (index: number) => setItems(items.filter((_, i) => i !== index));
  const updateItem = (index: number, field: keyof InvoiceItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value } as any;
    setItems(newItems);
  };

  const calculateSubtotal = () => items.reduce((acc, item) => acc + (item.quantity * item.price), 0);

  const calculateDiscountAmount = () => {
    const subtotal = calculateSubtotal();
    const val = Number(discountValue) || 0;
    if (discountType === 'percentage') {
      return (subtotal * val) / 100;
    }
    return val;
  };

  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    const discount = calculateDiscountAmount();
    return Math.max(0, subtotal - discount);
  };

  const handleScenarioSubmit = () => {
    if (!scenario.trim()) return;
    
    toast.success("Scenario Sent!", {
      description: <span className="text-slate-700 font-medium">Izy is processing your invoice details now.</span>,
      icon: <Zap className="h-4 w-4 text-blue-600" />,
      className: "bg-white border-2 border-blue-600 text-slate-900 font-bold shadow-2xl",
    });

    setScenario('');
    window.dispatchEvent(new CustomEvent('open-izy-with-scenario', { detail: scenario }));
  };

  const createInvoice = async () => {
    if (!workspace) return;
    if (!clientName.trim()) {
      toast.error('Please enter a client name');
      return;
    }
    if (items.some(item => !item.name.trim())) {
      toast.error('Please provide a name for all items');
      return;
    }

    try {
      let parsedDueDateStr = '';
      if (dueDate) {
        const parsedDueDate = new Date(dueDate);
        if (isNaN(parsedDueDate.getTime())) {
          toast.error('Invalid due date');
          return;
        }
        parsedDueDateStr = parsedDueDate.toISOString();
      }

      const subtotalVal = calculateSubtotal();
      const discountValNum = Number(discountValue) || 0;

      const invoiceData = {
        clientName: clientName.trim(),
        clientBusinessName: clientBusinessName.trim(),
        clientEmail: clientEmail.trim(),
        clientPhone: clientPhone.trim(),
        title: title.trim(),
        introduction: introduction.trim(),
        amount: calculateTotal(),
        subtotal: subtotalVal,
        paymentTerms,
        discountType,
        discountValue: discountValNum,
        dueDate: parsedDueDateStr,
        items,
        notes: notes.trim(),
        updatedAt: new Date().toISOString(),
      };

      if (editingInvoice) {
        await api.updateInvoice(workspace.id, editingInvoice.id, invoiceData);
        toast.success('Invoice updated');
      } else {
        const id = crypto.randomUUID();
        await api.createInvoice(workspace.id, {
          ...invoiceData,
          id,
          workspaceId: workspace.id,
          currency: workspace.currency,
          status: 'Draft',
          createdAt: new Date().toISOString(),
          paidAmount: 0,
        });
        toast.success('Invoice created');
      }
      setIsCreating(false);
      setIsEditing(false);
      setEditingInvoice(null);
      resetForm();
      window.dispatchEvent(new CustomEvent('refresh-data'));
    } catch (error) {
      console.error('Invoice error:', error);
      toast.error(editingInvoice ? 'Failed to update invoice' : 'Failed to create invoice');
    }
  };

  const resetForm = () => {
    setClientName('');
    setClientBusinessName('');
    setClientEmail('');
    setClientPhone('');
    setTitle('');
    setIntroduction('');
    setItems([{ name: '', description: '', quantity: 1, price: 0 }]);
    setDueDate('');
    setPaymentTerms('Due on Receipt');
    setDiscountType('percentage');
    setDiscountValue('');
    setNotes('');
  };

  const startCopy = (invoice: Invoice) => {
    setEditingInvoice(null);
    setClientName(invoice.clientName);
    setClientBusinessName(invoice.clientBusinessName || '');
    setClientEmail(invoice.clientEmail || '');
    setClientPhone(invoice.clientPhone || '');
    setTitle(invoice.title || '');
    setIntroduction(invoice.introduction || '');
    setItems(invoice.items.map(i => ({ ...i })));
    setPaymentTerms(invoice.paymentTerms || 'Due on Receipt');
    setDiscountType(invoice.discountType || 'percentage');
    setDiscountValue(invoice.discountValue !== undefined && invoice.discountValue > 0 ? invoice.discountValue.toString() : '');
    setNotes(invoice.notes || '');
    try {
      setDueDate(invoice.dueDate ? format(parseISO(invoice.dueDate), 'yyyy-MM-dd') : '');
    } catch (e) {
      setDueDate('');
    }
    setIsCreating(true);
  };

  const startEditing = (invoice: Invoice) => {
    setEditingInvoice(invoice);
    setClientName(invoice.clientName);
    setClientBusinessName(invoice.clientBusinessName || '');
    setClientEmail(invoice.clientEmail || '');
    setClientPhone(invoice.clientPhone || '');
    setTitle(invoice.title || '');
    setIntroduction(invoice.introduction || '');
    setItems(invoice.items);
    setPaymentTerms(invoice.paymentTerms || 'Due on Receipt');
    setDiscountType(invoice.discountType || 'percentage');
    setDiscountValue(invoice.discountValue !== undefined && invoice.discountValue > 0 ? invoice.discountValue.toString() : '');
    setNotes(invoice.notes || '');
    try {
      setDueDate(invoice.dueDate ? format(parseISO(invoice.dueDate), 'yyyy-MM-dd') : '');
    } catch (e) {
      setDueDate('');
    }
    setIsEditing(true);
  };

  const recordPayment = async () => {
    if (!workspace || !editingInvoice || !paymentAmount || isSubmitting) return;
    const amountNum = Number(paymentAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error('Invalid payment amount');
      return;
    }

    const invoiceTotal = Number(editingInvoice.amount || 0);
    const paidSoFar = Number(editingInvoice.paidAmount || 0);
    const remainingToPayFull = Number((invoiceTotal - paidSoFar).toFixed(2));

    if (amountNum > remainingToPayFull + 0.05) {
      toast.error(`Amount exceeds remaining balance (${workspace.currency} ${remainingToPayFull.toLocaleString()})`);
      return;
    }

    setIsSubmitting(true);

    try {
      const accounts = propAccounts;
      const rules = propRules;
      const defaultAccount = accounts.find(a => a.isDefault) || accounts[0];

      await api.recordPayment(workspace.id, editingInvoice.id, {
        amount: amountNum,
        date: paymentDate,
        accountId: rules.length > 0 ? 'auto-allocate' : (defaultAccount?.id || ''),
      });

      toast.success('Payment Recorded Successfully', {
        description: `${workspace.currency} ${amountNum.toLocaleString()} applied to Invoice #${editingInvoice.id.slice(-6).toUpperCase()}`,
        className: 'bg-emerald-50 border-emerald-200 text-emerald-900',
      });

      setIsRecordingPayment(false);
      setEditingInvoice(null);
      setPaymentAmount('');
      setPaymentDate(new Date().toISOString().split('T')[0]);
      window.dispatchEvent(new CustomEvent('refresh-data'));
    } catch (error: any) {
      console.error('Record payment failed:', error);
      toast.error('Failed to record payment', {
        description: error.message || 'Please check your connection.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const generateReceipt = (invoice: Invoice) => {
    if (!workspace) return;
    generateReceiptPDF(invoice, workspace);
    toast.success('Receipt generated');
  };

  const generateInvoice = (invoice: Invoice) => {
    if (!workspace) return;
    generateInvoicePDF(invoice, workspace);
    toast.success('Invoice PDF generated');
  };

  const markAsPaid = async (invoice: Invoice) => {
    if (!workspace || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const accounts = propAccounts;
      const rules = propRules;
      const defaultAccount = accounts.find(a => a.isDefault) || accounts[0];
      const remainingToPay = Number((invoice.amount - (invoice.paidAmount || 0)).toFixed(2));

      await api.recordPayment(workspace.id, invoice.id, {
        amount: remainingToPay > 0 ? remainingToPay : 0,
        date: new Date().toISOString().split('T')[0],
        accountId: rules.length > 0 ? 'auto-allocate' : (defaultAccount?.id || ''),
      });

      toast.success(`Invoice marked as paid. ${workspace.currency} ${remainingToPay.toLocaleString()} processed.`);
      window.dispatchEvent(new CustomEvent('refresh-data'));
    } catch (error: any) {
      console.error('Mark as paid failed:', error);
      toast.error('Failed to mark as paid', {
        description: error.message || 'Please check your connection.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const markAsSent = async (invoice: Invoice) => {
    if (!workspace) return;
    try {
      await api.updateInvoice(workspace.id, invoice.id, {
        status: 'Sent',
        updatedAt: new Date().toISOString()
      });
      toast.success('Invoice marked as sent');
      window.dispatchEvent(new CustomEvent('refresh-data'));
    } catch (error) {
      console.error('Mark as sent failed:', error);
      toast.error('Failed to update status');
    }
  };

  const getStatus = (invoice: Invoice) => {
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

  const getStatusStyles = (invoice: Invoice) => {
    const status = getStatus(invoice);
    if (status === 'Paid') return "border-emerald-500/50 text-emerald-500 bg-emerald-500/5";
    if (status.includes('Overdue')) return "border-rose-500/50 text-rose-500 bg-rose-500/5";
    if (status === 'Partial') return "border-amber-500/50 text-amber-500 bg-amber-500/5";
    if (status === 'Sent') return "border-blue-500/50 text-blue-500 bg-blue-500/5";
    return "border-border text-muted-foreground";
  };

  const deleteInvoice = async (id: string) => {
    if (!workspace) return;
    
    const loadingToast = toast.loading('Deleting invoice...');
    
    try {
      await api.deleteInvoice(workspace.id, id);
      toast.dismiss(loadingToast);
      toast.success('Invoice deleted successfully');
      window.dispatchEvent(new CustomEvent('refresh-data'));
    } catch (error: any) {
      console.error('Delete invoice failed:', error);
      toast.dismiss(loadingToast);
      toast.error('Failed to delete invoice', {
        description: error.message || 'Please check your connection and permissions.'
      });
    }
  };

  const handleExport = (formatType: 'csv' | 'excel' | 'pdf') => {
    if (!workspace) return;
    
    const allInvoices = invoices;
    
    const dataToExport = allInvoices.filter(invoice => {
      const matchesSearch = !searchQuery || invoice.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           invoice.amount.toString().includes(searchQuery);
      
      if (!matchesSearch) return false;
      
      if (activeTab === 'all') return true;
      if (activeTab === 'paid') return invoice.status === 'Paid';
      if (activeTab === 'pending') return invoice.status === 'Sent' || invoice.status === 'Partial' || invoice.status === 'Draft';
      if (activeTab === 'overdue') {
        try {
          return (invoice.status === 'Sent' || invoice.status === 'Partial' || invoice.status === 'Draft') && parseISO(invoice.dueDate) < new Date();
        } catch (e) {
          return false;
        }
      }
      return true;
    });

    if (dataToExport.length === 0) {
      toast.error('No data to export with current filters');
      return;
    }

    const formattedData = dataToExport.map(i => {
      let dueDateStr = 'N/A';
      try { if (i.dueDate) dueDateStr = format(parseISO(i.dueDate), 'MMM d, yyyy'); } catch (e) {}

      let createdAtStr = 'N/A';
      try { createdAtStr = format(parseISO(i.createdAt), 'MMM d, yyyy'); } catch (e) {}

      return {
        'Client': i.clientName,
        'Amount': i.amount,
        'Currency': i.currency,
        'Status': i.status,
        'Due Date': dueDateStr,
        'Created At': createdAtStr
      };
    });

    const filename = `invoices_full_export_${format(new Date(), 'yyyy-MM-dd')}`;

    if (formatType === 'csv') exportToCSV(formattedData, filename);
    else if (formatType === 'excel') exportToExcel(formattedData, filename);
    else exportToPDF(formattedData, filename, 'Invoices Full Report');
    
    toast.success(`Export of ${dataToExport.length} records completed`);
  };

  if (!workspace) return null;

  const stats = {
    total: invoices.reduce((acc, i) => acc + (i.amount || 0), 0),
    paid: invoices.reduce((acc, i) => acc + (i.paidAmount || 0), 0),
    outstanding: invoices.reduce((acc, i) => acc + ((i.amount || 0) - (i.paidAmount || 0)), 0),
    count: invoices.length,
    overdueCount: invoices.filter(i => {
      const status = getStatus(i);
      return status.includes('Overdue');
    }).length,
    pendingCount: invoices.filter(i => {
      const status = getStatus(i);
      return status !== 'Paid' && !status.includes('Overdue');
    }).length,
    paidCount: invoices.filter(i => i.status === 'Paid').length
  };

  const filteredInvoices = invoices.filter(invoice => {
    const matchesSearch = invoice.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (invoice.amount || 0).toString().includes(searchQuery);
    
    if (!matchesSearch) return false;
    
    const status = getStatus(invoice);
    if (activeTab === 'all') return true;
    if (activeTab === 'paid') return status === 'Paid';
    if (activeTab === 'pending') return status !== 'Paid' && !status.includes('Overdue');
    if (activeTab === 'overdue') return status.includes('Overdue');
    return true;
  });

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-foreground">Invoices</h1>
          <p className="text-muted-foreground font-medium">Manage and track your client billings.</p>
        </div>
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-4 w-full lg:w-auto">
          {/* Quick Scenario Input */}
          <div className="relative group flex-1 md:min-w-[450px]">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-600/50 to-indigo-600/50 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
            <div className="relative flex flex-col sm:flex-row sm:items-center bg-card border border-border rounded-2xl p-2 gap-2 shadow-sm">
              <div className="flex items-center gap-2 px-2 py-1">
                <div className="flex items-center justify-center h-8 w-8 rounded-full bg-blue-600/10 text-blue-600">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Smart Builder</span>
                  </div>
                  <span className="text-xs font-bold text-foreground">AI Auto-Invoice Generator</span>
                </div>
              </div>
              
              <div className="flex-1 flex items-center bg-muted/30 rounded-xl border border-border/50 px-3">
                <Input 
                  placeholder="e.g. 5 Logo Designs for Acme Corp..." 
                  value={scenario}
                  onChange={(e) => setScenario(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleScenarioSubmit()}
                  className="border-0 focus-visible:ring-0 bg-transparent h-9 text-xs placeholder:text-muted-foreground/40"
                />
                <Button 
                  size="sm" 
                  onClick={handleScenarioSubmit}
                  disabled={!scenario.trim()}
                  className="rounded-lg h-7 px-2 bg-blue-600 text-white font-black text-[9px] uppercase tracking-wider hover:bg-blue-700 transition-colors shadow-sm"
                >
                  Generate
                </Button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-2xl border border-border/50">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => handleExport('csv')}
                className="rounded-xl h-10 px-4 hover:bg-background font-bold text-xs"
              >
                CSV
              </Button>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => handleExport('excel')}
                className="rounded-xl h-10 px-4 hover:bg-background font-bold text-xs"
              >
                Excel
              </Button>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => handleExport('pdf')}
                className="rounded-xl h-10 px-4 hover:bg-background font-bold text-xs"
              >
                PDF
              </Button>
            </div>
          </div>
          
          <Dialog open={isCreating || isEditing} onOpenChange={(open) => {
            if (!open) {
              setIsCreating(false);
              setIsEditing(false);
              setEditingInvoice(null);
              resetForm();
            }
          }}>
            <DialogTrigger
              render={
                <Button 
                  onClick={() => setIsCreating(true)}
                  className="rounded-2xl h-12 px-6 bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20 font-bold flex items-center gap-2"
                >
                  <Plus className="h-5 w-5" />
                  New Invoice
                </Button>
              }
            />
            <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto rounded-[2.5rem] border border-border bg-card shadow-2xl p-6 scrollbar-thin">
              <DialogHeader>
                <DialogTitle className="text-2xl font-black">{isEditing ? 'Edit Invoice' : 'Create New Invoice'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-6 py-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2 relative">
                    <Label className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Client Name *</Label>
                    <Input 
                      placeholder="e.g. John Doe" 
                      value={clientName}
                      onChange={(e) => {
                        setClientName(e.target.value);
                        setClientSearchOpen(true);
                      }}
                      onFocus={() => setClientSearchOpen(true)}
                      onBlur={() => setTimeout(() => setClientSearchOpen(false), 200)}
                      className="h-12 rounded-xl border-border bg-background"
                    />
                    {clientSearchOpen && filteredClients.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-xl shadow-xl overflow-hidden max-h-[200px] overflow-y-auto overflow-x-hidden scrollbar-thin">
                        {filteredClients.map((client) => (
                          <div 
                            key={`client-${client.id}`}
                            className="p-3 hover:bg-muted cursor-pointer transition-colors border-b border-border last:border-0"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              selectClient(client);
                            }}
                          >
                            <p className="text-sm font-bold">{client.clientName}</p>
                            {client.clientBusinessName && <p className="text-[10px] text-muted-foreground">{client.clientBusinessName}</p>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="space-y-2 relative">
                    <Label className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Client Business Name</Label>
                    <Input 
                      placeholder="e.g. Acme Corp (Optional)" 
                      value={clientBusinessName}
                      onChange={(e) => {
                        setClientBusinessName(e.target.value);
                        setBusinessSearchOpen(true);
                      }}
                      onFocus={() => setBusinessSearchOpen(true)}
                      onBlur={() => setTimeout(() => setBusinessSearchOpen(false), 200)}
                      className="h-12 rounded-xl border-border bg-background"
                    />
                    {businessSearchOpen && filteredBusinesses.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-xl shadow-xl overflow-hidden max-h-[200px] overflow-y-auto overflow-x-hidden scrollbar-thin">
                        {filteredBusinesses.map((client) => (
                          <div 
                            key={`business-${client.id}`}
                            className="p-3 hover:bg-muted cursor-pointer transition-colors border-b border-border last:border-0"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              selectClient(client);
                            }}
                          >
                            <p className="text-sm font-bold">{client.clientBusinessName}</p>
                            <p className="text-[10px] text-muted-foreground">{client.clientName}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Client Email</Label>
                    <Input 
                      type="email"
                      placeholder="john@acme.com (Optional)" 
                      value={clientEmail}
                      onChange={(e) => setClientEmail(e.target.value)}
                      className="h-12 rounded-xl border-border bg-background"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Client Phone</Label>
                    <Input 
                      placeholder="+233... (Optional)" 
                      value={clientPhone}
                      onChange={(e) => setClientPhone(e.target.value)}
                      className="h-12 rounded-xl border-border bg-background"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Due Date (Optional)</Label>
                    <Input 
                      type="date" 
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="h-12 rounded-xl border-border bg-background"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Payment Terms</Label>
                    <select
                      value={paymentTerms}
                      onChange={(e) => setPaymentTerms(e.target.value)}
                      className="w-full h-12 px-4 rounded-xl border border-border bg-background text-sm font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
                    >
                      <option value="Due on Receipt">Due on Receipt</option>
                      <option value="Net 7">Net 7 (7 days)</option>
                      <option value="Net 15">Net 15 (15 days)</option>
                      <option value="Net 30">Net 30 (30 days)</option>
                      <option value="Net 45">Net 45 (45 days)</option>
                      <option value="Net 60">Net 60 (60 days)</option>
                      <option value="COD">COD (Cash on Delivery)</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Invoice Title</Label>
                  <Input 
                    placeholder="e.g. Website Design Project - Phase 1" 
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="h-12 rounded-xl border-border bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Invoice Introduction / Description</Label>
                  <Input 
                    placeholder="Briefly explain the purpose of this invoice (e.g., Project summary, service overview)" 
                    value={introduction}
                    onChange={(e) => setIntroduction(e.target.value)}
                    className="h-12 rounded-xl border-border bg-background"
                  />
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Items</Label>
                    <div className="flex gap-2">
                       <Button variant="ghost" size="sm" onClick={() => setIsSelectingFromCatalog(true)} className="text-purple-600 hover:text-purple-700 font-bold">
                        <BookOpen className="h-4 w-4 mr-1" /> Add from Catalog
                      </Button>
                      <Button variant="ghost" size="sm" onClick={addItem} className="text-blue-600 hover:text-blue-700 font-bold">
                        <Plus className="h-4 w-4 mr-1" /> Add Item
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 scrollbar-thin">
                    {items.map((item, index) => (
                      <div key={index} className="flex flex-col gap-3 p-4 rounded-2xl bg-muted/30 border border-border/50">
                        <div className="flex flex-col sm:flex-row gap-3">
                          <Input 
                            placeholder="Item Name (e.g. Graphic Design)" 
                            value={item.name}
                            onChange={(e) => updateItem(index, 'name', e.target.value)}
                            className="flex-1 h-12 rounded-xl border-border bg-background"
                          />
                          <div className="flex gap-2 w-full sm:w-auto">
                            <Input 
                              type="number" 
                              placeholder="Qty" 
                              value={item.quantity}
                              onChange={(e) => updateItem(index, 'quantity', Number(e.target.value))}
                              className="w-20 h-12 rounded-xl border-border bg-background flex-1 sm:flex-none"
                            />
                            <Input 
                              type="number" 
                              placeholder="Price" 
                              value={item.price}
                              onChange={(e) => updateItem(index, 'price', Number(e.target.value))}
                              className="w-28 h-12 rounded-xl border-border bg-background flex-1 sm:flex-none"
                            />
                            <Button variant="ghost" size="icon" onClick={() => removeItem(index)} className="h-12 w-12 text-rose-500 hover:bg-rose-50 rounded-xl shrink-0">
                              <Trash2 className="h-5 w-5" />
                            </Button>
                          </div>
                        </div>
                        <Input 
                          placeholder="Description (e.g. a professionally designed graphic poster)" 
                          value={item.description}
                          onChange={(e) => updateItem(index, 'description', e.target.value)}
                          className="h-10 rounded-xl border-border bg-background text-xs"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Notes Section */}
                <div className="space-y-2">
                  <Label className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Notes / Terms of Payment (Optional)</Label>
                  <textarea
                    placeholder="Enter payment instructions, terms/conditions, bank info, or a thank you message..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    className="w-full p-4 rounded-xl border border-border bg-background text-sm font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
                  />
                </div>

                {/* Discounts Section */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 gap-4 flex flex-col sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Apply Invoice Discount</h4>
                    <p className="text-[10px] text-muted-foreground">Apply standard flat amount or percentage discount</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex bg-white border border-border rounded-xl p-1 shadow-sm h-11">
                      <button
                        type="button"
                        onClick={() => setDiscountType('percentage')}
                        className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${discountType === 'percentage' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
                      >
                        %
                      </button>
                      <button
                        type="button"
                        onClick={() => setDiscountType('flat')}
                        className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${discountType === 'flat' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
                      >
                        {workspace.currency}
                      </button>
                    </div>
                    <Input
                      type="number"
                      placeholder={discountType === 'percentage' ? "e.g. 10" : "e.g. 50"}
                      value={discountValue}
                      onChange={(e) => setDiscountValue(e.target.value)}
                      className="w-28 h-11 rounded-xl border-border bg-background text-sm font-semibold"
                      min="0"
                    />
                  </div>
                </div>

                {/* Total Invoice Breakdown Block */}
                <div className="space-y-2 pt-4 border-t border-border">
                  <div className="flex justify-between items-center text-xs text-muted-foreground font-semibold">
                    <span>Subtotal</span>
                    <span>{workspace.currency} {calculateSubtotal().toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  {Number(discountValue) > 0 && (
                    <div className="flex justify-between items-center text-xs text-rose-600 font-semibold bg-rose-50/50 p-2 rounded-xl">
                      <span>Discount ({discountType === 'percentage' ? `${discountValue}%` : 'Flat'})</span>
                      <span>-{workspace.currency} {calculateDiscountAmount().toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-2 border-t border-dashed border-border">
                    <span className="text-lg font-bold text-slate-800">Grand Total</span>
                    <span className="text-2xl font-black text-blue-600">{workspace.currency} {calculateTotal().toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => {
                  setIsCreating(false);
                  setIsEditing(false);
                  setEditingInvoice(null);
                  resetForm();
                }} className="rounded-xl h-12 px-6">Cancel</Button>
                <Button onClick={createInvoice} className="rounded-xl h-12 px-8 bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20 font-bold">
                  {isEditing ? 'Update Invoice' : 'Create Invoice'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Invoice Preview Dialog */}
          <Dialog open={isPreviewing} onOpenChange={setIsPreviewing}>
            <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto rounded-[2.5rem] border-border bg-card shadow-2xl p-0">
              {editingInvoice && (
                <div className="p-8 space-y-8">
                  <div className="flex justify-between items-start">
                    <div className="space-y-4">
                      <div className="h-16 w-16 rounded-2xl flex items-center justify-center text-white font-black text-2xl" style={{ backgroundColor: workspace.brandColor || '#2563eb' }}>
                        {workspace.logoUrl ? (
                          <img src={workspace.logoUrl} alt="Logo" className="h-full w-full object-cover rounded-2xl" referrerPolicy="no-referrer" />
                        ) : workspace.name.charAt(0)}
                      </div>
                      <div>
                        <h2 className="text-2xl font-black">{workspace.name}</h2>
                        <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider space-y-0.5">
                          {workspace.businessAddress && <p>{workspace.businessAddress}</p>}
                          {workspace.businessEmail && <p>{workspace.businessEmail}</p>}
                          {workspace.businessPhone && <p>{workspace.businessPhone}</p>}
                        </div>
                      </div>
                    </div>
                    <div className="text-right space-y-1">
                      <h1 className="text-4xl font-black tracking-tighter" style={{ color: workspace.brandColor || '#2563eb' }}>INVOICE</h1>
                      <p className="text-xs font-bold text-muted-foreground">#{editingInvoice.id.slice(-6).toUpperCase()}</p>
                      <div className="pt-4 text-[10px] font-bold uppercase tracking-widest space-y-1">
                        <p><span className="text-muted-foreground">Date:</span> {format(parseISO(editingInvoice.createdAt), 'MMM d, yyyy')}</p>
                        <p><span className="text-muted-foreground">Due:</span> {editingInvoice.dueDate ? format(parseISO(editingInvoice.dueDate), 'MMM d, yyyy') : 'No Due Date'}</p>
                        {editingInvoice.paymentTerms && (
                          <p><span className="text-muted-foreground">Terms:</span> {editingInvoice.paymentTerms}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-8 pt-8 border-t border-border">
                    <div>
                      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-2">Bill To</p>
                      <p className="text-lg font-black">{editingInvoice.clientBusinessName || editingInvoice.clientName}</p>
                      <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mt-1 space-y-0.5">
                        {editingInvoice.clientBusinessName && <p>Attn: {editingInvoice.clientName}</p>}
                        {editingInvoice.clientEmail && <p>{editingInvoice.clientEmail}</p>}
                        {editingInvoice.clientPhone && <p>{editingInvoice.clientPhone}</p>}
                      </div>
                    </div>
                  </div>

                  {editingInvoice.introduction && (
                    <div className="pt-4 pb-2">
                      <p className="text-sm text-foreground/80 leading-relaxed">{editingInvoice.introduction}</p>
                    </div>
                  )}

                  <div className="rounded-2xl border border-border overflow-hidden">
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          <TableHead className="font-black text-[10px] uppercase tracking-wider">Description</TableHead>
                          <TableHead className="text-center font-black text-[10px] uppercase tracking-wider">Qty</TableHead>
                          <TableHead className="text-right font-black text-[10px] uppercase tracking-wider">Price</TableHead>
                          <TableHead className="text-right font-black text-[10px] uppercase tracking-wider">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {editingInvoice.items.map((item, i) => (
                          <TableRow key={i}>
                            <TableCell>
                              <p className="text-sm font-black text-slate-900">{item.name}</p>
                              {item.description && <p className="text-[11px] text-muted-foreground font-medium leading-relaxed mt-0.5">{item.description}</p>}
                            </TableCell>
                            <TableCell className="text-center font-medium">{item.quantity}</TableCell>
                            <TableCell className="text-right font-medium">{editingInvoice.currency} {item.price.toLocaleString()}</TableCell>
                            <TableCell className="text-right font-black">{editingInvoice.currency} {(item.quantity * item.price).toLocaleString()}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="flex justify-end pt-4">
                    <div className="w-64 space-y-3">
                      {(() => {
                        const subtotalVal = editingInvoice.subtotal || editingInvoice.items.reduce((acc, item) => acc + (item.quantity * item.price), 0);
                        const discountAmt = Math.max(0, subtotalVal - editingInvoice.amount);
                        return (
                          <>
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground font-bold">Subtotal</span>
                              <span className="font-bold text-slate-800">{editingInvoice.currency} {subtotalVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                            {discountAmt > 0 && (
                              <div className="flex justify-between text-sm text-rose-600 font-bold bg-rose-50/50 p-2 rounded-xl">
                                <span>Discount {editingInvoice.discountType === 'percentage' ? `(${editingInvoice.discountValue}%)` : '(Flat)'}</span>
                                <span>-{editingInvoice.currency} {discountAmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                              </div>
                            )}
                          </>
                        );
                      })()}
                      {editingInvoice.paidAmount && editingInvoice.paidAmount > 0 && (
                        <div className="flex justify-between text-sm pt-1">
                          <span className="text-emerald-600 font-bold">Amount Paid</span>
                          <span className="font-bold text-emerald-600">{editingInvoice.currency} {editingInvoice.paidAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center pt-3 border-t border-border">
                        <span className="text-lg font-black text-slate-800">
                          {editingInvoice.paidAmount && editingInvoice.paidAmount > 0 ? 'Balance Due' : 'Total Due'}
                        </span>
                        <span className="text-2xl font-black" style={{ color: workspace.brandColor || '#2563eb' }}>
                          {editingInvoice.currency} {((editingInvoice.amount || 0) - (editingInvoice.paidAmount || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {editingInvoice.notes && (
                    <div className="pt-6 border-t border-border space-y-2">
                      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Notes / Terms of Payment</p>
                      <div className="p-4 rounded-xl bg-slate-50 border border-slate-100/80 text-xs font-semibold text-slate-700 whitespace-pre-wrap leading-relaxed shadow-inner">
                        {editingInvoice.notes}
                      </div>
                    </div>
                  )}

                  <div className="pt-8 border-t border-border space-y-4">
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Payment Information</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[10px] font-bold">
                      {workspace.paymentMethods && workspace.paymentMethods.length > 0 ? (
                        workspace.paymentMethods.map((method) => (
                          <div key={method.id} className="space-y-1 p-2 rounded-lg bg-muted/30 border border-border/50">
                            <p className="text-muted-foreground uppercase">{method.type === 'Online' ? 'Online Link' : method.type}</p>
                            <p className="font-black">{method.provider}{method.branch && ` (${method.branch})`}</p>
                            <p className="text-muted-foreground">{method.accountName} • {method.accountNumber}</p>
                          </div>
                        ))
                      ) : (
                        <>
                          <div className="space-y-1">
                            <p className="text-muted-foreground uppercase">Bank Transfer</p>
                            <p>{workspace.bankName || '[Bank Name]'}{workspace.bankBranch && ` (${workspace.bankBranch})`} - {workspace.accountNumber || '[Account Number]'}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-muted-foreground uppercase">Mobile Money</p>
                            <p>{workspace.mobileMoneyProvider || '[Provider]'} - {workspace.mobileMoneyNumber || '[Number]'}</p>
                          </div>
                        </>
                      )}
                    </div>
                    {workspace.onlinePaymentUrl && (
                      <div className="pt-4">
                        <a 
                          href={workspace.onlinePaymentUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-white text-xs font-black uppercase tracking-widest shadow-lg hover:opacity-90 transition-all hover:scale-[1.02] active:scale-[0.98]"
                          style={{ backgroundColor: workspace.brandColor || '#2563eb' }}
                        >
                          <CreditCard className="h-4 w-4" />
                          Pay Now
                        </a>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-center pt-8">
                    <Button onClick={() => generateInvoice(editingInvoice)} className="rounded-xl h-12 px-8 text-white shadow-lg font-bold flex items-center gap-2" style={{ backgroundColor: workspace.brandColor || '#2563eb' }}>
                      <Download className="h-5 w-5" />
                      Download PDF
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* Record Payment Dialog */}
          <Dialog open={isRecordingPayment} onOpenChange={setIsRecordingPayment}>
            <DialogContent className="sm:max-w-[400px] rounded-[2.5rem] border-border bg-card shadow-2xl">
              <DialogHeader>
                <DialogTitle className="text-2xl font-black">Record Payment</DialogTitle>
                <DialogDescription>
                  Enter the amount paid by {editingInvoice?.clientName}.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-6 py-4">
                <div className="space-y-2">
                  <Label className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Payment Date</Label>
<div className="relative">
  <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
  <Input 
    type="date"
    value={paymentDate}
    onChange={(e) => setPaymentDate(e.target.value)}
    className="h-14 pl-12 rounded-2xl border-border bg-background font-medium mb-4"
  />
</div>
<Label className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Amount Paid ({workspace.currency})</Label>
                  <div className="relative">
                    <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input 
                      type="number"
                      placeholder="0.00" 
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && recordPayment()}
                      className="h-14 pl-12 rounded-2xl border-border bg-background text-xl font-black"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Total Due: {workspace.currency} {((editingInvoice?.amount || 0) - (editingInvoice?.paidAmount || 0)).toLocaleString()}
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsRecordingPayment(false)} className="rounded-xl h-12 px-6">Cancel</Button>
                <Button 
                  onClick={recordPayment} 
                  disabled={isSubmitting}
                  className="rounded-xl h-12 px-8 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/20 font-bold"
                >
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Record Payment
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
 
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-border bg-card/50 shadow-xl backdrop-blur-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Invoiced</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{workspace.currency} {stats.total.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">{stats.count} total invoices</p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card/50 shadow-xl backdrop-blur-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Paid</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-500">{workspace.currency} {stats.paid.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">{((stats.paid / stats.total) * 100 || 0).toFixed(1)}% collection rate</p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card/50 shadow-xl backdrop-blur-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Outstanding</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-500">{workspace.currency} {stats.outstanding.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">{stats.overdueCount} overdue invoices</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full sm:w-auto">
          <TabsList className="bg-muted/50 p-1 rounded-2xl border border-border/50 h-12 flex items-center">
            <TabsTrigger 
              value="all" 
              className="rounded-xl px-4 h-full font-bold text-xs flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:text-blue-600 data-[state=active]:shadow-sm transition-all"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              All
              <span className="ml-1 px-1.5 py-0.5 rounded-md bg-muted text-[10px] text-muted-foreground group-data-[state=active]:bg-blue-50 group-data-[state=active]:text-blue-600">
                {stats.count}
              </span>
            </TabsTrigger>
            <TabsTrigger 
              value="pending" 
              className="rounded-xl px-4 h-full font-bold text-xs flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:text-amber-600 data-[state=active]:shadow-sm transition-all"
            >
              <Clock className="h-3.5 w-3.5" />
              Pending
              <span className="ml-1 px-1.5 py-0.5 rounded-md bg-muted text-[10px] text-muted-foreground group-data-[state=active]:bg-amber-50 group-data-[state=active]:text-amber-600">
                {stats.pendingCount}
              </span>
            </TabsTrigger>
            <TabsTrigger 
              value="paid" 
              className="rounded-xl px-4 h-full font-bold text-xs flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:text-emerald-600 data-[state=active]:shadow-sm transition-all"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Paid
              <span className="ml-1 px-1.5 py-0.5 rounded-md bg-muted text-[10px] text-muted-foreground group-data-[state=active]:bg-emerald-50 group-data-[state=active]:text-emerald-600">
                {stats.paidCount}
              </span>
            </TabsTrigger>
            <TabsTrigger 
              value="overdue" 
              className="rounded-xl px-4 h-full font-bold text-xs flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:text-rose-600 data-[state=active]:shadow-sm transition-all"
            >
              <AlertCircle className="h-3.5 w-3.5" />
              Overdue
              <span className="ml-1 px-1.5 py-0.5 rounded-md bg-muted text-[10px] text-muted-foreground group-data-[state=active]:bg-rose-50 group-data-[state=active]:text-rose-600">
                {stats.overdueCount}
              </span>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search invoices..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-10 rounded-xl border-border bg-muted/30 focus:bg-background transition-all"
            />
            {searchQuery && (
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setSearchQuery('')}
                className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 rounded-lg hover:bg-muted"
              >
                <Plus className="h-4 w-4 rotate-45" />
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="mt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredInvoices.map((invoice) => (
              <Card key={invoice.id} className="border-border bg-card/50 shadow-xl backdrop-blur-xl hover:border-accent transition-all duration-300 group flex flex-col h-full relative overflow-hidden">
                <CardContent className="flex flex-col p-6 h-full justify-between gap-6">
                  <div className="space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-muted text-muted-foreground group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                          <FileText className="h-6 w-6" />
                        </div>
                        <span className="text-xs font-mono font-bold text-muted-foreground tracking-normal bg-muted/40 px-2 py-1 rounded-lg">
                          INV-{invoice.id.slice(-6).toUpperCase()}
                        </span>
                      </div>
                        <Badge 
                          variant="outline" 
                          className={cn(
                            "text-[10px] font-black uppercase tracking-widest px-2 py-0.5",
                            getStatusStyles(invoice)
                          )}
                        >
                          {getStatus(invoice)}
                        </Badge>
                    </div>

                    <div className="min-w-0">
                      <h3 className="font-black text-xl text-foreground truncate leading-tight">{invoice.clientName}</h3>
                      {invoice.introduction ? (
                        <p className="text-xs font-semibold text-muted-foreground truncate mt-1.5" title={invoice.introduction}>
                          {invoice.introduction}
                        </p>
                      ) : (
                        <p className="text-xs font-medium italic text-muted-foreground/60 truncate mt-1.5">
                          No introduction provided
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-2 mt-3">
                        <Badge variant="secondary" className="text-[10px] font-bold uppercase tracking-wider bg-muted/50">
                          Due: {(() => {
                            try {
                              return format(parseISO(invoice.dueDate), 'MMM d, yyyy');
                            } catch (e) {
                              return 'N/A';
                            }
                          })()}
                        </Badge>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">
                          {invoice.items.length} items
                        </p>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-border/50">
                      <p className="text-3xl font-black text-foreground tracking-tighter">
                        {invoice.currency} {invoice.amount.toLocaleString()}
                      </p>
                      
                      <div className="mt-2 space-y-1">
                        {!!invoice.paidAmount && invoice.paidAmount > 0 && invoice.status !== 'Paid' && (
                          <div className="flex justify-between items-center">
                            <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-tighter">
                              Paid: {invoice.currency} {invoice.paidAmount.toLocaleString()}
                            </p>
                            <p className="text-[10px] font-bold text-rose-500 uppercase tracking-tighter">
                              Bal: {invoice.currency} {(invoice.amount - invoice.paidAmount).toLocaleString()}
                            </p>
                          </div>
                        )}
                        {(!invoice.paidAmount || invoice.paidAmount === 0) && invoice.status !== 'Paid' && (
                          <p className="text-[10px] font-bold text-rose-500 uppercase tracking-tighter">
                            Balance: {invoice.currency} {invoice.amount.toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-1 bg-muted/30 p-1 rounded-2xl border border-border/50 mt-auto">
                    <div className="flex items-center gap-1">
                      {invoice.status !== 'Paid' && (
                        <>
                          {invoice.status === 'Draft' && (
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              onClick={() => markAsSent(invoice)}
                              className="h-9 w-9 text-blue-600 hover:bg-blue-50/50 rounded-xl"
                              title="Mark as Sent"
                            >
                              <Send className="h-4 w-4" />
                            </Button>
                          )}
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            onClick={() => {
                              setEditingInvoice(invoice);
                              setPaymentAmount(((invoice.amount || 0) - (invoice.paidAmount || 0)).toString());
                              setIsRecordingPayment(true);
                            }}
                            className="h-9 w-9 text-emerald-600 hover:bg-emerald-50/50 rounded-xl"
                            title="Record Payment"
                          >
                            <CreditCard className="h-4 w-4" />
                          </Button>
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            onClick={() => startEditing(invoice)}
                            className="h-9 w-9 text-blue-600 hover:bg-blue-50/50 rounded-xl"
                            title="Edit Invoice"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        onClick={() => {
                          setEditingInvoice(invoice);
                          setIsPreviewing(true);
                        }}
                        className="h-9 w-9 text-purple-600 hover:bg-purple-50/50 rounded-xl"
                        title="Preview Invoice"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        onClick={() => startCopy(invoice)}
                        className="h-9 w-9 text-indigo-600 hover:bg-indigo-50/50 rounded-xl"
                        title="Copy Invoice"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        onClick={() => generateInvoice(invoice)}
                        className="h-9 w-9 text-blue-600 hover:bg-blue-50/50 rounded-xl"
                        title="Download PDF"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      {!!invoice.paidAmount && invoice.paidAmount > 0 && (
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          onClick={() => generateReceipt(invoice)}
                          className="h-9 w-9 text-emerald-600 hover:bg-emerald-50/50 rounded-xl"
                          title="Download Receipt"
                        >
                          <Receipt className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    
                    <AlertDialog>
                      <AlertDialogTrigger render={
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-9 w-9 text-muted-foreground hover:text-rose-500 hover:bg-rose-50/50 rounded-xl"
                          title="Delete"
                        />
                      }>
                        <Trash2 className="h-4 w-4" />
                      </AlertDialogTrigger>
                      <AlertDialogContent className="rounded-[2rem]">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-2xl font-black">Are you absolutely sure?</AlertDialogTitle>
                          <AlertDialogDescription className="text-base font-medium">
                            This will permanently delete the invoice for <span className="text-foreground font-bold">{invoice.clientName}</span> and <span className="text-rose-600 font-bold underline">all related payment transactions</span>. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteInvoice(invoice.id)} className="rounded-xl bg-rose-600 hover:bg-rose-700">Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            ))}
            {filteredInvoices.length === 0 && !loading && (
              <div className="col-span-full flex flex-col items-center justify-center py-20 bg-muted/10 rounded-[2.5rem] border-2 border-dashed border-border/50">
                <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center mb-4">
                  <FileText className="h-10 w-10 text-muted-foreground/40" />
                </div>
                <h3 className="text-xl font-bold text-foreground">No invoices found</h3>
                <p className="text-muted-foreground max-w-[250px] text-center mt-2">
                  {searchQuery ? `No results for "${searchQuery}"` : `You don't have any ${activeTab !== 'all' ? activeTab : ''} invoices yet.`}
                </p>
                {!searchQuery && (
                  <Button 
                    onClick={() => setIsCreating(true)}
                    variant="outline"
                    className="mt-6 rounded-xl font-bold border-blue-200 text-blue-600 hover:bg-blue-50"
                  >
                    <Plus className="h-4 w-4 mr-2" /> Create Invoice
                  </Button>
                )}
              </div>
            )}
            {loading && (
              <div className="col-span-full flex justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>

          {/* Catalog Selection Dialog */}
          <Dialog open={isSelectingFromCatalog} onOpenChange={setIsSelectingFromCatalog}>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto rounded-3xl">
              <DialogHeader>
                <DialogTitle className="text-2xl font-black">Select from Catalog</DialogTitle>
                <DialogDescription className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  Quickly add saved products and services to your invoice
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <Catalog 
                  workspace={workspace} 
                  mode="select" 
                  onSelect={(item) => {
                    if (items.length === 1 && items[0].name === '' && items[0].price === 0) {
                      setItems([{ 
                        name: item.name, 
                        description: item.description, 
                        quantity: 1, 
                        price: item.price 
                      }]);
                    } else {
                      setItems([...items, { 
                        name: item.name, 
                        description: item.description, 
                        quantity: 1, 
                        price: item.price 
                      }]);
                    }
                    setIsSelectingFromCatalog(false);
                    toast.success(`${item.name} added to invoice`);
                  }} 
                />
              </div>
            </DialogContent>
          </Dialog>
      </div>
    </div>
  );
}
