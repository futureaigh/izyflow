import { useState, useMemo } from 'react';
import { Workspace, Contact } from '../types';
import { api } from '../lib/api';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from './ui/table';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Badge } from './ui/badge';
import { 
  Users, 
  Plus, 
  Search, 
  Mail, 
  Phone, 
  Briefcase, 
  Trash2, 
  Edit3, 
  FileText, 
  TrendingUp, 
  Check, 
  X,
  MapPin,
  Copy,
  ArrowUpRight,
  Receipt
} from 'lucide-react';

interface ClientsProps {
  workspace: Workspace | null;
  contacts: Contact[];
  invoices: any[];
}

export function Clients({ workspace, contacts, invoices }: ClientsProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newBusinessName, setNewBusinessName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newNotes, setNewNotes] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editBusinessName, setEditBusinessName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editNotes, setEditNotes] = useState('');

  const [viewingClientInvoices, setViewingClientInvoices] = useState<Contact | null>(null);

  const clientInvoices = useMemo(() => {
    if (!viewingClientInvoices) return [];
    const nameLower = viewingClientInvoices.name.toLowerCase().trim();
    return invoices.filter(inv => (inv.clientName || '').toLowerCase().trim() === nameLower);
  }, [viewingClientInvoices, invoices]);

  const clientInvoiceSummary = useMemo(() => {
    let totalInvoiced = 0, totalPaid = 0, totalOutstanding = 0;
    clientInvoices.forEach(inv => {
      totalInvoiced += inv.amount || 0;
      const status = (inv.status || '').toLowerCase();
      if (status === 'paid') totalPaid += inv.amount || 0;
      else if (status !== 'draft') totalOutstanding += inv.amount || 0;
    });
    return { totalInvoiced, totalPaid, totalOutstanding };
  }, [clientInvoices]);

  const stats = useMemo(() => {
    const total = contacts.length;
    const invoiceStats: Record<string, { total: number; count: number }> = {};
    invoices.forEach(inv => {
      const nameKey = (inv.clientName || '').toLowerCase().trim();
      if (nameKey) {
        if (!invoiceStats[nameKey]) invoiceStats[nameKey] = { total: 0, count: 0 };
        invoiceStats[nameKey].total += inv.amount || 0;
        invoiceStats[nameKey].count += 1;
      }
    });
    let billedClientsCount = 0;
    contacts.forEach(c => {
      if (invoiceStats[c.name.toLowerCase().trim()]?.count > 0) billedClientsCount++;
    });
    return { total, billedClientsCount, invoiceStats };
  }, [contacts, invoices]);

  const filteredContacts = useMemo(() => {
    if (!searchQuery.trim()) return contacts;
    const query = searchQuery.toLowerCase();
    return contacts.filter(c =>
      c.name.toLowerCase().includes(query) ||
      (c.email || '').toLowerCase().includes(query) ||
      (c.phone || '').toLowerCase().includes(query) ||
      (c.notes || '').toLowerCase().includes(query) ||
      (c.businessName || '').toLowerCase().includes(query)
    );
  }, [contacts, searchQuery]);

  const addClient = async () => {
    if (!workspace) { toast.error('No active workspace'); return; }
    if (!newName.trim()) { toast.error('Client name is required'); return; }
    try {
      await api.createContact(workspace.id, {
        name: newName.trim(),
        businessName: newBusinessName.trim(),
        email: newEmail.trim(),
        phone: newPhone.trim(),
        notes: newNotes.trim(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      setNewName(''); setNewBusinessName(''); setNewEmail(''); setNewPhone(''); setNewNotes('');
      setIsAdding(false);
      window.dispatchEvent(new CustomEvent('refresh-data'));
      toast.success('Client profile created successfully!');
    } catch { toast.error('Failed to create client'); }
  };

  const deleteClient = async (id: string, name: string) => {
    if (!workspace) return;
    if (!confirm(`Are you sure you want to delete ${name}?`)) return;
    try {
      await api.deleteContact(workspace.id, id);
      window.dispatchEvent(new CustomEvent('refresh-data'));
      toast.success('Client profile deleted');
    } catch { toast.error('Failed to delete client'); }
  };

  const startEdit = (c: Contact) => {
    setEditingId(c.id);
    setEditName(c.name);
    setEditBusinessName(c.businessName || '');
    setEditEmail(c.email || '');
    setEditPhone(c.phone || '');
    setEditNotes(c.notes || '');
  };

  const saveEdit = async () => {
    if (!workspace || !editingId) return;
    if (!editName.trim()) { toast.error('Client name cannot be empty'); return; }
    try {
      await api.updateContact(workspace.id, editingId, {
        name: editName.trim(),
        businessName: editBusinessName.trim(),
        email: editEmail.trim(),
        phone: editPhone.trim(),
        notes: editNotes.trim(),
        updatedAt: new Date().toISOString()
      });
      setEditingId(null);
      window.dispatchEvent(new CustomEvent('refresh-data'));
      toast.success('Client profile updated');
    } catch { toast.error('Failed to update client'); }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 md:px-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <Users className="h-10 w-10 text-indigo-600" />
            Clients Directory
          </h1>
          <p className="text-muted-foreground font-medium mt-1">
            Manage your client profiles, contact information, notes, and invoicing records.
          </p>
        </div>
        <Button
          onClick={() => setIsAdding(!isAdding)}
          className="rounded-xl h-11 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition-all active:scale-95 shadow-lg shadow-indigo-600/10 flex items-center gap-2 self-start md:self-auto"
        >
          {isAdding ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {isAdding ? 'Close Form' : 'Add New Client'}
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <Card className="border-border bg-card/50 backdrop-blur-xl shadow-lg rounded-[2rem] overflow-hidden">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs uppercase font-black text-muted-foreground tracking-wider">Total Clients</span>
              <p className="text-4xl font-black text-slate-900">{stats.total}</p>
            </div>
            <div className="p-4 bg-blue-500/10 rounded-2xl text-blue-600">
              <Users className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-border bg-card/50 backdrop-blur-xl shadow-lg rounded-[2rem] overflow-hidden">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs uppercase font-black text-muted-foreground tracking-wider">Active Billing</span>
              <p className="text-4xl font-black text-slate-900">{stats.billedClientsCount}</p>
            </div>
            <div className="p-4 bg-emerald-500/10 rounded-2xl text-emerald-600">
              <TrendingUp className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-border bg-card/50 backdrop-blur-xl shadow-lg rounded-[2rem] overflow-hidden">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs uppercase font-black text-muted-foreground tracking-wider">Unbilled Profiles</span>
              <p className="text-4xl font-black text-slate-900">{stats.total - stats.billedClientsCount}</p>
            </div>
            <div className="p-4 bg-amber-500/10 rounded-2xl text-amber-600">
              <FileText className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {isAdding && (
        <Card className="border-indigo-100 bg-indigo-50/20 backdrop-blur-xl shadow-xl rounded-[2.5rem] overflow-hidden border">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl font-black text-slate-900 flex items-center gap-2">
              <Plus className="h-5 w-5 text-indigo-600" />
              Create Client Profile
            </CardTitle>
            <CardDescription className="font-semibold text-slate-500">Provide direct contact details to speed up invoice generation.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-xs uppercase font-black text-slate-700 tracking-wider">Client Name *</Label>
                <Input placeholder="e.g. John Doe" value={newName} onChange={(e) => setNewName(e.target.value)} className="rounded-xl h-11 border-border bg-background" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase font-black text-slate-700 tracking-wider">Company / Business Name (Optional)</Label>
                <Input placeholder="e.g. Acme Corporation" value={newBusinessName} onChange={(e) => setNewBusinessName(e.target.value)} className="rounded-xl h-11 border-border bg-background" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase font-black text-slate-700 tracking-wider">Client Email (Optional)</Label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                  <Input type="email" placeholder="e.g. billing@company.com" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className="rounded-xl h-11 pl-10 border-border bg-background" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase font-black text-slate-700 tracking-wider">Client Phone (Optional)</Label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                  <Input placeholder="e.g. +233 24 123 4567" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} className="rounded-xl h-11 pl-10 border-border bg-background" />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase font-black text-slate-700 tracking-wider">Notes / Address / Tax Details (Optional)</Label>
              <Textarea placeholder="e.g. Physical Address, Tax Identification Number (TIN), or custom notes about this account" value={newNotes} onChange={(e) => setNewNotes(e.target.value)} className="rounded-xl border-border bg-background min-h-[100px]" />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="ghost" onClick={() => setIsAdding(false)} className="rounded-xl h-11 px-6 font-bold">Cancel</Button>
              <Button onClick={addClient} className="rounded-xl h-11 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-black">Save Client Profile</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-border bg-card/50 backdrop-blur-xl shadow-xl rounded-[2.5rem] overflow-hidden">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-xl font-black text-slate-900">All Client Accounts</CardTitle>
              <CardDescription className="font-semibold text-slate-500">A total of {filteredContacts.length} clients found.</CardDescription>
            </div>
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
              <Input placeholder="Search by name, company, email..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="rounded-xl h-10 pl-10 border-border bg-background/80" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow className="border-border">
                  <TableHead className="font-black text-xs uppercase tracking-wider pl-6 py-4">Client / Company</TableHead>
                  <TableHead className="font-black text-xs uppercase tracking-wider py-4">Contact Information</TableHead>
                  <TableHead className="font-black text-xs uppercase tracking-wider py-4">Notes & Bio</TableHead>
                  <TableHead className="font-black text-xs uppercase tracking-wider py-4 text-right">Invoiced To Date</TableHead>
                  <TableHead className="font-black text-xs uppercase tracking-wider pr-6 py-4 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredContacts.map(contact => {
                  const nameKey = contact.name.toLowerCase().trim();
                  const billing = stats.invoiceStats[nameKey] || { total: 0, count: 0 };
                  const isEditingThis = editingId === contact.id;
                  return (
                    <TableRow key={contact.id} className="hover:bg-muted/10 border-border transition-colors">
                      <TableCell className="pl-6 py-4">
                        {isEditingThis ? (
                          <div className="space-y-2 max-w-[200px]">
                            <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Client Name" className="h-9 rounded-lg bg-background text-sm" />
                            <Input value={editBusinessName} onChange={(e) => setEditBusinessName(e.target.value)} placeholder="Company" className="h-9 rounded-lg bg-background text-sm" />
                          </div>
                        ) : (
                          <div>
                            <p className="font-black text-slate-900 leading-tight text-base">{contact.name}</p>
                            {contact.businessName && (
                              <p className="text-xs text-indigo-600 font-bold mt-0.5 flex items-center gap-1">
                                <Briefcase className="h-3 w-3" />
                                {contact.businessName}
                              </p>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="py-4">
                        {isEditingThis ? (
                          <div className="space-y-2 max-w-[200px]">
                            <Input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} placeholder="Email" className="h-9 rounded-lg bg-background text-sm" />
                            <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} placeholder="Phone" className="h-9 rounded-lg bg-background text-sm" />
                          </div>
                        ) : (
                          <div className="space-y-1 text-sm font-medium">
                            {contact.email ? (
                              <p className="text-slate-700 flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-slate-400" />{contact.email}</p>
                            ) : (
                              <p className="text-slate-300 italic text-xs">No email</p>
                            )}
                            {contact.phone && (
                              <p className="text-slate-500 flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-slate-400" />{contact.phone}</p>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="py-4 max-w-[300px]">
                        {isEditingThis ? (
                          <Textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} placeholder="Client notes/address" className="rounded-lg bg-background text-sm min-h-[60px]" />
                        ) : (
                          <div className="text-xs text-slate-600 leading-relaxed truncate max-w-[280px]">
                            {contact.notes ? (
                              <p className="flex items-start gap-1"><MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" /><span className="whitespace-pre-line">{contact.notes}</span></p>
                            ) : (
                              <span className="text-slate-300 italic">No notes or address added</span>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right py-4">
                        <button
                          type="button"
                          onClick={() => billing.count > 0 && setViewingClientInvoices(contact)}
                          className={cn("text-right focus:outline-none transition-all group ml-auto flex flex-col items-end", billing.count > 0 ? "hover:scale-105 cursor-pointer active:scale-95" : "cursor-default")}
                          disabled={billing.count === 0}
                        >
                          <p className={cn("font-black text-base transition-colors", billing.count > 0 ? "text-indigo-600 group-hover:text-indigo-800" : "text-slate-900")}>
                            {workspace?.currency || 'GH₵'} {billing.total.toLocaleString()}
                          </p>
                          <p className={cn("text-xs font-bold mt-0.5 transition-colors flex items-center justify-end gap-1", billing.count > 0 ? "text-indigo-400 group-hover:text-indigo-600" : "text-slate-400")}>
                            {billing.count} {billing.count === 1 ? 'Invoice' : 'Invoices'}
                            {billing.count > 0 && <ArrowUpRight className="h-3 w-3" />}
                          </p>
                        </button>
                      </TableCell>
                      <TableCell className="text-right pr-6 py-4">
                        <div className="flex items-center justify-end gap-1.5">
                          {isEditingThis ? (
                            <>
                              <Button size="sm" onClick={saveEdit} className="h-8 w-8 p-0 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"><Check className="h-4 w-4" /></Button>
                              <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} className="h-8 w-8 p-0 rounded-lg"><X className="h-4 w-4" /></Button>
                            </>
                          ) : (
                            <>
                              <Button variant="ghost" size="sm" onClick={() => setViewingClientInvoices(contact)} className="text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 h-8 w-8 p-0 rounded-lg" title="View Invoices"><Receipt className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="sm" onClick={() => startEdit(contact)} className="text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 h-8 w-8 p-0 rounded-lg"><Edit3 className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="sm" onClick={() => deleteClient(contact.id, contact.name)} className="text-slate-500 hover:text-rose-600 hover:bg-rose-50 h-8 w-8 p-0 rounded-lg"><Trash2 className="h-4 w-4" /></Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filteredContacts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12">
                      <div className="space-y-3">
                        <div className="mx-auto w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-400"><Users className="h-6 w-6" /></div>
                        <div>
                          <p className="font-bold text-slate-700">No client profiles found</p>
                          <p className="text-sm text-slate-400">Search query returned no results, or you haven't added any clients yet.</p>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!viewingClientInvoices} onOpenChange={(open) => !open && setViewingClientInvoices(null)}>
        <DialogContent className="sm:max-w-[700px] rounded-[2.5rem] border-border bg-card shadow-2xl p-6 overflow-hidden max-h-[85vh] flex flex-col">
          <DialogHeader className="pb-4 border-b border-border">
            <DialogTitle className="text-2xl font-black text-slate-900 flex items-center gap-2">
              <Receipt className="h-6 w-6 text-indigo-600" />
              Invoices History
            </DialogTitle>
            <DialogDescription className="font-semibold text-slate-500">
              Invoiced history and payments for <span className="text-indigo-600 font-bold">{viewingClientInvoices?.name}</span>
              {viewingClientInvoices?.email && ` (${viewingClientInvoices.email})`}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-4 py-4">
            <div className="bg-slate-50 border border-slate-100 p-3.5 rounded-2xl">
              <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Total Billed</span>
              <p className="text-lg font-black text-slate-900 mt-1">{workspace?.currency || 'GH₵'} {clientInvoiceSummary.totalInvoiced.toLocaleString()}</p>
            </div>
            <div className="bg-emerald-50/50 border border-emerald-100/50 p-3.5 rounded-2xl">
              <span className="text-[10px] uppercase font-black text-emerald-600 tracking-wider">Total Paid</span>
              <p className="text-lg font-black text-emerald-700 mt-1">{workspace?.currency || 'GH₵'} {clientInvoiceSummary.totalPaid.toLocaleString()}</p>
            </div>
            <div className="bg-amber-50/50 border border-amber-100/50 p-3.5 rounded-2xl">
              <span className="text-[10px] uppercase font-black text-amber-600 tracking-wider">Outstanding</span>
              <p className="text-lg font-black text-amber-700 mt-1">{workspace?.currency || 'GH₵'} {clientInvoiceSummary.totalOutstanding.toLocaleString()}</p>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto pr-1 scrollbar-thin py-2">
            {clientInvoices.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground italic">No invoices found for this client.</div>
            ) : (
              <div className="rounded-2xl border border-border overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow className="border-border">
                      <TableHead className="font-black text-[10px] uppercase tracking-wider py-3">Invoice Ref</TableHead>
                      <TableHead className="font-black text-[10px] uppercase tracking-wider py-3">Due Date</TableHead>
                      <TableHead className="font-black text-[10px] uppercase tracking-wider py-3">Status</TableHead>
                      <TableHead className="font-black text-[10px] uppercase tracking-wider py-3 text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clientInvoices.map((inv) => {
                      const status = (inv.status || '').toLowerCase();
                      const isPaid = status === 'paid';
                      const isOverdue = status === 'overdue';
                      const isDraft = status === 'draft';
                      return (
                        <TableRow key={inv.id} className="hover:bg-muted/10 border-border">
                          <TableCell className="font-black text-slate-900 py-3">
                            <div className="flex items-center gap-1">
                              <span className="font-mono">INV-{inv.id.slice(-6).toUpperCase()}</span>
                              <Button size="icon" variant="ghost" className="h-5 w-5 rounded-md hover:bg-muted text-slate-400 hover:text-slate-600"
                                onClick={() => { navigator.clipboard.writeText(inv.id); toast.success('Invoice ID copied!'); }}
                              ><Copy className="h-3 w-3" /></Button>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-slate-500 font-medium py-3">
                            {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
                          </TableCell>
                          <TableCell className="py-3">
                            <Badge className={cn("rounded-full font-black text-[10px] px-2 py-0.5",
                              isPaid && "bg-emerald-500/15 text-emerald-600 border border-emerald-500/10",
                              isOverdue && "bg-rose-500/15 text-rose-600 border border-rose-500/10",
                              isDraft && "bg-slate-500/15 text-slate-600 border border-slate-500/10",
                              !isPaid && !isOverdue && !isDraft && "bg-blue-500/15 text-blue-600 border border-blue-500/10"
                            )}>{inv.status?.toUpperCase() || 'UNPAID'}</Badge>
                          </TableCell>
                          <TableCell className="font-bold text-slate-900 text-right py-3">
                            {workspace?.currency || 'GH₵'} {inv.amount?.toLocaleString()}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
          <DialogFooter className="pt-4 border-t border-border mt-auto">
            <Button onClick={() => setViewingClientInvoices(null)} className="rounded-xl h-11 px-6 bg-slate-900 hover:bg-slate-800 text-white font-bold">Close History</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
