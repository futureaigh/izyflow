import { useEffect, useState } from 'react';
import { EXCHANGE_RATES } from '../constants';
import { Workspace, Account, AllocationRule, Currency, PaymentMethod, Contact } from '../types';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Badge } from './ui/badge';
import { Plus, Trash2, Save, Percent, Wallet, Info, Settings as SettingsIcon, CreditCard, Zap, Image as ImageIcon, Tag, User as UserIcon, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { UserProfile } from '../types';
import { motion, AnimatePresence } from 'motion/react';

interface SettingsProps {
  workspace: Workspace | null;
  user: UserProfile | null;
}

export function Settings({ workspace, user }: SettingsProps) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [rules, setRules] = useState<AllocationRule[]>([]);
  const [newAccountName, setNewAccountName] = useState('');
  const [newRuleName, setNewRuleName] = useState('');
  const [newRulePercentage, setNewRulePercentage] = useState(0);
  const [newRuleAccountId, setNewRuleAccountId] = useState('');

  const [workspaceName, setWorkspaceName] = useState(workspace?.name || '');
  const [workspaceDescription, setWorkspaceDescription] = useState(workspace?.description || '');
  const [workspaceLogoUrl, setWorkspaceLogoUrl] = useState(workspace?.logoUrl || '');
  const [salesTarget, setSalesTarget] = useState(workspace?.salesTarget || 0);
  const [retainerTarget, setRetainerTarget] = useState(workspace?.retainerTarget || 0);
  const [businessAddress, setBusinessAddress] = useState(workspace?.businessAddress || '');
  const [businessPhone, setBusinessPhone] = useState(workspace?.businessPhone || '');
  const [businessEmail, setBusinessEmail] = useState(workspace?.businessEmail || '');
  const [taxId, setTaxId] = useState(workspace?.taxId || '');
  const [bankName, setBankName] = useState(workspace?.bankName || '');
  const [bankBranch, setBankBranch] = useState(workspace?.bankBranch || '');
  const [accountNumber, setAccountNumber] = useState(workspace?.accountNumber || '');
  const [mobileMoneyProvider, setMobileMoneyProvider] = useState(workspace?.mobileMoneyProvider || '');
  const [mobileMoneyNumber, setMobileMoneyNumber] = useState(workspace?.mobileMoneyNumber || '');
  const [onlinePaymentUrl, setOnlinePaymentUrl] = useState(workspace?.onlinePaymentUrl || '');
  const [brandColor, setBrandColor] = useState(workspace?.brandColor || '#2563eb');
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>(workspace?.paymentMethods || []);
  const [newPaymentType, setNewPaymentType] = useState<'Bank' | 'Mobile Money' | 'Online'>('Bank');
  const [newPaymentProvider, setNewPaymentProvider] = useState('');
  const [newPaymentBranch, setNewPaymentBranch] = useState('');
  const [newPaymentAccountName, setNewPaymentAccountName] = useState('');
  const [newPaymentAccountNumber, setNewPaymentAccountNumber] = useState('');
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [editPaymentType, setEditPaymentType] = useState<'Bank' | 'Mobile Money' | 'Online'>('Bank');
  const [editPaymentProvider, setEditPaymentProvider] = useState('');
  const [editPaymentBranch, setEditPaymentBranch] = useState('');
  const [editPaymentAccountName, setEditPaymentAccountName] = useState('');
  const [editPaymentAccountNumber, setEditPaymentAccountNumber] = useState('');
  const [newIncomeCategory, setNewIncomeCategory] = useState('');
  const [newExpenseCategory, setNewExpenseCategory] = useState('');
  const [newInvestmentCategory, setNewInvestmentCategory] = useState('');
  const [editingIncomeCategory, setEditingIncomeCategory] = useState<string | null>(null);
  const [editingExpenseCategory, setEditingExpenseCategory] = useState<string | null>(null);
  const [editingInvestmentCategory, setEditingInvestmentCategory] = useState<string | null>(null);
  const [editCategoryValue, setEditCategoryValue] = useState('');
  const [activeTab, setActiveTab] = useState<'workspace' | 'categories' | 'accounts' | 'contacts' | 'preferences'>('workspace');
  const [isBusinessInfoExpanded, setIsBusinessInfoExpanded] = useState(false);
  const [isPaymentInfoExpanded, setIsPaymentInfoExpanded] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [newContactName, setNewContactName] = useState('');
  const [newContactEmail, setNewContactEmail] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [editContactName, setEditContactName] = useState('');
  const [editContactEmail, setEditContactEmail] = useState('');
  const [editContactPhone, setEditContactPhone] = useState('');

  useEffect(() => {
    if (workspace) {
      setWorkspaceName(workspace.name);
      setWorkspaceDescription(workspace.description || '');
      setWorkspaceLogoUrl(workspace.logoUrl || '');
      setSalesTarget(workspace.salesTarget || 0);
      setRetainerTarget(workspace.retainerTarget || 0);
      setBusinessAddress(workspace.businessAddress || '');
      setBusinessPhone(workspace.businessPhone || '');
      setBusinessEmail(workspace.businessEmail || '');
      setTaxId(workspace.taxId || '');
      setBankName(workspace.bankName || '');
      setBankBranch(workspace.bankBranch || '');
      setAccountNumber(workspace.accountNumber || '');
      setMobileMoneyProvider(workspace.mobileMoneyProvider || '');
      setMobileMoneyNumber(workspace.mobileMoneyNumber || '');
      setOnlinePaymentUrl(workspace.onlinePaymentUrl || '');
      setBrandColor(workspace.brandColor || '#2563eb');
      setPaymentMethods(workspace.paymentMethods || []);
    }
  }, [workspace]);

  useEffect(() => {
    if (!workspace) return;

    const unsubscribeA = onSnapshot(collection(db, `workspaces/${workspace.id}/accounts`), (snapshot) => {
      setAccounts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account)));
    }, (error) => handleFirestoreError(error, 'list', 'accounts'));

    const unsubscribeR = onSnapshot(collection(db, `workspaces/${workspace.id}/allocationRules`), (snapshot) => {
      setRules(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AllocationRule)));
    }, (error) => handleFirestoreError(error, 'list', 'allocationRules'));

    const unsubscribeC = onSnapshot(collection(db, `workspaces/${workspace.id}/contacts`), (snapshot) => {
      setContacts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Contact)));
    }, (error) => handleFirestoreError(error, 'list', 'contacts'));

    return () => {
      unsubscribeA();
      unsubscribeR();
      unsubscribeC();
    };
  }, [workspace]);

  const addAccount = async () => {
    if (!workspace || !newAccountName) return;
    try {
      await addDoc(collection(db, `workspaces/${workspace.id}/accounts`), {
        workspaceId: workspace.id,
        name: newAccountName,
        balance: 0,
        currency: workspace.currency
      });
      setNewAccountName('');
      toast.success('Account created');
    } catch (error) {
      toast.error('Failed to create account');
    }
  };

  const addRule = async () => {
    if (!workspace || !newRuleName || !newRulePercentage || !newRuleAccountId) return;
    try {
      await addDoc(collection(db, `workspaces/${workspace.id}/allocationRules`), {
        workspaceId: workspace.id,
        name: newRuleName,
        percentage: newRulePercentage,
        targetAccountId: newRuleAccountId
      });
      setNewRuleName('');
      setNewRulePercentage(0);
      setNewRuleAccountId('');
      toast.success('Allocation rule created');
    } catch (error) {
      toast.error('Failed to create rule');
    }
  };

  const deleteAccount = async (id: string) => {
    if (!workspace) return;
    try {
      await deleteDoc(doc(db, `workspaces/${workspace.id}/accounts`, id));
      toast.success('Account deleted');
    } catch (error) {
      toast.error('Failed to delete account');
    }
  };

  const deleteRule = async (id: string) => {
    if (!workspace) return;
    try {
      await deleteDoc(doc(db, `workspaces/${workspace.id}/allocationRules`, id));
      toast.success('Rule deleted');
    } catch (error) {
      toast.error('Failed to delete rule');
    }
  };

  const updateCurrency = async (currency: Currency) => {
    if (!workspace) return;
    try {
      const oldCurrency = workspace.currency;
      if (oldCurrency === currency) return;

      const confirmConversion = window.confirm(`Do you want to auto-convert all existing account balances from ${oldCurrency} to ${currency}? (Recommended)`);
      
      const batch = writeBatch(db);
      batch.update(doc(db, 'workspaces', workspace.id), { currency });

      if (confirmConversion) {
        const targetRate = EXCHANGE_RATES[currency] || 1;
        const sourceRate = EXCHANGE_RATES[oldCurrency] || 1;
        const multiplier = targetRate / sourceRate;

        // Convert account balances
        const accountsSnapshot = await getDocs(collection(db, `workspaces/${workspace.id}/accounts`));
        accountsSnapshot.docs.forEach(accountDoc => {
          const currentBalance = accountDoc.data().balance || 0;
          batch.update(accountDoc.ref, { 
            balance: currentBalance * multiplier,
            currency: currency // Update account currency too
          });
        });

        // Note: We don't convert historical transactions/invoices because they are fixed in time.
        // But we update the workspace base currency which affects how they are viewed.
      }

      await batch.commit();
      toast.success('Currency updated' + (confirmConversion ? ' and balances converted' : ''));
    } catch (error) {
      toast.error('Failed to update currency');
    }
  };

  const updateWorkspaceDetails = async () => {
    if (!workspace) return;
    const updateData = {
      name: workspaceName,
      description: workspaceDescription,
      logoUrl: workspaceLogoUrl,
      salesTarget: Number(salesTarget),
      retainerTarget: Number(retainerTarget),
      businessAddress,
      businessPhone,
      businessEmail,
      taxId,
      bankName,
      bankBranch,
      accountNumber,
      mobileMoneyProvider,
      mobileMoneyNumber,
      onlinePaymentUrl,
      brandColor,
      paymentMethods,
      updatedAt: new Date().toISOString()
    };
    console.log('Updating workspace with data:', updateData);
    try {
      await updateDoc(doc(db, 'workspaces', workspace.id), updateData);
      toast.success('Workspace details updated');
    } catch (error) {
      handleFirestoreError(error, 'update', `workspaces/${workspace.id}`);
      toast.error('Failed to update workspace');
    }
  };

  const startEditingPayment = (method: PaymentMethod) => {
    setEditingPaymentId(method.id);
    setEditPaymentType(method.type);
    setEditPaymentProvider(method.provider);
    setEditPaymentBranch(method.branch || '');
    setEditPaymentAccountName(method.accountName);
    setEditPaymentAccountNumber(method.accountNumber);
  };

  const saveEditedPayment = () => {
    if (!editingPaymentId) return;
    setPaymentMethods(paymentMethods.map(m => 
      m.id === editingPaymentId 
        ? { 
            ...m, 
            type: editPaymentType, 
            provider: editPaymentProvider, 
            branch: editPaymentType === 'Bank' ? editPaymentBranch : undefined,
            accountName: editPaymentAccountName, 
            accountNumber: editPaymentAccountNumber 
          } 
        : m
    ));
    setEditingPaymentId(null);
    toast.success('Payment method updated');
  };

  const incomeCategories = workspace.incomeCategories || ['Sales', 'Consulting', 'Investment', 'Interest', 'Rental Income', 'Gift', 'Other'];
  const expenseCategories = workspace.expenseCategories || ['Rent', 'Software', 'Marketing', 'Salary', 'Utilities', 'Travel', 'Supplies', 'Insurance', 'Taxes', 'Maintenance', 'Entertainment', 'Food & Dining', 'Transportation', 'Other'];
  const investmentCategories = workspace.investmentCategories || ['Stocks', 'Crypto', 'Real Estate', 'Bonds', 'Mutual Funds', 'Other'];

  const addIncomeCategory = async () => {
    if (!workspace || !newIncomeCategory) return;
    try {
      const currentCategories = workspace.incomeCategories || ['Sales', 'Consulting', 'Investment', 'Interest', 'Rental Income', 'Gift', 'Other'];
      if (currentCategories.includes(newIncomeCategory)) {
        toast.error('Category already exists');
        return;
      }
      await updateDoc(doc(db, 'workspaces', workspace.id), {
        incomeCategories: [...currentCategories, newIncomeCategory],
        updatedAt: new Date().toISOString()
      });
      setNewIncomeCategory('');
      toast.success('Income category added');
    } catch (error) {
      handleFirestoreError(error, 'update', `workspaces/${workspace.id}`);
      toast.error('Failed to add category');
    }
  };

  const deleteIncomeCategory = async (category: string) => {
    if (!workspace) return;
    try {
      const currentCategories = incomeCategories;
      const updatedCategories = currentCategories.filter(c => c !== category);
      
      const batch = writeBatch(db);
      
      // Update workspace
      batch.update(doc(db, 'workspaces', workspace.id), {
        incomeCategories: updatedCategories,
        updatedAt: new Date().toISOString()
      });

      // Update transactions that used this category to a fallback
      const fallbackCategory = updatedCategories.includes('Other') ? 'Other' : (updatedCategories[0] || 'Other');
      const q = query(
        collection(db, 'workspaces', workspace.id, 'transactions'),
        where('type', '==', 'Income'),
        where('category', '==', category)
      );
      const snapshot = await getDocs(q);
      snapshot.docs.forEach((transactionDoc) => {
        batch.update(transactionDoc.ref, {
          category: fallbackCategory,
          updatedAt: new Date().toISOString()
        });
      });

      await batch.commit();
      toast.success('Income category removed and transactions updated');
    } catch (error) {
      handleFirestoreError(error, 'update', `workspaces/${workspace.id}`);
      toast.error('Failed to remove category');
    }
  };

  const addExpenseCategory = async () => {
    if (!workspace || !newExpenseCategory) return;
    try {
      const currentCategories = workspace.expenseCategories || ['Rent', 'Software', 'Marketing', 'Salary', 'Utilities', 'Travel', 'Supplies', 'Insurance', 'Taxes', 'Maintenance', 'Entertainment', 'Food & Dining', 'Transportation', 'Other'];
      if (currentCategories.includes(newExpenseCategory)) {
        toast.error('Category already exists');
        return;
      }
      await updateDoc(doc(db, 'workspaces', workspace.id), {
        expenseCategories: [...currentCategories, newExpenseCategory],
        updatedAt: new Date().toISOString()
      });
      setNewExpenseCategory('');
      toast.success('Expense category added');
    } catch (error) {
      handleFirestoreError(error, 'update', `workspaces/${workspace.id}`);
      toast.error('Failed to add category');
    }
  };

  const deleteExpenseCategory = async (category: string) => {
    if (!workspace) return;
    try {
      const currentCategories = expenseCategories;
      const updatedCategories = currentCategories.filter(c => c !== category);
      
      const batch = writeBatch(db);
      
      // Update workspace
      batch.update(doc(db, 'workspaces', workspace.id), {
        expenseCategories: updatedCategories,
        updatedAt: new Date().toISOString()
      });

      // Update transactions that used this category to a fallback
      const fallbackCategory = updatedCategories.includes('Other') ? 'Other' : (updatedCategories[0] || 'Other');
      const q = query(
        collection(db, 'workspaces', workspace.id, 'transactions'),
        where('type', '==', 'Expense'),
        where('category', '==', category)
      );
      const snapshot = await getDocs(q);
      snapshot.docs.forEach((transactionDoc) => {
        batch.update(transactionDoc.ref, {
          category: fallbackCategory,
          updatedAt: new Date().toISOString()
        });
      });

      await batch.commit();
      toast.success('Expense category removed and transactions updated');
    } catch (error) {
      handleFirestoreError(error, 'update', `workspaces/${workspace.id}`);
      toast.error('Failed to remove category');
    }
  };

  const addInvestmentCategory = async () => {
    if (!workspace || !newInvestmentCategory) return;
    try {
      // Use the latest categories from the workspace prop
      const currentCategories = workspace.investmentCategories || ['Stocks', 'Crypto', 'Real Estate', 'Bonds', 'Mutual Funds', 'Other'];
      if (currentCategories.includes(newInvestmentCategory)) {
        toast.error('Category already exists');
        return;
      }
      await updateDoc(doc(db, 'workspaces', workspace.id), {
        investmentCategories: [...currentCategories, newInvestmentCategory],
        updatedAt: new Date().toISOString()
      });
      setNewInvestmentCategory('');
      toast.success('Investment category added');
    } catch (error) {
      handleFirestoreError(error, 'update', `workspaces/${workspace.id}`);
      toast.error('Failed to add category');
    }
  };

  const deleteInvestmentCategory = async (category: string) => {
    if (!workspace) return;
    try {
      const currentCategories = workspace.investmentCategories || ['Stocks', 'Crypto', 'Real Estate', 'Bonds', 'Mutual Funds', 'Other'];
      const updatedCategories = currentCategories.filter(c => c !== category);
      
      const batch = writeBatch(db);
      
      // Update workspace
      batch.update(doc(db, 'workspaces', workspace.id), {
        investmentCategories: updatedCategories,
        updatedAt: new Date().toISOString()
      });

      // Update transactions that used this category to a fallback
      const fallbackCategory = updatedCategories.includes('Other') ? 'Other' : (updatedCategories[0] || 'Other');
      const q = query(
        collection(db, 'workspaces', workspace.id, 'transactions'),
        where('type', '==', 'Investment'),
        where('category', '==', category)
      );
      const snapshot = await getDocs(q);
      snapshot.docs.forEach((transactionDoc) => {
        batch.update(transactionDoc.ref, {
          category: fallbackCategory,
          updatedAt: new Date().toISOString()
        });
      });

      await batch.commit();
      toast.success('Investment category removed and transactions updated');
    } catch (error) {
      handleFirestoreError(error, 'update', `workspaces/${workspace.id}`);
      toast.error('Failed to remove category');
    }
  };

  const syncColorWithLogo = async () => {
    if (!workspaceLogoUrl) {
      toast.error('Please provide a logo URL first');
      return;
    }

    try {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.src = workspaceLogoUrl;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let bestColor = '#2563eb';
        let maxSaturation = -1;

        for (let i = 0; i < data.length; i += 40) {
          const r = data[i];
          const g = data[i+1];
          const b = data[i+2];
          
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const saturation = max === 0 ? 0 : (max - min) / max;
          const brightness = max / 255;

          if (saturation > 0.1 && brightness > 0.1 && brightness < 0.9) {
            if (saturation > maxSaturation) {
              maxSaturation = saturation;
              bestColor = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
            }
          }
        }
        
        setBrandColor(bestColor);
        toast.success('Brand color extracted from logo');
      };
      img.onerror = () => {
        toast.error('Could not load logo image for color extraction');
      };
    } catch (e) {
      toast.error('Failed to sync color');
    }
  };

  const renameCategory = async (type: 'income' | 'expense' | 'investment', oldCategory: string) => {
    if (!workspace || !editCategoryValue || editCategoryValue === oldCategory) {
      setEditingIncomeCategory(null);
      setEditingExpenseCategory(null);
      setEditingInvestmentCategory(null);
      return;
    }
    try {
      const currentCategories = type === 'income' 
        ? (workspace.incomeCategories || ['Sales', 'Consulting', 'Investment', 'Interest', 'Rental Income', 'Gift', 'Other'])
        : type === 'expense' 
        ? (workspace.expenseCategories || ['Rent', 'Software', 'Marketing', 'Salary', 'Utilities', 'Travel', 'Supplies', 'Insurance', 'Taxes', 'Maintenance', 'Entertainment', 'Food & Dining', 'Transportation', 'Other'])
        : (workspace.investmentCategories || ['Stocks', 'Crypto', 'Real Estate', 'Bonds', 'Mutual Funds', 'Other']);
      
      const updatedCategories = currentCategories.map(c => c === oldCategory ? editCategoryValue : c);
      
      const batch = writeBatch(db);
      
      // Update workspace
      batch.update(doc(db, 'workspaces', workspace.id), {
        [type === 'income' ? 'incomeCategories' : type === 'expense' ? 'expenseCategories' : 'investmentCategories']: updatedCategories,
        updatedAt: new Date().toISOString()
      });

      // Update transactions
      const transactionType = type === 'income' ? 'Income' : type === 'expense' ? 'Expense' : 'Investment';
      const q = query(
        collection(db, 'workspaces', workspace.id, 'transactions'),
        where('type', '==', transactionType),
        where('category', '==', oldCategory)
      );
      const snapshot = await getDocs(q);
      snapshot.docs.forEach((transactionDoc) => {
        batch.update(transactionDoc.ref, {
          category: editCategoryValue,
          updatedAt: new Date().toISOString()
        });
      });

      await batch.commit();
      
      setEditingIncomeCategory(null);
      setEditingExpenseCategory(null);
      setEditingInvestmentCategory(null);
      setEditCategoryValue('');
      toast.success('Category renamed and transactions updated');
    } catch (error) {
      handleFirestoreError(error, 'update', `workspaces/${workspace.id}`);
      toast.error('Failed to rename category');
    }
  };

  const updatePreferences = async (newPrefs: Partial<UserProfile['preferences']>) => {
    if (!user) return;
    try {
      const currentPrefs = user.preferences || { timeFormat: '12h', dateFormat: 'MMM d, yyyy' };
      
      // Deep merge for transactionFields if it's being updated
      let mergedPrefs = { ...currentPrefs, ...newPrefs };
      if (newPrefs.transactionFields && currentPrefs.transactionFields) {
        mergedPrefs.transactionFields = {
          ...currentPrefs.transactionFields,
          ...newPrefs.transactionFields
        };
      }

      await updateDoc(doc(db, 'users', user.uid), {
        preferences: mergedPrefs
      });
      toast.success('Preferences updated');
    } catch (error) {
      toast.error('Failed to update preferences');
    }
  };

  const addContact = async () => {
    if (!workspace || !newContactName) return;
    try {
      await addDoc(collection(db, `workspaces/${workspace.id}/contacts`), {
        workspaceId: workspace.id,
        name: newContactName,
        email: newContactEmail,
        phone: newContactPhone,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      setNewContactName('');
      setNewContactEmail('');
      setNewContactPhone('');
      toast.success('Contact saved');
    } catch (error) {
      toast.error('Failed to save contact');
    }
  };

  const deleteContact = async (id: string) => {
    if (!workspace) return;
    try {
      await deleteDoc(doc(db, `workspaces/${workspace.id}/contacts`, id));
      toast.success('Contact deleted');
    } catch (error) {
      toast.error('Failed to delete contact');
    }
  };

  const updateContact = async () => {
    if (!workspace || !editingContactId) return;
    try {
      await updateDoc(doc(db, `workspaces/${workspace.id}/contacts`, editingContactId), {
        name: editContactName,
        email: editContactEmail,
        phone: editContactPhone,
        updatedAt: new Date().toISOString()
      });
      setEditingContactId(null);
      toast.success('Contact updated');
    } catch (error) {
      toast.error('Failed to update contact');
    }
  };

  if (!workspace) return null;

  const totalPercentage = rules.reduce((acc, r) => acc + r.percentage, 0);

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h2 className="text-3xl font-bold tracking-tight text-foreground">Settings</h2>
        
        <div className="flex bg-muted p-1 rounded-xl overflow-x-auto scrollbar-none">
          {[
            { id: 'workspace', label: 'Workspace', icon: SettingsIcon },
            { id: 'categories', label: 'Categories', icon: Tag },
            { id: 'accounts', label: 'Accounts', icon: Wallet },
            { id: 'contacts', label: 'Contacts', icon: UserIcon },
            { id: 'preferences', label: 'Preferences', icon: SettingsIcon },
          ].map((tab) => (
            <Button
              key={tab.id}
              variant={activeTab === tab.id ? 'default' : 'ghost'}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "flex items-center gap-2 rounded-lg font-bold h-9 px-4 whitespace-nowrap",
                activeTab === tab.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
              )}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-8">
        {activeTab === 'workspace' && (
          <Card className="border-border bg-card/50 shadow-xl backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <SettingsIcon className="h-5 w-5 text-muted-foreground" />
                Workspace Details
              </CardTitle>
              <CardDescription className="text-muted-foreground">Manage your workspace identity and core settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="h-20 w-20 rounded-2xl bg-muted border border-border flex items-center justify-center overflow-hidden relative group">
                    {workspaceLogoUrl ? (
                      <img src={workspaceLogoUrl} alt="Logo" className="h-full w-full object-contain" />
                    ) : (
                      <ImageIcon className="h-8 w-8 text-muted-foreground" />
                    )}
                    <label className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                      <Plus className="h-6 w-6 text-white" />
                      <input 
                        type="file" 
                        className="hidden" 
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setWorkspaceLogoUrl(reader.result as string);
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </label>
                  </div>
                  <div className="flex-1 space-y-2">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Workspace Logo</Label>
                    <p className="text-[10px] text-muted-foreground">Click the icon to upload or paste a logo URL below.</p>
                    <div className="flex gap-2">
                      <Input 
                        placeholder="Or paste a logo URL..." 
                        value={workspaceLogoUrl}
                        onChange={(e) => setWorkspaceLogoUrl(e.target.value)}
                        className="h-10 rounded-xl border-border bg-background"
                      />
                      {workspaceLogoUrl && (
                        <Button 
                          variant="outline" 
                          size="icon" 
                          onClick={syncColorWithLogo}
                          className="rounded-xl shrink-0 h-10 w-10"
                          title="Extract color from logo"
                        >
                          <Zap className="h-4 w-4 text-amber-500" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Brand Color</Label>
                  <div className="flex gap-3 items-center">
                    <div 
                      className="h-10 w-10 rounded-xl border border-border shadow-sm shrink-0" 
                      style={{ backgroundColor: brandColor }}
                    />
                    <Input 
                      type="color" 
                      value={brandColor} 
                      onChange={(e) => setBrandColor(e.target.value)} 
                      className="h-10 w-20 p-1 rounded-xl cursor-pointer"
                    />
                    <Input 
                      type="text" 
                      value={brandColor} 
                      onChange={(e) => setBrandColor(e.target.value)} 
                      placeholder="#000000"
                      className="rounded-xl font-mono h-10"
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground">This color will be used for your invoices and receipts.</p>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Workspace Name</Label>
                  <Input 
                    placeholder="e.g. My Awesome Business" 
                    value={workspaceName}
                    onChange={(e) => setWorkspaceName(e.target.value)}
                    className="h-10 rounded-xl border-border bg-background"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Description</Label>
                  <Input 
                    placeholder="What does this workspace do?" 
                    value={workspaceDescription}
                    onChange={(e) => setWorkspaceDescription(e.target.value)}
                    className="h-10 rounded-xl border-border bg-background"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Monthly Sales Target ({workspace.currency})</Label>
                    <Input 
                      type="number"
                      placeholder="e.g. 10000" 
                      value={salesTarget}
                      onChange={(e) => setSalesTarget(Number(e.target.value))}
                      className="h-10 rounded-xl border-border bg-background"
                    />
                    <p className="text-[10px] text-muted-foreground">Your goal for total sales each month.</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Monthly Retainer Target</Label>
                    <Input 
                      type="number"
                      placeholder="e.g. 20" 
                      value={retainerTarget}
                      onChange={(e) => setRetainerTarget(Number(e.target.value))}
                      className="h-10 rounded-xl border-border bg-background"
                    />
                    <p className="text-[10px] text-muted-foreground">Target number of active monthly retainers.</p>
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-border">
                  <button 
                    onClick={() => setIsBusinessInfoExpanded(!isBusinessInfoExpanded)}
                    className="flex items-center justify-between w-full group"
                  >
                    <div className="flex flex-col items-start">
                      <h3 className="text-sm font-black uppercase tracking-widest text-foreground">Business Information</h3>
                      <p className="text-[10px] text-muted-foreground">This information will appear on your invoices and receipts.</p>
                    </div>
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center group-hover:bg-accent transition-colors">
                      {isBusinessInfoExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                  </button>
                  
                  <AnimatePresence>
                    {isBusinessInfoExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="space-y-4 pt-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Business Email</Label>
                              <Input 
                                placeholder="e.g. billing@acme.com" 
                                value={businessEmail}
                                onChange={(e) => setBusinessEmail(e.target.value)}
                                className="h-10 rounded-xl border-border bg-background"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Business Phone</Label>
                              <Input 
                                placeholder="e.g. +233 50 000 0000" 
                                value={businessPhone}
                                onChange={(e) => setBusinessPhone(e.target.value)}
                                className="h-10 rounded-xl border-border bg-background"
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Business Address</Label>
                            <Input 
                              placeholder="e.g. 123 Business St, Accra, Ghana" 
                              value={businessAddress}
                              onChange={(e) => setBusinessAddress(e.target.value)}
                              className="h-10 rounded-xl border-border bg-background"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Tax ID / Registration Number</Label>
                            <Input 
                              placeholder="e.g. TIN-123456789" 
                              value={taxId}
                              onChange={(e) => setTaxId(e.target.value)}
                              className="h-10 rounded-xl border-border bg-background"
                            />
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="space-y-4 pt-4 border-t border-border">
                    <button 
                      onClick={() => setIsPaymentInfoExpanded(!isPaymentInfoExpanded)}
                      className="flex items-center justify-between w-full group"
                    >
                      <div className="flex flex-col items-start">
                        <h3 className="text-sm font-black uppercase tracking-widest text-foreground">Payment Information</h3>
                        <p className="text-[10px] text-muted-foreground">These details will be included on your generated invoices.</p>
                      </div>
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center group-hover:bg-accent transition-colors">
                        {isPaymentInfoExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </div>
                    </button>

                    <AnimatePresence>
                      {isPaymentInfoExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="space-y-4 pt-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Bank Name</Label>
                                <Input 
                                  placeholder="e.g. Standard Chartered" 
                                  value={bankName}
                                  onChange={(e) => setBankName(e.target.value)}
                                  className="h-10 rounded-xl border-border bg-background"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Bank Branch</Label>
                                <Input 
                                  placeholder="e.g. Accra Main" 
                                  value={bankBranch}
                                  onChange={(e) => setBankBranch(e.target.value)}
                                  className="h-10 rounded-xl border-border bg-background"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Account Number</Label>
                                <Input 
                                  placeholder="e.g. 0100123456789" 
                                  value={accountNumber}
                                  onChange={(e) => setAccountNumber(e.target.value)}
                                  className="h-10 rounded-xl border-border bg-background"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Mobile Money Provider</Label>
                                <Input 
                                  placeholder="e.g. MTN MoMo" 
                                  value={mobileMoneyProvider}
                                  onChange={(e) => setMobileMoneyProvider(e.target.value)}
                                  className="h-10 rounded-xl border-border bg-background"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Mobile Money Number</Label>
                                <Input 
                                  placeholder="e.g. 0500000000" 
                                  value={mobileMoneyNumber}
                                  onChange={(e) => setMobileMoneyNumber(e.target.value)}
                                  className="h-10 rounded-xl border-border bg-background"
                                />
                              </div>
                            </div>

                            <div className="space-y-2">
                              <Label className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Online Payment URL</Label>
                              <Input 
                                placeholder="e.g. https://paystack.com/pay/my-business" 
                                value={onlinePaymentUrl}
                                onChange={(e) => setOnlinePaymentUrl(e.target.value)}
                                className="h-10 rounded-xl border-border bg-background"
                              />
                            </div>

                            <div className="space-y-4 pt-6 border-t border-border">
                              <div className="flex items-center justify-between">
                                <Label className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Multiple Payment Methods</Label>
                                <Badge variant="outline" className="text-[10px] uppercase font-black">New</Badge>
                              </div>
                              
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                                <div className="space-y-1">
                                  <Label className="text-[10px] font-bold uppercase">Type</Label>
                                  <select 
                                    value={newPaymentType}
                                    onChange={(e) => setNewPaymentType(e.target.value as any)}
                                    className="w-full h-9 rounded-lg border border-border bg-background text-xs px-2"
                                  >
                                    <option value="Bank">Bank Transfer</option>
                                    <option value="Mobile Money">Mobile Money</option>
                                    <option value="Online">Online Link</option>
                                  </select>
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-[10px] font-bold uppercase">Provider / Bank</Label>
                                  <Input 
                                    placeholder="e.g. Cal Bank" 
                                    value={newPaymentProvider}
                                    onChange={(e) => setNewPaymentProvider(e.target.value)}
                                    className="h-9 text-xs rounded-lg"
                                  />
                                </div>
                                {newPaymentType === 'Bank' && (
                                  <div className="space-y-1">
                                    <Label className="text-[10px] font-bold uppercase">Branch</Label>
                                    <Input 
                                      placeholder="e.g. Airport" 
                                      value={newPaymentBranch}
                                      onChange={(e) => setNewPaymentBranch(e.target.value)}
                                      className="h-9 text-xs rounded-lg"
                                    />
                                  </div>
                                )}
                                <div className="space-y-1">
                                  <Label className="text-[10px] font-bold uppercase">Account Name</Label>
                                  <Input 
                                    placeholder="e.g. Business Name" 
                                    value={newPaymentAccountName}
                                    onChange={(e) => setNewPaymentAccountName(e.target.value)}
                                    className="h-9 text-xs rounded-lg"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-[10px] font-bold uppercase">Number / ID</Label>
                                  <div className="flex gap-2">
                                    <Input 
                                      placeholder="e.g. 14000..." 
                                      value={newPaymentAccountNumber}
                                      onChange={(e) => setNewPaymentAccountNumber(e.target.value)}
                                      className="h-9 text-xs rounded-lg"
                                    />
                                    <Button 
                                      size="icon" 
                                      className="h-9 w-9 shrink-0 rounded-lg"
                                      onClick={() => {
                                        if (!newPaymentProvider || !newPaymentAccountNumber) return;
                                        setPaymentMethods([...paymentMethods, {
                                          id: Math.random().toString(36).substr(2, 9),
                                          type: newPaymentType,
                                          provider: newPaymentProvider,
                                          branch: newPaymentType === 'Bank' ? newPaymentBranch : undefined,
                                          accountName: newPaymentAccountName,
                                          accountNumber: newPaymentAccountNumber
                                        }]);
                                        setNewPaymentProvider('');
                                        setNewPaymentBranch('');
                                        setNewPaymentAccountName('');
                                        setNewPaymentAccountNumber('');
                                      }}
                                    >
                                      <Plus className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              </div>

                               <div className="grid gap-2">
                                {paymentMethods.map((method) => (
                                  <div key={method.id} className="flex flex-col gap-3 p-3 rounded-xl bg-muted/50 border border-border group">
                                    {editingPaymentId === method.id ? (
                                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                                        <div className="space-y-1">
                                          <Label className="text-[10px] font-bold uppercase">Type</Label>
                                          <select 
                                            value={editPaymentType}
                                            onChange={(e) => setEditPaymentType(e.target.value as any)}
                                            className="w-full h-9 rounded-lg border border-border bg-background text-xs px-2"
                                          >
                                            <option value="Bank">Bank Transfer</option>
                                            <option value="Mobile Money">Mobile Money</option>
                                            <option value="Online">Online Link</option>
                                          </select>
                                        </div>
                                        <div className="space-y-1">
                                          <Label className="text-[10px] font-bold uppercase">Provider / Bank</Label>
                                          <Input 
                                            placeholder="e.g. Cal Bank" 
                                            value={editPaymentProvider}
                                            onChange={(e) => setEditPaymentProvider(e.target.value)}
                                            className="h-9 text-xs rounded-lg"
                                          />
                                        </div>
                                        {editPaymentType === 'Bank' && (
                                          <div className="space-y-1">
                                            <Label className="text-[10px] font-bold uppercase">Branch</Label>
                                            <Input 
                                              placeholder="e.g. Airport" 
                                              value={editPaymentBranch}
                                              onChange={(e) => setEditPaymentBranch(e.target.value)}
                                              className="h-9 text-xs rounded-lg"
                                            />
                                          </div>
                                        )}
                                        <div className="space-y-1">
                                          <Label className="text-[10px] font-bold uppercase">Account Name</Label>
                                          <Input 
                                            placeholder="e.g. Business Name" 
                                            value={editPaymentAccountName}
                                            onChange={(e) => setEditPaymentAccountName(e.target.value)}
                                            className="h-9 text-xs rounded-lg"
                                          />
                                        </div>
                                        <div className="space-y-1">
                                          <Label className="text-[10px] font-bold uppercase">Number / ID</Label>
                                          <div className="flex gap-2">
                                            <Input 
                                              placeholder="e.g. 14000..." 
                                              value={editPaymentAccountNumber}
                                              onChange={(e) => setEditPaymentAccountNumber(e.target.value)}
                                              className="h-9 text-xs rounded-lg"
                                            />
                                            <Button 
                                              size="icon" 
                                              className="h-9 w-9 shrink-0 rounded-lg bg-emerald-500 hover:bg-emerald-600"
                                              onClick={saveEditedPayment}
                                            >
                                              <Save className="h-4 w-4" />
                                            </Button>
                                            <Button 
                                              size="icon" 
                                              variant="ghost"
                                              className="h-9 w-9 shrink-0 rounded-lg"
                                              onClick={() => setEditingPaymentId(null)}
                                            >
                                              <Plus className="h-4 w-4 rotate-45" />
                                            </Button>
                                          </div>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                          <div className="h-8 w-8 rounded-lg bg-background flex items-center justify-center">
                                            <CreditCard className="h-4 w-4 text-muted-foreground" />
                                          </div>
                                          <div>
                                            <p className="text-xs font-black uppercase tracking-tight">
                                              {method.provider} {method.branch && <span className="text-muted-foreground font-medium">({method.branch})</span>}
                                            </p>
                                            <p className="text-[10px] text-muted-foreground font-medium">
                                              {method.type} • {method.accountName} • {method.accountNumber}
                                            </p>
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                          <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            onClick={() => startEditingPayment(method)}
                                            className="h-8 w-8 text-muted-foreground hover:text-primary"
                                          >
                                            <SettingsIcon className="h-4 w-4" />
                                          </Button>
                                          <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            onClick={() => setPaymentMethods(paymentMethods.filter(m => m.id !== method.id))}
                                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                          >
                                            <Trash2 className="h-4 w-4" />
                                          </Button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Base Currency</Label>
                  <select 
                    className="w-full rounded-xl border border-border bg-background px-3 h-10 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    value={workspace.currency}
                    onChange={(e) => updateCurrency(e.target.value as Currency)}
                  >
                    <option value="GHS">Ghana Cedis (GHS)</option>
                    <option value="USD">US Dollars (USD)</option>
                    <option value="NGN">Nigerian Naira (NGN)</option>
                    <option value="GBP">British Pound (GBP)</option>
                    <option value="EUR">Euro (EUR)</option>
                  </select>
                </div>

                <Button onClick={updateWorkspaceDetails} className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl h-11">
                  <Save className="h-4 w-4 mr-2" />
                  Save Workspace Details
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === 'categories' && (
          <Card className="border-border bg-card/50 shadow-xl backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <Tag className="h-5 w-5 text-muted-foreground" />
                Transaction Categories
              </CardTitle>
              <CardDescription className="text-muted-foreground">Customize categories for income and expenses</CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              {/* Income Categories */}
              <div className="space-y-4">
                <Label className="text-xs font-bold text-emerald-500 uppercase tracking-widest">Income Categories</Label>
                <div className="flex gap-2">
                  <Input 
                    placeholder="New Income Category" 
                    value={newIncomeCategory}
                    onChange={(e) => setNewIncomeCategory(e.target.value)}
                    className="h-10 rounded-xl border-border bg-background"
                  />
                  <Button onClick={addIncomeCategory} size="icon" className="bg-emerald-500 hover:bg-emerald-600">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(incomeCategories).map((cat) => (
                    <Badge key={cat} variant="secondary" className="pl-3 pr-1 py-1 rounded-full bg-emerald-500/10 text-emerald-600 border-emerald-500/20 flex items-center gap-1">
                      {editingIncomeCategory === cat ? (
                        <Input 
                          value={editCategoryValue}
                          onChange={(e) => setEditCategoryValue(e.target.value)}
                          onBlur={() => renameCategory('income', cat)}
                          onKeyDown={(e) => e.key === 'Enter' && renameCategory('income', cat)}
                          autoFocus
                          className="h-6 w-24 bg-transparent border-none p-0 text-xs font-bold focus-visible:ring-0"
                        />
                      ) : (
                        <span 
                          className="cursor-pointer hover:underline"
                          onClick={() => {
                            setEditingIncomeCategory(cat);
                            setEditCategoryValue(cat);
                          }}
                        >
                          {cat}
                        </span>
                      )}
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-4 w-4 p-0 hover:bg-transparent hover:text-rose-500"
                        onClick={() => deleteIncomeCategory(cat)}
                      >
                        <Plus className="h-3 w-3 rotate-45" />
                      </Button>
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Expense Categories */}
              <div className="space-y-4">
                <Label className="text-xs font-bold text-rose-500 uppercase tracking-widest">Expense Categories</Label>
                <div className="flex gap-2">
                  <Input 
                    placeholder="New Expense Category" 
                    value={newExpenseCategory}
                    onChange={(e) => setNewExpenseCategory(e.target.value)}
                    className="h-10 rounded-xl border-border bg-background"
                  />
                  <Button onClick={addExpenseCategory} size="icon" className="bg-rose-500 hover:bg-rose-600">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(expenseCategories).map((cat) => (
                    <Badge key={cat} variant="secondary" className="pl-3 pr-1 py-1 rounded-full bg-rose-500/10 text-rose-600 border-rose-500/20 flex items-center gap-1">
                      {editingExpenseCategory === cat ? (
                        <Input 
                          value={editCategoryValue}
                          onChange={(e) => setEditCategoryValue(e.target.value)}
                          onBlur={() => renameCategory('expense', cat)}
                          onKeyDown={(e) => e.key === 'Enter' && renameCategory('expense', cat)}
                          autoFocus
                          className="h-6 w-24 bg-transparent border-none p-0 text-xs font-bold focus-visible:ring-0"
                        />
                      ) : (
                        <span 
                          className="cursor-pointer hover:underline"
                          onClick={() => {
                            setEditingExpenseCategory(cat);
                            setEditCategoryValue(cat);
                          }}
                        >
                          {cat}
                        </span>
                      )}
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-4 w-4 p-0 hover:bg-transparent hover:text-rose-500"
                        onClick={() => deleteExpenseCategory(cat)}
                      >
                        <Plus className="h-3 w-3 rotate-45" />
                      </Button>
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Investment Categories */}
              <div className="space-y-4">
                <Label className="text-xs font-bold text-purple-500 uppercase tracking-widest">Investment Categories</Label>
                <div className="flex gap-2">
                  <Input 
                    placeholder="New Investment Category" 
                    value={newInvestmentCategory}
                    onChange={(e) => setNewInvestmentCategory(e.target.value)}
                    className="h-10 rounded-xl border-border bg-background"
                  />
                  <Button onClick={addInvestmentCategory} size="icon" className="bg-purple-500 hover:bg-purple-600">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(investmentCategories).map((cat) => (
                    <Badge key={cat} variant="secondary" className="pl-3 pr-1 py-1 rounded-full bg-purple-500/10 text-purple-600 border-purple-500/20 flex items-center gap-1">
                      {editingInvestmentCategory === cat ? (
                        <Input 
                          value={editCategoryValue}
                          onChange={(e) => setEditCategoryValue(e.target.value)}
                          onBlur={() => renameCategory('investment', cat)}
                          onKeyDown={(e) => e.key === 'Enter' && renameCategory('investment', cat)}
                          autoFocus
                          className="h-6 w-24 bg-transparent border-none p-0 text-xs font-bold focus-visible:ring-0"
                        />
                      ) : (
                        <span 
                          className="cursor-pointer hover:underline"
                          onClick={() => {
                            setEditingInvestmentCategory(cat);
                            setEditCategoryValue(cat);
                          }}
                        >
                          {cat}
                        </span>
                      )}
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-4 w-4 p-0 hover:bg-transparent hover:text-purple-500"
                        onClick={() => deleteInvestmentCategory(cat)}
                      >
                        <Plus className="h-3 w-3 rotate-45" />
                      </Button>
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === 'accounts' && (
          <div className="grid gap-8 md:grid-cols-2">
            <Card className="border-border bg-card/50 shadow-xl backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-foreground">
                  <Wallet className="h-5 w-5 text-muted-foreground" />
                  Internal Accounts
                </CardTitle>
                <CardDescription className="text-muted-foreground">Manage your internal account balances (e.g., Tax, Tithe, Savings)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input 
                    placeholder="Account Name (e.g. Tax Reserve)" 
                    value={newAccountName}
                    onChange={(e) => setNewAccountName(e.target.value)}
                    className="border-border bg-background text-foreground"
                  />
                  <Button onClick={addAccount} size="icon">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="text-muted-foreground">Name</TableHead>
                      <TableHead className="text-muted-foreground text-right">Balance</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accounts.map((a) => (
                      <TableRow key={a.id} className="border-border hover:bg-accent/50">
                        <TableCell className="font-medium text-foreground">{a.name}</TableCell>
                        <TableCell className="text-right text-foreground">{workspace.currency} {a.balance.toLocaleString()}</TableCell>
                        <TableCell>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => deleteAccount(a.id)}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card className="border-border bg-card/50 shadow-xl backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-foreground">
                  <Percent className="h-5 w-5 text-muted-foreground" />
                  Revenue Splitter
                </CardTitle>
                <CardDescription className="text-muted-foreground">Rules to automatically allocate revenue when an invoice is paid</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4 rounded-lg border border-border bg-background p-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Rule Name</Label>
                      <Input 
                        placeholder="e.g. Tax Allocation" 
                        value={newRuleName}
                        onChange={(e) => setNewRuleName(e.target.value)}
                        className="border-border bg-muted text-foreground"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Percentage (%)</Label>
                      <Input 
                        type="number" 
                        placeholder="10" 
                        value={newRulePercentage}
                        onChange={(e) => setNewRulePercentage(Number(e.target.value))}
                        className="border-border bg-muted text-foreground"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Target Account</Label>
                    <select 
                      className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                      value={newRuleAccountId}
                      onChange={(e) => setNewRuleAccountId(e.target.value)}
                    >
                      <option value="">Select Account</option>
                      {accounts.map(a => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </select>
                  </div>
                  <Button onClick={addRule} className="w-full">
                    Add Allocation Rule
                  </Button>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Total Allocated</span>
                    <span className={cn("font-bold", totalPercentage > 100 ? "text-rose-500" : "text-emerald-500")}>
                      {totalPercentage}%
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div 
                      className={cn("h-full transition-all", totalPercentage > 100 ? "bg-rose-500" : "bg-emerald-500")}
                      style={{ width: `${Math.min(totalPercentage, 100)}%` }}
                    />
                  </div>
                  {totalPercentage > 100 && (
                    <p className="text-[10px] text-rose-500 flex items-center gap-1">
                      <Info className="h-3 w-3" />
                      Total percentage exceeds 100%!
                    </p>
                  )}
                </div>

                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="text-muted-foreground">Rule</TableHead>
                      <TableHead className="text-muted-foreground text-right">%</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rules.map((r) => (
                      <TableRow key={r.id} className="border-border hover:bg-accent/50">
                        <TableCell className="font-medium text-foreground">
                          {r.name}
                          <p className="text-[10px] text-muted-foreground">
                            → {accounts.find(a => a.id === r.targetAccountId)?.name}
                          </p>
                        </TableCell>
                        <TableCell className="text-right text-foreground">{r.percentage}%</TableCell>
                        <TableCell>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => deleteRule(r.id)}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'contacts' && (
          <Card className="border-border bg-card/50 shadow-xl backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <UserIcon className="h-5 w-5 text-muted-foreground" />
                Saved Contacts
              </CardTitle>
              <CardDescription className="text-muted-foreground">Manage your frequent payers and payees for faster transaction entry</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-muted/30 p-4 rounded-2xl border border-border">
                <div className="space-y-2">
                  <Label className="text-xs uppercase font-bold text-muted-foreground">Name</Label>
                  <Input 
                    placeholder="e.g. John Doe, Total Energies" 
                    value={newContactName}
                    onChange={(e) => setNewContactName(e.target.value)}
                    className="rounded-xl h-11 border-border bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase font-bold text-muted-foreground">Email (Optional)</Label>
                  <Input 
                    placeholder="john@example.com" 
                    value={newContactEmail}
                    onChange={(e) => setNewContactEmail(e.target.value)}
                    className="rounded-xl h-11 border-border bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase font-bold text-muted-foreground">Phone (Optional)</Label>
                  <Input 
                    placeholder="+233..." 
                    value={newContactPhone}
                    onChange={(e) => setNewContactPhone(e.target.value)}
                    className="rounded-xl h-11 border-border bg-background"
                  />
                </div>
                <div className="flex items-end">
                  <Button onClick={addContact} className="h-11 w-full rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold">Add Contact</Button>
                </div>
              </div>

              <div className="rounded-2xl border border-border overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="font-bold">Contact Name</TableHead>
                      <TableHead className="font-bold">Email</TableHead>
                      <TableHead className="font-bold">Phone</TableHead>
                      <TableHead className="text-right font-bold">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contacts.map(contact => (
                      <TableRow key={contact.id} className="hover:bg-muted/30 group border-border">
                        <TableCell className="font-black group-hover:text-blue-600 transition-colors">
                          {editingContactId === contact.id ? (
                            <Input 
                              value={editContactName}
                              onChange={(e) => setEditContactName(e.target.value)}
                              className="h-8 rounded-lg text-sm bg-background"
                            />
                          ) : contact.name}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {editingContactId === contact.id ? (
                            <Input 
                              value={editContactEmail}
                              onChange={(e) => setEditContactEmail(e.target.value)}
                              className="h-8 rounded-lg text-sm bg-background"
                            />
                          ) : contact.email || <span className="italic text-slate-300">N/A</span>}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {editingContactId === contact.id ? (
                            <Input 
                              value={editContactPhone}
                              onChange={(e) => setEditContactPhone(e.target.value)}
                              className="h-8 rounded-lg text-sm bg-background"
                            />
                          ) : contact.phone || <span className="italic text-slate-300">N/A</span>}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {editingContactId === contact.id ? (
                              <>
                                <Button size="sm" onClick={updateContact} className="h-8 px-3 rounded-lg bg-green-600 hover:bg-green-700 text-white">Save</Button>
                                <Button size="sm" variant="ghost" onClick={() => setEditingContactId(null)} className="h-8 px-3 rounded-lg">Cancel</Button>
                              </>
                            ) : (
                              <>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  onClick={() => {
                                    setEditingContactId(contact.id);
                                    setEditContactName(contact.name);
                                    setEditContactEmail(contact.email || '');
                                    setEditContactPhone(contact.phone || '');
                                  }}
                                  className="text-muted-foreground hover:text-blue-600 h-8 w-8 p-0 rounded-lg"
                                >
                                  <Save className="h-4 w-4" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  onClick={() => deleteContact(contact.id)}
                                  className="text-muted-foreground hover:text-destructive h-8 w-8 p-0 rounded-lg"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {contacts.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-12 text-muted-foreground italic border-border">
                          No saved contacts yet. They will appear here for management.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === 'preferences' && (
          <Card className="border-border bg-card/50 shadow-xl backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <UserIcon className="h-5 w-5 text-muted-foreground" />
                User Preferences
              </CardTitle>
              <CardDescription className="text-muted-foreground">Customize your personal experience</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Time Format</Label>
                  <div className="flex gap-2 p-1 bg-muted rounded-xl">
                    {['12h', '24h'].map((f) => (
                      <Button
                        key={f}
                        variant={user?.preferences?.timeFormat === f ? 'default' : 'ghost'}
                        onClick={() => updatePreferences({ timeFormat: f as '12h' | '24h' })}
                        className={cn(
                          "flex-1 rounded-lg font-bold h-10",
                          user?.preferences?.timeFormat === f ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                        )}
                      >
                        {f}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Date Format</Label>
                  <select 
                    className="w-full rounded-xl border border-border bg-background px-3 h-10 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    value={user?.preferences?.dateFormat || 'MMM d, yyyy'}
                    onChange={(e) => updatePreferences({ dateFormat: e.target.value })}
                  >
                    <option value="MMM d, yyyy">MMM d, yyyy (e.g. Mar 27, 2026)</option>
                    <option value="dd/MM/yyyy">dd/MM/yyyy (e.g. 27/03/2026)</option>
                    <option value="MM/dd/yyyy">MM/dd/yyyy (e.g. 03/27/2026)</option>
                    <option value="yyyy-MM-dd">yyyy-MM-dd (e.g. 2026-03-27)</option>
                  </select>
                </div>

                <div className="space-y-4 pt-4 border-t border-border">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Transaction Form Fields</Label>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-sm font-medium">Show Time</Label>
                        <p className="text-[10px] text-muted-foreground">Include a time selector for transactions</p>
                      </div>
                      <Button
                        variant={user?.preferences?.transactionFields?.showTime !== false ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => updatePreferences({ 
                          transactionFields: { 
                            showTime: !(user?.preferences?.transactionFields?.showTime !== false)
                          } 
                        })}
                        className="rounded-lg h-8 px-3"
                      >
                        {user?.preferences?.transactionFields?.showTime !== false ? 'Enabled' : 'Disabled'}
                      </Button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-sm font-medium">Show Payee / Payer</Label>
                        <p className="text-[10px] text-muted-foreground">Record who you paid or who paid you</p>
                      </div>
                      <Button
                        variant={user?.preferences?.transactionFields?.showPayeePayer !== false ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => updatePreferences({ 
                          transactionFields: { 
                            showPayeePayer: !(user?.preferences?.transactionFields?.showPayeePayer !== false)
                          } 
                        })}
                        className="rounded-lg h-8 px-3"
                      >
                        {user?.preferences?.transactionFields?.showPayeePayer !== false ? 'Enabled' : 'Disabled'}
                      </Button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-sm font-medium">Show Description</Label>
                        <p className="text-[10px] text-muted-foreground">Add extra notes to your transactions</p>
                      </div>
                      <Button
                        variant={user?.preferences?.transactionFields?.showDescription !== false ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => updatePreferences({ 
                          transactionFields: { 
                            showDescription: !(user?.preferences?.transactionFields?.showDescription !== false)
                          } 
                        })}
                        className="rounded-lg h-8 px-3"
                      >
                        {user?.preferences?.transactionFields?.showDescription !== false ? 'Enabled' : 'Disabled'}
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-border">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Onboarding</Label>
                  <div className="flex items-center justify-between p-4 bg-brand/5 rounded-2xl border border-brand/10">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-bold text-foreground flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-brand" />
                        Product Tour
                      </Label>
                      <p className="text-[10px] text-muted-foreground">New to IzyFlow? Take a quick walk through the features.</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        window.dispatchEvent(new CustomEvent('restart-product-tour'));
                        toast.success('Starting tour...', { icon: <Sparkles className="h-4 w-4 text-brand" /> });
                      }}
                      className="rounded-xl h-10 px-4 font-bold border-brand/20 text-brand hover:bg-brand hover:text-white transition-all"
                    >
                      Start Tour
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
