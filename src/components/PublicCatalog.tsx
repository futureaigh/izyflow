import { useState, useEffect } from 'react';
import { db, handleFirestoreError } from '../firebase';
import { collection, onSnapshot, addDoc, doc, query, orderBy, getDoc, getDocs, writeBatch } from 'firebase/firestore';
import { Workspace, CatalogItem, Currency, Account, AllocationRule } from '../types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { 
  Package, 
  ShoppingCart, 
  Check, 
  Zap, 
  ArrowRight, 
  Building2, 
  CreditCard, 
  Loader2,
  ChevronRight,
  ShieldCheck,
  Globe
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from './ui/dialog';
import { Badge } from './ui/badge';

interface PublicCatalogProps {
  workspaceId: string;
}

export function PublicCatalog({ workspaceId }: PublicCatalogProps) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<{item: CatalogItem, quantity: number}[]>([]);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  
  // Checkout Form
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const fetchWorkspace = async () => {
      try {
        const wsDoc = await getDoc(doc(db, 'workspaces', workspaceId));
        if (wsDoc.exists()) {
          setWorkspace({ id: wsDoc.id, ...wsDoc.data() } as Workspace);
        } else {
          toast.error('Workspace not found');
        }
      } catch (error) {
        console.error(error);
      }
    };

    const fetchItems = () => {
      const q = query(
        collection(db, `workspaces/${workspaceId}/catalogItems`),
        orderBy('name', 'asc')
      );
      return onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CatalogItem));
        setItems(data);
        localStorage.setItem(`public_catalog_${workspaceId}`, JSON.stringify(data));
        setLoading(false);
      }, (error) => {
        const result: any = handleFirestoreError(error, 'list', 'catalogItems');
        if (result?.isQuotaError) {
          const cached = localStorage.getItem(`public_catalog_${workspaceId}`);
          if (cached) setItems(JSON.parse(cached));
        }
        setLoading(false);
      });
    };

    fetchWorkspace();
    const unsub = fetchItems();
    return () => unsub();
  }, [workspaceId]);

  const addToCart = (item: CatalogItem) => {
    setCart(prev => {
      const existing = prev.find(i => i.item.id === item.id);
      if (existing) {
        return prev.map(i => i.item.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { item, quantity: 1 }];
    });
    toast.success(`${item.name} added to cart`);
  };

  const removeFromCart = (itemId: string) => {
    setCart(prev => prev.filter(i => i.item.id !== itemId));
  };

  const cartTotal = cart.reduce((sum, entry) => sum + (entry.item.price * entry.quantity), 0);

  const handleCheckout = async () => {
    if (!workspace) return;
    if (!customerName || !customerEmail) {
      toast.error('Please provide your details');
      return;
    }

    setIsProcessing(true);
    try {
      const batch = writeBatch(db);
      const invoiceId = Math.random().toString(36).substr(2, 9).toUpperCase();
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 7);

      const invoiceData = {
        workspaceId: workspace.id,
        clientName: customerName,
        clientEmail: customerEmail,
        amount: cartTotal,
        currency: workspace.currency,
        status: 'Paid', // Assuming instant payment for catalog orders
        createdAt: new Date().toISOString(),
        dueDate: dueDate.toISOString(),
        updatedAt: new Date().toISOString(),
        items: cart.map(c => ({
          name: c.item.name,
          description: c.item.description,
          quantity: c.quantity,
          price: c.item.price
        })),
        paidAmount: cartTotal,
        introduction: `Order placed via public catalog by ${customerName}.`
      };

      // 1. Create Invoice
      const invoiceRef = doc(collection(db, `workspaces/${workspace.id}/invoices`));
      batch.set(invoiceRef, invoiceData);

      // 2. Create Transaction
      const transactionRef = doc(collection(db, `workspaces/${workspace.id}/transactions`));
      
      const accountsSnap = await getDocs(collection(db, `workspaces/${workspace.id}/accounts`));
      const rulesSnap = await getDocs(collection(db, `workspaces/${workspace.id}/allocationRules`));
      
      batch.set(transactionRef, {
        workspaceId: workspace.id,
        type: 'Income',
        amount: cartTotal,
        currency: workspace.currency,
        category: 'Catalog Sale',
        date: new Date().toISOString().split('T')[0],
        time: format(new Date(), 'HH:mm'),
        description: `Sale to ${customerName} via Public Catalog`,
        payeePayer: customerName,
        invoiceId: invoiceRef.id,
        accountId: rulesSnap.docs.length > 0 ? 'auto-allocate' : (accountsSnap.docs.find(d => d.data().isDefault)?.id || accountsSnap.docs[0]?.id || ''),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      // 3. Split Revenue
      const accounts = accountsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account));
      const rules = rulesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AllocationRule));

      rules.forEach(rule => {
        const allocationAmount = (cartTotal * rule.percentage) / 100;
        const account = accounts.find(a => a.id === rule.targetAccountId);
        if (account) {
          const accountRef = doc(db, `workspaces/${workspace.id}/accounts`, account.id);
          batch.update(accountRef, { balance: account.balance + allocationAmount });
        }
      });

      await batch.commit();
      setSuccess(true);
      toast.success('Order placed successfully!');
    } catch (error) {
      console.error(error);
      toast.error('Failed to process order');
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center text-white font-black uppercase tracking-widest">
        Catalogue Not Found
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-card border-none rounded-[3rem] p-10 text-center space-y-6 shadow-2xl"
        >
          <div className="h-20 w-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto">
            <Check className="h-10 w-10 text-emerald-500" />
          </div>
          <div className="space-y-2">
            <h2 className="text-3xl font-black tracking-tight">Order Confirmed!</h2>
            <p className="text-muted-foreground font-medium">Thank you for your order, {customerName}. An invoice has been generated and sent to {customerEmail}.</p>
          </div>
          <Button onClick={() => window.location.reload()} className="w-full h-14 rounded-2xl bg-purple-600 hover:bg-purple-700 font-bold text-lg">
            Return to Catalog
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-foreground font-sans">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#050505]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-xl bg-purple-600 flex items-center justify-center overflow-hidden">
              {workspace.logoUrl ? (
                <img src={workspace.logoUrl} alt={workspace.name} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <Building2 className="h-5 w-5 text-white" />
              )}
            </div>
            <div>
              <h1 className="font-extrabold text-lg leading-none text-white">{workspace.name}</h1>
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-[0.2em] mt-1 flex items-center gap-1.5">
                <Globe className="h-3 w-3" /> Digital Showcase
              </p>
            </div>
          </div>
          
          <Button 
            className="rounded-full bg-white text-black hover:bg-white/90 px-6 font-black text-xs uppercase tracking-widest gap-2 h-11"
            onClick={() => setIsCheckingOut(true)}
            disabled={cart.length === 0}
          >
            <ShoppingCart className="h-4 w-4" />
            Cart ({cart.length})
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-12">
          {/* Main Content */}
          <div className="lg:col-span-3 space-y-12">
            <div className="space-y-4">
              <h2 className="text-5xl font-black tracking-tighter text-white">Our Catalog</h2>
              <p className="text-xl text-muted-foreground max-w-2xl font-medium leading-relaxed">
                Premium services and products offered by {workspace.name}. Select items to generate your quote and proceed.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {items.map((item) => (
                <Card key={item.id} className="bg-[#0A0A0A] border-white/5 overflow-hidden hover:border-purple-500/50 transition-all group flex flex-col">
                  <CardHeader className="p-8 pb-4">
                    <div className="flex justify-between items-start mb-4">
                      <Badge variant="outline" className={cn(
                        "text-[10px] font-black uppercase px-2 py-0.5 rounded-md border-none",
                        item.type === 'Product' ? "bg-amber-500/10 text-amber-500" : "bg-blue-500/10 text-blue-500"
                      )}>
                        {item.type}
                      </Badge>
                      <div className="text-3xl font-black text-white">
                        {item.currency} {item.price.toLocaleString()}
                      </div>
                    </div>
                    <CardTitle className="text-2xl font-black tracking-tight text-white group-hover:text-purple-400 transition-colors">
                      {item.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-8 pt-0 flex-1 flex flex-col justify-between space-y-6">
                    <p className="text-muted-foreground font-medium leading-relaxed">
                      {item.description || 'Professional grade service tailored to your requirements.'}
                    </p>
                    <Button 
                      onClick={() => addToCart(item)}
                      className="w-full h-14 rounded-2xl bg-white/5 hover:bg-white text-white hover:text-black font-black uppercase tracking-widest text-xs transition-all"
                    >
                      Add to Selection
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Sidebar / Cart Preview */}
          <div className="hidden lg:block">
            <div className="sticky top-32 space-y-6">
              <Card className="bg-[#0A0A0A] border-white/5 rounded-3xl overflow-hidden">
                <CardHeader className="p-6 border-b border-white/5">
                  <CardTitle className="text-lg font-black text-white flex items-center justify-between">
                    Your Selection
                    <ShoppingCart className="h-4 w-4 opacity-50" />
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  {cart.length === 0 ? (
                    <div className="text-center py-8 space-y-3">
                      <Package className="h-10 w-10 text-white/10 mx-auto" />
                      <p className="text-sm text-muted-foreground font-bold">Your cart is empty</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {cart.map((entry) => (
                        <div key={entry.item.id} className="flex justify-between items-center group">
                          <div className="space-y-0.5">
                            <p className="text-sm font-bold text-white leading-none">{entry.item.name}</p>
                            <p className="text-[10px] text-muted-foreground font-bold uppercase">Qty: {entry.quantity}</p>
                          </div>
                          <button onClick={() => removeFromCart(entry.item.id)} className="text-xs text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity font-bold">Remove</button>
                        </div>
                      ))}
                      <div className="pt-4 border-t border-white/10 flex justify-between items-end">
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Total Estimate</p>
                        <p className="text-2xl font-black text-white">{workspace.currency} {cartTotal.toLocaleString()}</p>
                      </div>
                      <Button 
                        onClick={() => setIsCheckingOut(true)}
                        className="w-full h-14 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-black uppercase tracking-widest text-xs shadow-xl shadow-purple-900/20"
                      >
                        Proceed to Checkout
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 flex gap-3 text-emerald-400">
                <ShieldCheck className="h-5 w-5 shrink-0" />
                <p className="text-[10px] font-bold leading-relaxed">
                  Secure invoice generation. All orders are processed directly by {workspace.name}.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Checkout Dialog */}
      <Dialog open={isCheckingOut} onOpenChange={setIsCheckingOut}>
        <DialogContent className="sm:max-w-[450px] bg-card border-none rounded-[2.5rem] p-10 shadow-2xl overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 via-blue-500 to-emerald-500" />
          
          <DialogHeader className="mb-6">
            <DialogTitle className="text-3xl font-black tracking-tight">Final Details</DialogTitle>
            <DialogDescription className="font-medium text-muted-foreground">
              We'll use these details to generate your invoice and complete the order.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Your Name / Business</Label>
              <Input 
                value={customerName} 
                onChange={(e) => setCustomerName(e.target.value)} 
                placeholder="John Doe" 
                className="h-14 rounded-2xl border-border bg-muted/30 font-bold"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Email Address</Label>
              <Input 
                type="email"
                value={customerEmail} 
                onChange={(e) => setCustomerEmail(e.target.value)} 
                placeholder="john@example.com" 
                className="h-14 rounded-2xl border-border bg-muted/30 font-bold"
              />
            </div>

            <div className="p-6 rounded-3xl bg-muted/50 space-y-2">
              <div className="flex justify-between items-center text-xs text-muted-foreground font-bold uppercase">
                <span>Items Subtotal</span>
                <span>{workspace.currency} {cartTotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center text-xl font-black text-foreground">
                <span>Total to Pay</span>
                <span>{workspace.currency} {cartTotal.toLocaleString()}</span>
              </div>
            </div>

            <Button 
              onClick={handleCheckout}
              disabled={isProcessing}
              className="w-full h-16 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-black text-lg transition-all flex items-center justify-center gap-3 active:scale-95"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-6 w-6 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Zap className="h-6 w-6" />
                  Pay & Confirm Order
                </>
              )}
            </Button>
            
            <p className="text-center text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
              By confirming, you agree to our terms of service
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Floating Cart for Mobile */}
      <div className="lg:hidden fixed bottom-6 right-6 z-50">
        <Button 
          className="h-16 w-16 rounded-full bg-purple-600 text-white shadow-2xl flex items-center justify-center p-0"
          onClick={() => setIsCheckingOut(true)}
        >
          <ShoppingCart className="h-6 w-6" />
          {cart.length > 0 && (
            <span className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-emerald-500 text-white text-[10px] font-black flex items-center justify-center border-2 border-[#050505]">
              {cart.length}
            </span>
          )}
        </Button>
      </div>
    </div>
  );
}
