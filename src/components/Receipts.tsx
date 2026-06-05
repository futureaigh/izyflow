import { useState, useEffect } from 'react';
import { Workspace, Staff, StaffReceipt, StaffReceiptItem, Currency } from '../types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { 
  Users, 
  Receipt, 
  Plus, 
  Trash2, 
  Edit, 
  Search, 
  Download, 
  CreditCard, 
  Calendar, 
  Building2, 
  FileText, 
  Mail, 
  Phone, 
  User, 
  DollarSign, 
  Eye, 
  Briefcase,
  Layers,
  Sparkles,
  Printer
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from './ui/dialog';
import { format, parseISO } from 'date-fns';
import { generateStaffReceiptPDF } from '../lib/dataEngine';
import { api } from '../lib/api';

interface ReceiptsProps {
  workspace: Workspace | null;
}

export function Receipts({ workspace }: ReceiptsProps) {
  const [activeSubTab, setActiveSubTab] = useState<'receipts' | 'staff'>('receipts');
  
  // Lists
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [receiptsList, setReceiptsList] = useState<StaffReceipt[]>([]);
  
  // Loading
  const [loadingStaff, setLoadingStaff] = useState(true);
  const [loadingReceipts, setLoadingReceipts] = useState(true);
  
  // Search / Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [staffFilter, setStaffFilter] = useState('All');

  // Dialog Controls
  const [isStaffOpen, setIsStaffOpen] = useState(false);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  
  // Editing References
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [editingReceipt, setEditingReceipt] = useState<StaffReceipt | null>(null);
  const [previewingReceipt, setPreviewingReceipt] = useState<StaffReceipt | null>(null);

  // Staff Form State
  const [staffName, setStaffName] = useState('');
  const [staffRole, setStaffRole] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffPhone, setStaffPhone] = useState('');
  const [staffBankName, setStaffBankName] = useState('');
  const [staffAccountNumber, setStaffAccountNumber] = useState('');

  // Receipt Form State
  const [selectedStaffId, setSelectedStaffId] = useState<string>('custom');
  const [recipientName, setRecipientName] = useState('');
  const [recipientRole, setRecipientRole] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [receiptTitle, setReceiptTitle] = useState('');
  const [receiptDate, setReceiptDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState('Bank Transfer');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [receiptNotes, setReceiptNotes] = useState('');
  const [receiptItems, setReceiptItems] = useState<StaffReceiptItem[]>([{ description: '', amount: 0 }]);

  const fetchStaff = async () => {
    if (!workspace) return;
    try {
      setLoadingStaff(true);
      const data = await api.getStaff(workspace.id);
      setStaffList(data);
      localStorage.setItem(`staff_${workspace.id}`, JSON.stringify(data));
    } catch (error) {
      console.error(error);
      const cached = localStorage.getItem(`staff_${workspace.id}`);
      if (cached) setStaffList(JSON.parse(cached));
    } finally {
      setLoadingStaff(false);
    }
  };

  const fetchReceipts = async () => {
    if (!workspace) return;
    try {
      setLoadingReceipts(true);
      const data = await api.getStaffReceipts(workspace.id);
      setReceiptsList(data);
      localStorage.setItem(`staff_receipts_${workspace.id}`, JSON.stringify(data));
    } catch (error) {
      console.error(error);
      const cached = localStorage.getItem(`staff_receipts_${workspace.id}`);
      if (cached) setReceiptsList(JSON.parse(cached));
    } finally {
      setLoadingReceipts(false);
    }
  };

  useEffect(() => {
    fetchStaff();
    fetchReceipts();
  }, [workspace]);

  // Handle Staff Auto-fill when selecting a staff member in receipt creation
  const handleSelectStaff = (id: string) => {
    setSelectedStaffId(id);
    if (id === 'custom') {
      setRecipientName('');
      setRecipientRole('');
      setRecipientEmail('');
    } else {
      const selected = staffList.find(s => s.id === id);
      if (selected) {
        setRecipientName(selected.name);
        setRecipientRole(selected.role);
        setRecipientEmail(selected.email || '');
        if (selected.bankName && selected.accountNumber) {
          setReceiptNotes(`Disbursed to: ${selected.bankName} - A/C: ${selected.accountNumber}`);
        } else {
          setReceiptNotes('');
        }
      }
    }
  };

  // Staff Form Handlers
  const handleOpenNewStaffFlag = () => {
    setEditingStaff(null);
    setStaffName('');
    setStaffRole('');
    setStaffEmail('');
    setStaffPhone('');
    setStaffBankName('');
    setStaffAccountNumber('');
    setIsStaffOpen(true);
  };

  const handleOpenEditStaff = (staff: Staff) => {
    setEditingStaff(staff);
    setStaffName(staff.name);
    setStaffRole(staff.role);
    setStaffEmail(staff.email || '');
    setStaffPhone(staff.phone || '');
    setStaffBankName(staff.bankName || '');
    setStaffAccountNumber(staff.accountNumber || '');
    setIsStaffOpen(true);
  };

  const handleSubmitStaff = async () => {
    if (!workspace) return;
    if (!staffName.trim()) {
      toast.error('Please enter a staff name');
      return;
    }
    if (!staffRole.trim()) {
      toast.error('Please enter a role / capacity');
      return;
    }

    const docData = {
      name: staffName.trim(),
      role: staffRole.trim(),
      email: staffEmail.trim() || null,
      phone: staffPhone.trim() || null,
      bankName: staffBankName.trim() || null,
      accountNumber: staffAccountNumber.trim() || null,
      createdAt: editingStaff?.createdAt || new Date().toISOString(),
      workspaceId: workspace.id,
    };

    try {
      if (editingStaff) {
        await api.updateStaff(workspace.id, editingStaff.id, docData);
        toast.success(`Updated ${staffName}'s details`);
      } else {
        await api.createStaff(workspace.id, {
          ...docData,
          id: Math.random().toString(36).substring(2) + Date.now().toString(36)
        });
        toast.success(`Added ${staffName} to staff roster`);
      }
      setIsStaffOpen(false);
      fetchStaff();
    } catch (e: any) {
      console.error('Error saving staff:', e);
      toast.error('Failed to save staff records');
    }
  };

  const handleDeleteStaff = async (id: string, name: string) => {
    if (!workspace) return;
    if (!window.confirm(`Are you sure you want to remove ${name} from staff list?`)) return;

    try {
      await api.deleteStaff(workspace.id, id);
      toast.success(`Removed ${name} from records`);
      fetchStaff();
    } catch (e) {
      toast.error('Could not delete staff record');
    }
  };

  // Receipts Forms Details Handlers
  const handleOpenNewReceipt = () => {
    setEditingReceipt(null);
    setSelectedStaffId('custom');
    setRecipientName('');
    setRecipientRole('');
    setRecipientEmail('');
    setReceiptTitle('');
    setReceiptDate(new Date().toISOString().split('T')[0]);
    setPaymentMethod('Bank Transfer');
    setReferenceNumber('');
    setReceiptNotes('');
    setReceiptItems([{ description: 'Monthly Salary / Professional Fees', amount: 0 }]);
    setIsReceiptOpen(true);
  };

  const handleOpenEditReceipt = (receipt: StaffReceipt) => {
    setEditingReceipt(receipt);
    setSelectedStaffId(receipt.staffId || 'custom');
    setRecipientName(receipt.recipientName);
    setRecipientRole(receipt.recipientRole || '');
    setRecipientEmail(receipt.recipientEmail || '');
    setReceiptTitle(receipt.title);
    setReceiptDate(receipt.date);
    setPaymentMethod(receipt.paymentMethod);
    setReferenceNumber(receipt.referenceNumber || '');
    setReceiptNotes(receipt.notes || '');
    setReceiptItems(receipt.items && receipt.items.length > 0 ? [...receipt.items] : [{ description: 'Payment', amount: receipt.amount }]);
    setIsReceiptOpen(true);
  };

  const calculateReceiptTotal = () => {
    return receiptItems.reduce((acc, item) => acc + (Number(item.amount) || 0), 0);
  };

  const handleReceiptItemChange = (index: number, field: 'description' | 'amount', value: string) => {
    const newItems = [...receiptItems];
    if (field === 'amount') {
      newItems[index] = { ...newItems[index], amount: Math.max(0, Number(value) || 0) };
    } else {
      newItems[index] = { ...newItems[index], description: value };
    }
    setReceiptItems(newItems);
  };

  const addReceiptItemRow = () => {
    setReceiptItems([...receiptItems, { description: '', amount: 0 }]);
  };

  const removeReceiptItemRow = (index: number) => {
    if (receiptItems.length <= 1) {
      toast.error('Each receipt must have at least one checkout breakdown item');
      return;
    }
    const filtered = receiptItems.filter((_, i) => i !== index);
    setReceiptItems(filtered);
  };

  const handleSubmitReceipt = async () => {
    if (!workspace) return;
    if (!recipientName.trim()) {
      toast.error('Please enter or select a recipient name');
      return;
    }
    if (!receiptTitle.trim()) {
      toast.error('Please enter payment context/title (e.g. Salary)');
      return;
    }
    if (receiptItems.some(i => !i.description.trim() || i.amount <= 0)) {
      toast.error('All line items must have a description and a valid positive amount.');
      return;
    }

    const totalAmount = calculateReceiptTotal();

    const docData = {
      staffId: selectedStaffId !== 'custom' ? selectedStaffId : null,
      recipientName: recipientName.trim(),
      recipientRole: recipientRole.trim() || null,
      recipientEmail: recipientEmail.trim() || null,
      title: receiptTitle.trim(),
      date: receiptDate,
      paymentMethod,
      referenceNumber: referenceNumber.trim() || null,
      items: receiptItems,
      amount: totalAmount,
      currency: workspace.currency,
      notes: receiptNotes.trim() || null,
      createdAt: editingReceipt?.createdAt || new Date().toISOString(),
      workspaceId: workspace.id,
    };

    try {
      if (editingReceipt) {
        toast.error('Modifying receipts is not supported by backend schema. Please delete and recreate.');
      } else {
        await api.createStaffReceipt(workspace.id, {
          ...docData,
          id: Math.random().toString(36).substring(2) + Date.now().toString(36)
        });
        toast.success(`Successfully recorded/issued payment receipt to ${recipientName}`);
      }
      setIsReceiptOpen(false);
      fetchReceipts();
    } catch (error: any) {
      console.error('Error saving receipt:', error);
      toast.error('Failed to commit payment receipt records');
    }
  };

  const handleDeleteReceipt = async (id: string, recipient: string) => {
    if (!workspace) return;
    if (!window.confirm(`Are you sure you want to delete payment receipt recorded to ${recipient}?`)) return;

    try {
      await api.deleteStaffReceipt(workspace.id, id);
      toast.success('Receipt record deleted');
      fetchReceipts();
    } catch (e) {
      toast.error('Failed to destroy receipt register data');
    }
  };

  const downloadReceiptPDF = (receipt: StaffReceipt) => {
    if (!workspace) return;
    generateStaffReceiptPDF(receipt, workspace);
    toast.success('PDF Receipt Download Triggered!');
  };

  const openReceiptPreview = (receipt: StaffReceipt) => {
    setPreviewingReceipt(receipt);
    setIsPreviewOpen(true);
  };

  // Analytics Helpers
  const thisMonthDisbursements = () => {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0,0,0,0);
    const monthIso = startOfMonth.toISOString().split('T')[0];
    
    return receiptsList
      .filter(r => r.date >= monthIso)
      .reduce((acc, current) => acc + (current.amount || 0), 0);
  };

  const totalRegisteredRoster = staffList.length;
  const totalReceiptsIssued = receiptsList.length;

  const filteredReceipts = receiptsList.filter(r => {
    const matchesSearch = r.recipientName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          r.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (r.paymentMethod && r.paymentMethod.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStaff = staffFilter === 'All' || r.staffId === staffFilter;
    return matchesSearch && matchesStaff;
  });

  const filteredStaff = staffList.filter(s => {
    return s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
           s.role.toLowerCase().includes(searchQuery.toLowerCase()) || 
           (s.bankName && s.bankName.toLowerCase().includes(searchQuery.toLowerCase()));
  });

  return (
    <div className="space-y-8 p-1 sm:p-2">
      {/* Dynamic Visual Banner */}
      <div className="relative overflow-hidden rounded-[2.5rem] bg-slate-900 p-8 text-white shadow-2xl">
        <div className="absolute top-0 right-0 h-96 w-96 rounded-full bg-indigo-600/15 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-fuchsia-600/10 blur-3xl animate-pulse" />
        
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-3">
            <span className="bg-indigo-500/20 text-indigo-300 font-bold px-3 py-1.5 rounded-full text-xs uppercase tracking-wider inline-flex items-center gap-1.5 border border-indigo-500/10">
              <Sparkles className="h-3 w-3" />
              Staff & Disbursements Portal
            </span>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Receipts & Salaries</h1>
            <p className="text-slate-300 text-sm max-w-xl font-medium">
              Create and manage payment receipts, execute internal financial settlements, handle payroll disbursements, and track proof-of-payment documents seamlessly.
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              onClick={handleOpenNewStaffFlag}
              variant="outline"
              className="rounded-2xl h-12 px-5 border-white/20 bg-white/5 text-white hover:bg-white/10 font-bold text-xs"
            >
              <Plus className="mr-2 h-4 w-4" /> Add Staff Member
            </Button>
            <Button
              onClick={handleOpenNewReceipt}
              className="rounded-2xl h-12 px-6 bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 font-bold text-xs border border-indigo-500"
            >
              <Plus className="mr-2 h-4 w-4" /> Record Settlement / Receipt
            </Button>
          </div>
        </div>
      </div>

      {/* Top Cards Statistics section */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <Card className="rounded-3xl border-border bg-card shadow-lg hover:shadow-xl transition-all duration-300">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block">This Month's Disbursements</span>
              <span className="text-2xl font-black text-slate-800">
                {workspace?.currency} {thisMonthDisbursements().toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="p-3.5 rounded-2xl bg-indigo-500/10 text-indigo-600">
              <DollarSign className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-border bg-card shadow-lg hover:shadow-xl transition-all duration-300">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block">Active Roster & Staff</span>
              <span className="text-2xl font-black text-slate-800">
                {totalRegisteredRoster} Member{totalRegisteredRoster !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 text-emerald-600">
              <Users className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-border bg-card shadow-lg hover:shadow-xl transition-all duration-300">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block">Total Settlements Documented</span>
              <span className="text-2xl font-black text-slate-800">
                {totalReceiptsIssued} Receipt{totalReceiptsIssued !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="p-3.5 rounded-2xl bg-amber-500/10 text-amber-600">
              <Receipt className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs switching */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        {/* Subtab Selector */}
        <div className="inline-flex bg-slate-100 rounded-2xl p-1.5 shadow-sm self-start">
          <button
            onClick={() => { setActiveSubTab('receipts'); setSearchQuery(''); }}
            className={cn(
              "flex items-center gap-2 px-5 py-2.5 text-xs font-bold rounded-xl transition-all",
              activeSubTab === 'receipts' ? "bg-white text-indigo-600 shadow" : "text-slate-600 hover:text-slate-900"
            )}
          >
            <Receipt className="h-4 w-4" />
            Disbursement Receipts ({totalReceiptsIssued})
          </button>
          <button
            onClick={() => { setActiveSubTab('staff'); setSearchQuery(''); }}
            className={cn(
              "flex items-center gap-2 px-5 py-2.5 text-xs font-bold rounded-xl transition-all",
              activeSubTab === 'staff' ? "bg-white text-indigo-600 shadow" : "text-slate-600 hover:text-slate-900"
            )}
          >
            <Users className="h-4 w-4" />
            Staff & Payees ({totalRegisteredRoster})
          </button>
        </div>

        {/* Workspace Filters and Searches */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center w-full sm:w-auto">
          {activeSubTab === 'receipts' && (
            <select
              value={staffFilter}
              onChange={(e) => setStaffFilter(e.target.value)}
              className="h-11 px-4 text-xs font-semibold rounded-xl bg-background border border-border cursor-pointer focus:ring-2 focus:ring-indigo-500"
            >
              <option value="All">All Staff / Recipient</option>
              {staffList.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          )}
          
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-70" />
            <Input
              type="text"
              placeholder={activeSubTab === 'receipts' ? "Search receipts..." : "Search staff roster..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-11 rounded-xl bg-background border-border text-xs font-semibold"
            />
          </div>
        </div>
      </div>

      {/* Receipts List view */}
      {activeSubTab === 'receipts' && (
        <div className="space-y-4">
          {loadingReceipts ? (
            <div className="text-center py-12 text-sm text-slate-500 font-bold">Scanning receipts records database...</div>
          ) : filteredReceipts.length === 0 ? (
            <Card className="rounded-3xl border-dashed border-2 py-16 text-center bg-slate-50/50">
              <CardContent className="space-y-4">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                  <Receipt className="h-6 w-6" />
                </div>
                <div className="space-y-1.5 max-w-md mx-auto">
                  <h3 className="text-base font-bold text-slate-800">No disbursements logged</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    You haven't recorded any staff wages, salary installments, commissions, bonuses, or personnel transactions in this workspace yet.
                  </p>
                </div>
                <Button onClick={handleOpenNewReceipt} className="rounded-2xl h-11 bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-700">
                  <Plus className="mr-2 h-4 w-4" /> Issue First Payment Receipt
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredReceipts.map(receipt => (
                <Card 
                  key={receipt.id} 
                  className="rounded-[2.5rem] border border-border bg-card shadow-md hover:shadow-xl transition-all duration-300 relative group overflow-hidden"
                >
                  <CardHeader className="p-6 pb-2">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <span className="bg-indigo-50 text-indigo-700 font-bold px-2.5 py-1 rounded-lg text-[10px] uppercase tracking-wider inline-block">
                          {receipt.paymentMethod}
                        </span>
                        <h3 className="text-base font-extrabold text-slate-800 pt-1.5 tracking-tight group-hover:text-indigo-600 transition-colors">
                          {receipt.title}
                        </h3>
                        {receipt.recipientRole && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-semibold">
                            <Briefcase className="h-3 w-3" />
                            <span>{receipt.recipientRole}</span>
                          </div>
                        )}
                      </div>
                      <span className="text-lg font-black text-indigo-600 self-start">
                        {receipt.currency} {(receipt.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="p-6 pt-2 space-y-4">
                    <div className="border-t border-dashed border-slate-100 pt-4 space-y-2 text-[11px] font-bold text-slate-600">
                      <div className="flex justify-between items-center bg-slate-50/50 p-2 rounded-xl">
                        <span className="text-muted-foreground">Recipient Name:</span>
                        <span className="text-slate-800">{receipt.recipientName}</span>
                      </div>
                      <div className="flex justify-between items-center bg-slate-50/50 p-2 rounded-xl">
                        <span className="text-muted-foreground">Payment Date:</span>
                        <span className="text-slate-800">{format(parseISO(receipt.date), 'MMM d, yyyy')}</span>
                      </div>
                      {receipt.referenceNumber && (
                        <div className="flex justify-between items-center bg-slate-50/50 p-2 rounded-xl">
                          <span className="text-muted-foreground">Reference Number:</span>
                          <span className="text-slate-800 select-all font-mono">{receipt.referenceNumber}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-2">
                      <div className="flex gap-1.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openReceiptPreview(receipt)}
                          title="Preview Details"
                          className="rounded-xl h-10 w-10 p-0 text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-slate-100"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleOpenEditReceipt(receipt)}
                          className="rounded-xl h-10 w-10 p-0 text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-slate-100"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteReceipt(receipt.id, receipt.recipientName)}
                          className="rounded-xl h-10 w-10 p-0 text-rose-600 hover:bg-rose-50 hover:text-rose-700 border border-rose-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <Button
                        size="sm"
                        onClick={() => downloadReceiptPDF(receipt)}
                        className="rounded-2xl h-10 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs"
                      >
                        <Download className="mr-1.5 h-3.5 w-3.5" /> PDF
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Staff Tab List */}
      {activeSubTab === 'staff' && (
        <div className="space-y-4">
          {loadingStaff ? (
            <div className="text-center py-12 text-sm text-slate-500 font-bold">Scanning workspace personnel directory...</div>
          ) : filteredStaff.length === 0 ? (
            <Card className="rounded-3xl border-dashed border-2 py-16 text-center bg-slate-50/50">
              <CardContent className="space-y-4">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                  <Users className="h-6 w-6" />
                </div>
                <div className="space-y-1.5 max-w-md mx-auto">
                  <h3 className="text-base font-bold text-slate-800">Staff records empty</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Map out your directory of team members, contractors, consultants, or departments to execute fast payout disbursements.
                  </p>
                </div>
                <Button onClick={handleOpenNewStaffFlag} className="rounded-2xl h-11 bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700">
                  <Plus className="mr-2 h-4 w-4" /> Add First Staff Member
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredStaff.map(staff => (
                <Card 
                  key={staff.id} 
                  className="rounded-[2.5rem] border border-border bg-card shadow-md hover:shadow-xl transition-all duration-300 relative overflow-hidden"
                >
                  <CardHeader className="p-6">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-2xl bg-indigo-600/10 text-indigo-600 flex items-center justify-center font-black">
                        {staff.name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-extrabold text-base text-slate-800 truncate">{staff.name}</h3>
                        <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                          <Briefcase className="h-3 w-3" />
                          <span>{staff.role}</span>
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6 pt-0 space-y-4">
                    <div className="border-t border-slate-100 pt-4 space-y-2 text-xs font-semibold text-slate-600">
                      {staff.email && (
                        <div className="flex items-center gap-2">
                          <Mail className="h-3.5 w-3.5 text-slate-400" />
                          <span className="truncate">{staff.email}</span>
                        </div>
                      )}
                      {staff.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-3.5 w-3.5 text-slate-400" />
                          <span>{staff.phone}</span>
                        </div>
                      )}
                      {staff.bankName && staff.accountNumber && (
                        <div className="p-3 bg-slate-50/80 rounded-xl space-y-1">
                          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-black uppercase tracking-wider">
                            <Building2 className="h-3 w-3" /> Settlement Destination
                          </div>
                          <p className="text-xs font-bold text-slate-700 truncate">{staff.bankName}</p>
                          <p className="text-[10px] font-mono text-slate-500 truncate">A/C: {staff.accountNumber}</p>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100/50">
                      <Button
                        onClick={() => {
                          handleSelectStaff(staff.id);
                          setReceiptTitle(`Salary Outflow - ${format(new Date(), 'MMMM yyyy')}`);
                          setReceiptDate(new Date().toISOString().split('T')[0]);
                          setReceiptItems([{ description: 'Salary / Compensation payment', amount: 0 }]);
                          setIsReceiptOpen(true);
                        }}
                        className="rounded-2xl h-10 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
                      >
                        <Receipt className="mr-1.5 h-3.5 w-3.5" /> Disburse wage
                      </Button>

                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleOpenEditStaff(staff)}
                          className="rounded-xl h-10 w-10 p-0 text-slate-600 hover:bg-slate-50"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteStaff(staff.id, staff.name)}
                          className="rounded-xl h-10 w-10 p-0 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Staff Roster Management Dialog */}
      <Dialog open={isStaffOpen} onOpenChange={setIsStaffOpen}>
        <DialogContent className="sm:max-w-[480px] rounded-[2.5rem] border border-border bg-card shadow-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black text-slate-800">
              {editingStaff ? 'Modify Staff Profile' : 'Add New Staff Member'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Record professional details and payout accounts for easy payroll management.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Full Name *</Label>
              <Input
                placeholder="e.g. Ama Serwaa"
                value={staffName}
                onChange={(e) => setStaffName(e.target.value)}
                className="h-11 rounded-xl bg-background border-border text-sm font-semibold"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Capacity / Role *</Label>
              <Input
                placeholder="e.g. Lead Designer, Accountant"
                value={staffRole}
                onChange={(e) => setStaffRole(e.target.value)}
                className="h-11 rounded-xl bg-background border-border text-sm font-semibold"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Email (Optional)</Label>
                <Input
                  type="email"
                  placeholder="e.g. ama@corp.com"
                  value={staffEmail}
                  onChange={(e) => setStaffEmail(e.target.value)}
                  className="h-11 rounded-xl bg-background border-border text-sm font-semibold"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Phone (Optional)</Label>
                <Input
                  placeholder="e.g. +233 24 123 4567"
                  value={staffPhone}
                  onChange={(e) => setStaffPhone(e.target.value)}
                  className="h-11 rounded-xl bg-background border-border text-sm font-semibold"
                />
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-3">
              <p className="text-[10px] font-black text-slate-700 uppercase tracking-wider">Bank Payout Info (For automatic notes generation)</p>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Bank Provider & Branch</Label>
                <Input
                  placeholder="e.g. Zenith Bank, Airport Branch"
                  value={staffBankName}
                  onChange={(e) => setStaffBankName(e.target.value)}
                  className="h-11 rounded-xl bg-white border-border text-sm font-semibold"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Account Number / MM ID</Label>
                <Input
                  placeholder="e.g. 10123456789"
                  value={staffAccountNumber}
                  onChange={(e) => setStaffAccountNumber(e.target.value)}
                  className="h-11 rounded-xl bg-white border-border text-sm font-semibold"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setIsStaffOpen(false)}
              className="rounded-xl h-11 px-5 border-slate-200"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmitStaff}
              className="rounded-xl h-11 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
            >
              {editingStaff ? 'Update Roster' : 'Register Staff'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Receipt / Settlement Creation Dialog */}
      <Dialog open={isReceiptOpen} onOpenChange={setIsReceiptOpen}>
        <DialogContent className="sm:max-w-[620px] max-h-[90vh] overflow-y-auto rounded-[2.5rem] border border-border bg-card shadow-2xl p-6 scrollbar-thin">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black text-slate-800">
              {editingReceipt ? 'Edit Disbursement Receipt' : 'Record New Disbursement Settlement'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Generate a corporate proof of payment with multi-item breakdown for audits and payroll storage.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-4">
            {/* Quick Select from Roster */}
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Quick Select Staff</Label>
              <select
                value={selectedStaffId}
                onChange={(e) => handleSelectStaff(e.target.value)}
                className="w-full h-11 px-4 rounded-xl border border-border bg-background text-sm font-semibold cursor-pointer focus:ring-2 focus:ring-indigo-500"
              >
                <option value="custom">-- Custom Payee / Guest Recipient --</option>
                {staffList.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
                ))}
              </select>
            </div>

            {/* Recipient Coordinates */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Recipient Name *</Label>
                <Input
                  placeholder="Ama Serwaa"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  disabled={selectedStaffId !== 'custom'}
                  className="h-11 rounded-xl bg-background border-border text-sm font-semibold"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Role / Department</Label>
                <Input
                  placeholder="Engineering"
                  value={recipientRole}
                  onChange={(e) => setRecipientRole(e.target.value)}
                  disabled={selectedStaffId !== 'custom'}
                  className="h-11 rounded-xl bg-background border-border text-sm font-semibold"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Email (Receipt PDF Copy)</Label>
                <Input
                  placeholder="ama@corp.com"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  disabled={selectedStaffId !== 'custom'}
                  className="h-11 rounded-xl bg-background border-border text-sm font-semibold"
                />
              </div>
            </div>

            <div className="border-t border-slate-100 pt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Payment Title / Purpose *</Label>
                  <Input
                    placeholder="e.g. May 2026 Salary Payment"
                    value={receiptTitle}
                    onChange={(e) => setReceiptTitle(e.target.value)}
                    className="h-11 rounded-xl bg-background border-border text-sm font-semibold"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Payment Date *</Label>
                  <Input
                    type="date"
                    value={receiptDate}
                    onChange={(e) => setReceiptDate(e.target.value)}
                    className="h-11 rounded-xl bg-background border-border text-sm font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Payment Method</Label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full h-11 px-4 rounded-xl border border-border bg-background text-sm font-semibold cursor-pointer focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cash">Cash Settlement</option>
                    <option value="Mobile Money">Mobile Money (Momo)</option>
                    <option value="Cheque">Bank Cheque</option>
                    <option value="Card Payment">Card Remittance</option>
                    <option value="Crypto">Digital Assets / Crypto</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Transaction REF Number (Optional)</Label>
                  <Input
                    placeholder="e.g. txn_9874561230"
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    className="h-11 rounded-xl bg-background border-border text-sm font-semibold"
                  />
                </div>
              </div>
            </div>

            {/* Itemised Breakdown rows */}
            <div className="border-t border-slate-100 pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-indigo-600" /> Disbursement Breakdown
                </p>
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm" 
                  onClick={addReceiptItemRow}
                  className="text-xs text-indigo-600 hover:bg-slate-50 font-bold px-3 py-1 bg-indigo-50/50 rounded-xl"
                >
                  <Plus className="mr-1 h-3.5 w-3.5" /> Add Breakdown Line
                </Button>
              </div>

              <div className="space-y-2.5 max-h-[180px] overflow-y-auto pr-1">
                {receiptItems.map((item, index) => (
                  <div key={index} className="flex gap-2.5 items-center">
                    <div className="flex-1">
                      <Input
                        placeholder="Description (e.g. Base salary, travel allowance)"
                        value={item.description}
                        onChange={(e) => handleReceiptItemChange(index, 'description', e.target.value)}
                        className="h-10 rounded-xl bg-background border-border text-xs font-semibold"
                      />
                    </div>
                    <div className="w-32 relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                        {workspace?.currency}
                      </span>
                      <Input
                        type="number"
                        placeholder="Amount"
                        value={item.amount || ''}
                        onChange={(e) => handleReceiptItemChange(index, 'amount', e.target.value)}
                        className="h-10 pl-11 rounded-xl bg-background border-border text-xs font-semibold"
                        min="0"
                      />
                    </div>
                    {receiptItems.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => removeReceiptItemRow(index)}
                        className="h-10 w-10 p-0 text-rose-500 hover:bg-rose-50 hover:text-rose-700 rounded-xl border border-rose-50/50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-slate-100 pt-4 space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Notes / Bank Remittance Details</Label>
                <textarea
                  placeholder="Enter notes, verification instructions, or private memo details..."
                  value={receiptNotes}
                  onChange={(e) => setReceiptNotes(e.target.value)}
                  rows={2}
                  className="w-full p-4 rounded-xl border border-style bg-background text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none"
                />
              </div>

              {/* Live grand total */}
              <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                <div>
                  <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block">Settlement Grand Total</span>
                  <p className="text-[10px] text-muted-foreground leading-none pt-1">Disbursement value in workspace currency</p>
                </div>
                <span className="text-2xl font-black text-indigo-600">
                  {workspace?.currency} {calculateReceiptTotal().toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setIsReceiptOpen(false)}
              className="rounded-xl h-11 px-5"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmitReceipt}
              className="rounded-xl h-11 px-7 bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
            >
              {editingReceipt ? 'Update Check Receipt' : 'Record & Issue Receipt'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Staff Receipt Preview Modal / Drawer */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="sm:max-w-[580px] rounded-[2.5rem] border border-border bg-card shadow-2xl p-0 overflow-hidden">
          {previewingReceipt && (
            <div className="p-8 space-y-6">
              {/* Receipt Header section */}
              <div className="flex justify-between items-start border-b border-slate-100 pb-5">
                <div className="space-y-1.5">
                  <span className="bg-indigo-600 text-white font-black px-3 py-1 rounded-full text-[10px] uppercase tracking-wider">
                    Official Payment Receipt
                  </span>
                  <h3 className="text-xl font-extrabold text-slate-800 pt-1">REC-STF-{previewingReceipt.id.slice(-6).toUpperCase()}</h3>
                  <p className="text-[11px] text-muted-foreground font-bold flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> Paid: {format(parseISO(previewingReceipt.date), 'MMMM d, yyyy')}
                  </p>
                </div>
                {workspace?.logoUrl ? (
                  <img src={workspace.logoUrl} alt="Logo" className="h-12 w-auto object-contain rounded-xl" referrerPolicy="no-referrer" />
                ) : (
                  <div className="h-12 w-12 rounded-2xl bg-indigo-600 text-white font-black text-lg flex items-center justify-center">
                    {workspace?.name.charAt(0)}
                  </div>
                )}
              </div>

              {/* Payor and Payee breakdown */}
              <div className="grid grid-cols-2 gap-8 text-[11px] font-bold border-b border-slate-100 pb-5">
                <div className="space-y-1.5">
                  <span className="text-muted-foreground uppercase tracking-widest text-[9px] font-black">Authorized Disburser:</span>
                  <p className="text-slate-800 text-xs font-black">{workspace?.name}</p>
                  <p className="text-muted-foreground font-semibold text-[10px]">{workspace?.businessEmail}</p>
                  <p className="text-muted-foreground font-semibold text-[10px]">{workspace?.businessAddress}</p>
                </div>
                <div className="space-y-1.5">
                  <span className="text-muted-foreground uppercase tracking-widest text-[9px] font-black">Settled Payee:</span>
                  <p className="text-slate-800 text-xs font-black">{previewingReceipt.recipientName}</p>
                  {previewingReceipt.recipientRole && (
                    <p className="text-indigo-600 text-[10px] font-black">{previewingReceipt.recipientRole}</p>
                  )}
                  {previewingReceipt.recipientEmail && (
                    <p className="text-muted-foreground font-semibold text-[10px]">{previewingReceipt.recipientEmail}</p>
                  )}
                </div>
              </div>

              {/* Main Receipt items check list */}
              <div className="space-y-3">
                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block">Payment Allocation Particulars</span>
                <div className="space-y-2">
                  {previewingReceipt.items?.map((item, id) => (
                    <div key={id} className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100/50 text-xs font-bold">
                      <span className="text-slate-700">{item.description}</span>
                      <span className="text-slate-900 font-mono">
                        {previewingReceipt.currency} {item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Settlement specifics */}
              <div className="space-y-1 text-slate-600 text-[11px] font-bold bg-slate-100/30 p-4 rounded-2xl border border-slate-100/80">
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">Payment Method:</span>
                  <span className="text-slate-800">{previewingReceipt.paymentMethod}</span>
                </div>
                {previewingReceipt.referenceNumber && (
                  <div className="flex justify-between py-1">
                    <span className="text-muted-foreground">Settlement Reference:</span>
                    <span className="text-slate-800 font-mono text-[10px] select-all">{previewingReceipt.referenceNumber}</span>
                  </div>
                )}
                {previewingReceipt.notes && (
                  <div className="pt-2 border-t border-slate-100 mt-2 text-[10px] font-semibold text-slate-500 leading-relaxed whitespace-pre-wrap">
                    {previewingReceipt.notes}
                  </div>
                )}
              </div>

              <div className="flex justify-between items-center pt-2">
                <div>
                  <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest block">Receipt Outflow Total</span>
                  <span className="text-2xl font-black text-indigo-600">
                    {previewingReceipt.currency} {(previewingReceipt.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setIsPreviewOpen(false)}
                    className="rounded-xl h-11 px-4 text-xs font-bold border-slate-200"
                  >
                    Close
                  </Button>
                  <Button
                    onClick={() => downloadReceiptPDF(previewingReceipt)}
                    className="rounded-xl h-11 px-5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs"
                  >
                    <Download className="mr-1.5 h-4 w-4" /> Download PDF Receipt
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
