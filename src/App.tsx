import { useEffect, useState } from 'react';
import { api, setAuthToken } from './lib/api';
import { Workspace, UserProfile, CMSConfig } from './types';
import { Sidebar } from './components/Sidebar';
import { Sheet, SheetContent, SheetTrigger } from './components/ui/sheet';
import { Dashboard } from './components/Dashboard';
import { Invoices } from './components/Invoices';
import { Transactions } from './components/Transactions';
import { Accounts } from './components/Accounts';
import { Settings } from './components/Settings';
import { Subscription } from './components/Subscription';
import { Calculator } from './components/Calculator';
import { Catalog } from './components/Catalog';
import { Receipts } from './components/Receipts';
import { PublicCatalog } from './components/PublicCatalog';
import { LandingPage } from './components/LandingPage';
import { AuthModal } from './components/AuthModal';
import { AdminPortal } from './components/AdminPortal';
import { SupportChat } from './components/SupportChat';
import { IzyAssistant } from './components/IzyAssistant';
import { IzyBubble } from './components/IzyBubble';
import { ProductTour, TourStep } from './components/ProductTour';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './components/ui/dialog';
import { Toaster } from './components/ui/sonner';
import { cn } from './lib/utils';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { LayoutDashboard, ReceiptText, ArrowLeftRight, Settings as SettingsIcon, Calculator as CalculatorIcon, LogIn, Loader2, Bot, Menu, Wallet } from 'lucide-react';

interface AppProps {
  auth: {
    isLoaded: boolean;
    isSignedIn: boolean;
    userId: string | null;
    email: string | null;
    displayName: string | null;
    photoURL: string | null;
    getToken: () => Promise<string | null>;
    signOut: () => Promise<void>;
  };
}

export default function App({ auth }: AppProps) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [workspacesLoading, setWorkspacesLoading] = useState(true);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [tabHistory, setTabHistory] = useState<string[]>(['dashboard']);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [publicWorkspaceId, setPublicWorkspaceId] = useState<string | null>(null);
  
  const navigateToTab = (tab: string, filters?: any) => {
    if (filters) setInitialFilters(filters);
    
    if (tabHistory[historyIndex] !== tab) {
      const newHistory = tabHistory.slice(0, historyIndex + 1);
      newHistory.push(tab);
      setTabHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
    }
    setActiveTab(tab);
  };

  const goBack = () => {
    if (historyIndex > 0) {
      const prevIndex = historyIndex - 1;
      setHistoryIndex(prevIndex);
      setActiveTab(tabHistory[prevIndex]);
    }
  };

  const goForward = () => {
    if (historyIndex < tabHistory.length - 1) {
      const nextIndex = historyIndex + 1;
      setHistoryIndex(nextIndex);
      setActiveTab(tabHistory[nextIndex]);
    }
  };

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [cmsConfig, setCmsConfig] = useState<CMSConfig | null>(() => {
    const cached = localStorage.getItem('cms_config');
    return cached ? JSON.parse(cached) : null;
  });
  const [isConfigLoading, setIsConfigLoading] = useState(true);
  const [isAdminPortal, setIsAdminPortal] = useState(false);

  // Cache CMS config when it changes
  useEffect(() => {
    if (cmsConfig) {
      localStorage.setItem('cms_config', JSON.stringify(cmsConfig));
    }
  }, [cmsConfig]);

  const [isIzyOpen, setIsIzyOpen] = useState(false);
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCreateWorkspaceOpen, setIsCreateWorkspaceOpen] = useState(false);
  const [initialScenario, setInitialScenario] = useState<string | null>(null);
  const [period, setPeriod] = useState<string>('this-month');
  const [initialFilters, setInitialFilters] = useState<any>(null);
  const [isTourOpen, setIsTourOpen] = useState(false);

  const tourSteps: TourStep[] = [
    {
      targetId: 'tour-workspace',
      title: 'Workspace Switcher',
      content: 'Manage multiple businesses or separate your personal and business finances here.',
      position: 'right'
    },
    {
      targetId: 'tour-nav',
      title: 'Quick Navigation',
      content: 'Switch between your Dashboard, Invoices, Transactions, and Accounts in one click.',
      position: 'right'
    },
    {
      targetId: 'tour-metrics',
      title: 'Real-time Metrics',
      content: 'Keep track of your cash balance, income, and expenses as they happen.',
      position: 'bottom'
    },
    {
      targetId: 'tour-assistant',
      title: 'Meet Izy, Your AI Assistant',
      content: 'Record sales, expenses, and search your data by just typing or speaking naturally.',
      position: 'left'
    }
  ];

  // Trigger tour for new users
  useEffect(() => {
    if (user?.uid && activeWorkspace) {
      const hasSeenTour = localStorage.getItem(`tour_seen_${user.uid}`);
      if (!hasSeenTour && activeTab === 'dashboard') {
        const timer = setTimeout(() => setIsTourOpen(true), 1500);
        return () => clearTimeout(timer);
      }
    }
  }, [user?.uid, activeWorkspace, activeTab]);

  const handleTourComplete = () => {
    setIsTourOpen(false);
    if (user?.uid) {
      localStorage.setItem(`tour_seen_${user.uid}`, 'true');
    }
  };

  // Reset tab to dashboard on login
  useEffect(() => {
    if (user?.uid) {
      setActiveTab('dashboard');
      setTabHistory(['dashboard']);
      setHistoryIndex(0);
    }
  }, [user?.uid]);
  
  // Data states
  const [transactions, setTransactions] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [allocationRules, setAllocationRules] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(false);

  // Fetch CMS Config
  useEffect(() => {
    if (window.location.pathname === '/admin-portal') {
      setIsAdminPortal(true);
    }
    if (window.location.pathname.startsWith('/catalog/')) {
      const id = window.location.pathname.split('/')[2];
      if (id) setPublicWorkspaceId(id);
    }

    const fetchCMS = async () => {
      try {
        const config = await api.getCMSConfig();
        setCmsConfig(config);
        setIsConfigLoading(false);
      } catch (error) {
        console.error('CMS Config fetch failed:', error);
        setIsConfigLoading(false);
      }
    };
    fetchCMS();
  }, []);

  // Set Auth Token and Fetch User + Workspaces
  useEffect(() => {
    if (!auth.isLoaded) return;

    const initUserAndWorkspaces = async () => {
      if (auth.isSignedIn) {
        try {
          setLoading(true);
          setWorkspacesLoading(true);
          
          // Get JWT token from Clerk (or mock auth) and register it in API client
          const token = await auth.getToken();
          setAuthToken(token);

          // Get/Create User profile on backend
          const profile = await api.getMe();
          setUser(profile);
          localStorage.setItem(`user_profile_${profile.uid}`, JSON.stringify(profile));

          // Fetch Workspaces
          const ws = await api.getWorkspaces();
          setWorkspaces(ws);
          setActiveWorkspace(current => current ? (ws.find(w => w.id === current.id) || current) : (ws.length > 0 ? ws[0] : null));
          
          setWorkspacesLoading(false);
          setLoading(false);
        } catch (err) {
          console.error("Authentication init failed:", err);
          setWorkspacesLoading(false);
          setLoading(false);
        }
      } else {
        setUser(null);
        setWorkspaces([]);
        setActiveWorkspace(null);
        setLoading(false);
      }
    };

    initUserAndWorkspaces();
  }, [auth.isLoaded, auth.isSignedIn, auth.userId]);

  // Load Workspace Data
  const fetchAllData = async (wsId: string) => {
    try {
      setIsDataLoading(true);
      const [txs, invs, accs, rules, cts] = await Promise.all([
        api.getTransactions(wsId),
        api.getInvoices(wsId),
        api.getAccounts(wsId),
        api.getAllocationRules(wsId),
        api.getContacts(wsId),
      ]);
      setTransactions(txs);
      setInvoices(invs);
      setAccounts(accs);
      setAllocationRules(rules);
      setContacts(cts);
    } catch (err) {
      console.error("Failed to load workspace data:", err);
      toast.error("Failed to load workspace data");
    } finally {
      setIsDataLoading(false);
    }
  };

  useEffect(() => {
    if (activeWorkspace?.id) {
      fetchAllData(activeWorkspace.id);
    } else {
      setTransactions([]);
      setInvoices([]);
      setAccounts([]);
      setAllocationRules([]);
      setContacts([]);
    }
  }, [activeWorkspace?.id]);

  // Global event listeners to refresh data from server on modifications
  useEffect(() => {
    const handleRefresh = () => {
      if (activeWorkspace?.id) {
        fetchAllData(activeWorkspace.id);
      }
    };
    const handleRefreshWorkspaces = async () => {
      try {
        const ws = await api.getWorkspaces();
        setWorkspaces(ws);
        setActiveWorkspace(current => current ? (ws.find(w => w.id === current.id) || current) : (ws.length > 0 ? ws[0] : null));
      } catch (err) {
        console.error(err);
      }
    };
    window.addEventListener('refresh-data', handleRefresh);
    window.addEventListener('refresh-workspaces', handleRefreshWorkspaces);
    return () => {
      window.removeEventListener('refresh-data', handleRefresh);
      window.removeEventListener('refresh-workspaces', handleRefreshWorkspaces);
    };
  }, [activeWorkspace?.id]);

  // Handle Paystack Callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reference = params.get('payment_reference');

    if (reference && user) {
      const verifyPayment = async () => {
        try {
          const response = await fetch(`/api/paystack/verify/${reference}`);
          const data = await response.json();

          if (data.status && data.data.status === 'success') {
            const plan = data.data.metadata?.plan;
            if (plan) {
              const expiryDate = new Date();
              expiryDate.setMonth(expiryDate.getMonth() + 1);

              const updatedProfile = await api.updateProfile({
                subscription: {
                  plan,
                  status: 'Active',
                  expiryDate: expiryDate.toISOString()
                }
              });

              setUser(updatedProfile);
              toast.success(`Successfully upgraded to ${plan} plan!`);
              window.history.replaceState({}, '', '/');
            }
          } else {
            toast.error('Payment verification failed');
          }
        } catch (error) {
          console.error('Error verifying payment:', error);
          toast.error('An error occurred while verifying your payment');
        }
      };
      verifyPayment();
    }
  }, [user]);

  // Apply branding
  useEffect(() => {
    if (cmsConfig?.fontFamily) {
      document.body.style.fontFamily = cmsConfig.fontFamily;
    }
    if (cmsConfig?.brandColor) {
      document.documentElement.style.setProperty('--brand-color', cmsConfig.brandColor);
      const hex = cmsConfig.brandColor.replace('#', '');
      if (hex.length === 6) {
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        document.documentElement.style.setProperty('--brand-rgb', `${r}, ${g}, ${b}`);
      }
    }
    if (cmsConfig?.siteName) {
      document.title = cmsConfig.siteName;
    }
    if (cmsConfig?.faviconUrl) {
      let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.getElementsByTagName('head')[0].appendChild(link);
      }
      link.href = cmsConfig.faviconUrl;
    }
  }, [cmsConfig]);

  const handleSignOut = async () => {
    try {
      await auth.signOut();
      toast.success('Signed out successfully');
    } catch (error) {
      toast.error('Failed to sign out');
    }
  };

  const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [newWorkspaceType, setNewWorkspaceType] = useState<Workspace['type']>('Business');

  useEffect(() => {
    const handleTabChange = (e: any) => {
      if (e.detail) setActiveTab(e.detail);
    };
    window.addEventListener('change-tab', handleTabChange);
    
    const handleScenarioEvent = (e: any) => {
      const scenarioText = e.detail;
      if (scenarioText) {
        setInitialScenario(scenarioText);
        setIsIzyOpen(true);
      }
    };
    window.addEventListener('open-izy-with-scenario', handleScenarioEvent);

    const handleRestartTour = () => {
      setActiveTab('dashboard');
      setTimeout(() => setIsTourOpen(true), 100);
    };
    window.addEventListener('restart-product-tour', handleRestartTour);

    return () => {
      window.removeEventListener('change-tab', handleTabChange);
      window.removeEventListener('open-izy-with-scenario', handleScenarioEvent);
      window.removeEventListener('restart-product-tour', handleRestartTour);
    };
  }, []);

  const createWorkspace = async () => {
    if (!user || !newWorkspaceName) return;
    setIsCreatingWorkspace(true);

    const plan = user.subscription?.plan || 'Free';
    const limits: Record<string, number> = {
      'Free': 1,
      'Pro': 3,
      'Agency': Infinity
    };

    if (workspaces.length >= (limits[plan] || 1)) {
      toast.error(`Your ${plan} plan is limited to ${limits[plan] || 1} workspace${(limits[plan] || 1) === 1 ? '' : 's'}. Upgrade for more.`);
      setIsCreatingWorkspace(false);
      return;
    }

    try {
      const wsData = {
        id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2),
        name: newWorkspaceName,
        type: newWorkspaceType,
        currency: 'GHS',
        incomeCategories: ['Sales', 'Consulting', 'Investment', 'Interest', 'Rental Income', 'Gift', 'Other'],
        expenseCategories: ['Rent', 'Software', 'Marketing', 'Salary', 'Utilities', 'Travel', 'Supplies', 'Insurance', 'Taxes', 'Maintenance', 'Entertainment', 'Food & Dining', 'Transportation', 'Other'],
        investmentCategories: ['Stocks', 'Crypto', 'Real Estate', 'Bonds', 'Mutual Funds', 'Other'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      const ws = await api.createWorkspace(wsData);
      setWorkspaces(prev => [...prev, ws]);
      setActiveWorkspace(ws);
      setNewWorkspaceName('');
      setIsCreateWorkspaceOpen(false);
      toast.success('Workspace created successfully!');
    } catch (error) {
      console.error('Workspace creation error:', error);
      toast.error('Failed to create workspace');
    } finally {
      setIsCreatingWorkspace(false);
    }
  };

  if (loading || isConfigLoading || (auth.isSignedIn && workspacesLoading)) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-6"
        >
          <div className="flex flex-col items-center gap-4">
            <div className="text-5xl font-black text-brand tracking-tighter">
              IzyFlow
            </div>
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 text-brand/40 animate-spin" />
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/50">
                {!auth.isSignedIn ? 'Authenticating...' : 'Loading Experience'}
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  if (publicWorkspaceId) {
    return (
      <>
        <PublicCatalog workspaceId={publicWorkspaceId} />
        <Toaster position="top-right" />
      </>
    );
  }

  if (isAdminPortal) {
    if (!user && !loading) {
      return (
        <>
          <LandingPage onGetStarted={() => { setAuthModalMode('sign-up'); setIsAuthModalOpen(true); }} onLogin={() => { setAuthModalMode('sign-in'); setIsAuthModalOpen(true); }} config={cmsConfig} />
          <AuthModal key={authModalMode}
            mode={authModalMode}
            isOpen={isAuthModalOpen} 
            onClose={() => setIsAuthModalOpen(false)} 
          />
          <Toaster position="top-right" />
        </>
      );
    }
    
    if (user && user.role !== 'Admin') {
      setIsAdminPortal(false);
      window.history.pushState({}, '', '/');
    } else {
      return (
        <>
          <AdminPortal user={user} initialConfig={cmsConfig} isConfigLoading={isConfigLoading} />
          <Toaster position="top-right" />
        </>
      );
    }
  }

  if (!user) {
    return (
      <>
        <LandingPage onGetStarted={() => { setAuthModalMode('sign-up'); setIsAuthModalOpen(true); }} onLogin={() => { setAuthModalMode('sign-in'); setIsAuthModalOpen(true); }} config={cmsConfig} />
        <AuthModal key={authModalMode}
          mode={authModalMode}
          isOpen={isAuthModalOpen} 
          onClose={() => setIsAuthModalOpen(false)} 
        />
        <Toaster position="top-right" />
      </>
    );
  }

  if (workspaces.length === 0 && !loading && !workspacesLoading) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-background p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md space-y-8 text-center"
        >
          <div className="space-y-2">
            <h2 className="text-3xl font-bold tracking-tight text-foreground">Welcome to IzyFlow</h2>
            <p className="text-muted-foreground">Create your first workspace to get started</p>
          </div>
          <div className="rounded-2xl border border-border bg-card/50 p-8 shadow-2xl backdrop-blur-xl space-y-4 text-left">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Workspace Name</label>
              <Input 
                placeholder="e.g. My Startup" 
                value={newWorkspaceName}
                onChange={(e) => setNewWorkspaceName(e.target.value)}
                className="border-border bg-background"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Workspace Type</label>
              <div className="flex gap-2">
                {['Business', 'Personal', 'NGO'].map((t) => (
                  <Button
                    key={t}
                    variant={newWorkspaceType === t ? 'default' : 'outline'}
                    onClick={() => setNewWorkspaceType(t as any)}
                    className={cn(
                      "flex-1 border-border",
                      newWorkspaceType === t ? "bg-brand text-brand-foreground hover:bg-brand/90" : "bg-background text-muted-foreground"
                    )}
                  >
                    {t}
                  </Button>
                ))}
              </div>
            </div>
            <Button 
              onClick={createWorkspace}
              className="w-full bg-brand text-brand-foreground hover:bg-brand/90"
              size="lg"
            >
              Create Workspace
            </Button>
            <Button 
              variant="ghost" 
              onClick={handleSignOut}
              className="w-full text-muted-foreground hover:text-foreground"
            >
              Sign Out
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-background text-foreground overflow-hidden">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex w-64 shrink-0">
        <Sidebar 
          workspaces={workspaces}
          activeWorkspace={activeWorkspace}
          setActiveWorkspace={setActiveWorkspace}
          activeTab={activeTab}
          setActiveTab={navigateToTab}
          user={user}
          onSignOut={handleSignOut}
          onIzyClick={() => setIsIzyOpen(true)}
          onSupportClick={() => setIsSupportOpen(true)}
          onCreateWorkspace={() => setIsCreateWorkspaceOpen(true)}
          config={cmsConfig}
        />
      </div>

      {/* Mobile Sidebar (Sheet) */}
      <div className="md:hidden">
        <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
          <SheetTrigger 
            render={
              <Button 
                variant="ghost" 
                size="icon" 
                className="fixed top-4 left-4 z-50 bg-card border border-border shadow-sm rounded-xl"
              />
            }
          >
            <Menu className="h-5 w-5" />
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-[280px] border-r border-border bg-card">
            <Sidebar 
              workspaces={workspaces}
              activeWorkspace={activeWorkspace}
              setActiveWorkspace={setActiveWorkspace}
              activeTab={activeTab}
              setActiveTab={(tab) => {
                navigateToTab(tab);
                setIsSidebarOpen(false);
              }}
              user={user}
              onSignOut={handleSignOut}
              onIzyClick={() => {
                setIsIzyOpen(true);
                setIsSidebarOpen(false);
              }}
              onSupportClick={() => {
                setIsSupportOpen(true);
                setIsSidebarOpen(false);
              }}
              onCreateWorkspace={() => {
                setIsCreateWorkspaceOpen(true);
                setIsSidebarOpen(false);
              }}
              config={cmsConfig}
            />
          </SheetContent>
        </Sheet>
      </div>
      
      <main className="flex-1 overflow-y-auto bg-background p-4 md:p-8 pt-20 md:pt-8 scrollbar-thin">
        <div className="mx-auto max-w-6xl space-y-8">
          {/* Navigation Buttons */}
          <div className="flex items-center gap-2 mb-4">
            <Button
              variant="outline"
              size="sm"
              onClick={goBack}
              disabled={historyIndex === 0}
              className="rounded-xl h-9 px-3 border-border bg-card/50 shadow-sm disabled:opacity-30"
            >
              <ArrowLeftRight className="h-4 w-4 mr-2 rotate-180" />
              Back
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={goForward}
              disabled={historyIndex === tabHistory.length - 1}
              className="rounded-xl h-9 px-3 border-border bg-card/50 shadow-sm disabled:opacity-30"
            >
              Next
              <ArrowLeftRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
          {user.email === 'palmersarkodee@gmail.com' && (
            <header className="flex items-center justify-between p-4 rounded-2xl bg-card border border-border shadow-sm mb-8">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-indigo-600 animate-pulse" />
                <span className="text-sm font-bold text-muted-foreground">Admin Mode Active</span>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  window.history.pushState({}, '', '/admin-portal');
                  setIsAdminPortal(true);
                }}
                className="bg-indigo-600/10 border-indigo-600/20 text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all font-bold"
              >
                <SettingsIcon className="mr-2 h-4 w-4" />
                Admin Panel
              </Button>
            </header>
          )}
          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' && (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <Dashboard 
                  workspace={activeWorkspace} 
                  user={user} 
                  period={period} 
                  onPeriodChange={setPeriod} 
                  onNavigate={navigateToTab}
                  transactions={transactions}
                  invoices={invoices}
                  accounts={accounts}
                  allocationRules={allocationRules}
                  loading={isDataLoading}
                />
              </motion.div>
            )}
            {activeTab === 'accounts' && (
              <motion.div
                key="accounts"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <Accounts 
                  workspace={activeWorkspace} 
                  accounts={accounts}
                  transactions={transactions}
                  allocationRules={allocationRules}
                  loading={isDataLoading}
                />
              </motion.div>
            )}
            {activeTab === 'invoices' && (
              <motion.div
                key="invoices"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <Invoices 
                  workspace={activeWorkspace} 
                  initialFilters={initialFilters} 
                  invoices={invoices}
                  accounts={accounts}
                  allocationRules={allocationRules}
                  loading={isDataLoading}
                />
              </motion.div>
            )}
            {activeTab === 'catalog' && (
              <motion.div
                key="catalog"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <Catalog workspace={activeWorkspace} />
              </motion.div>
            )}
            {activeTab === 'receipts' && (
              <motion.div
                key="receipts"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <Receipts workspace={activeWorkspace} />
              </motion.div>
            )}
            {activeTab === 'transactions' && (
              <motion.div
                key="transactions"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <Transactions 
                  workspace={activeWorkspace} 
                  user={user} 
                  initialFilters={initialFilters} 
                  transactions={transactions}
                  contacts={contacts}
                  accounts={accounts}
                  allocationRules={allocationRules}
                  loading={isDataLoading}
                />
              </motion.div>
            )}
            {activeTab === 'calculator' && (
              <motion.div
                key="calculator"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <Calculator workspace={activeWorkspace} />
              </motion.div>
            )}
            {activeTab === 'subscription' && (
              <motion.div
                key="subscription"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <Subscription workspace={activeWorkspace} user={user} />
              </motion.div>
            )}
            {activeTab === 'settings' && (
              <motion.div
                key="settings"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <Settings workspace={activeWorkspace} user={user} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      <SupportChat 
        isOpen={isSupportOpen}
        onClose={() => setIsSupportOpen(false)}
      />
      <IzyAssistant 
        isOpen={isIzyOpen} 
        onClose={() => {
          setIsIzyOpen(false);
          setInitialScenario(null);
        }} 
        workspace={activeWorkspace}
        user={user}
        transactions={transactions}
        invoices={invoices}
        accounts={accounts}
        initialScenario={initialScenario}
        period={period}
      />
      <div id="tour-assistant">
        <IzyBubble 
          isOpen={isIzyOpen}
          onToggle={() => setIsIzyOpen(!isIzyOpen)}
        />
      </div>

      <Dialog open={isCreateWorkspaceOpen} onOpenChange={setIsCreateWorkspaceOpen}>
        <DialogContent className="sm:max-w-[425px] bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black tracking-tight">Create Workspace</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Add a new workspace to manage your finances.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 py-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Workspace Name</label>
              <Input
                placeholder="e.g. Design Agency"
                value={newWorkspaceName}
                onChange={(e) => setNewWorkspaceName(e.target.value)}
                className="bg-background border-border"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Workspace Type</label>
              <div className="flex gap-2">
                {['Business', 'Personal', 'NGO'].map((t) => (
                  <Button
                    key={t}
                    variant={newWorkspaceType === t ? 'default' : 'outline'}
                    onClick={() => setNewWorkspaceType(t as any)}
                    className={cn(
                      "flex-1 border-border font-bold",
                      newWorkspaceType === t ? "bg-brand text-brand-foreground hover:bg-brand/90" : "bg-background text-muted-foreground"
                    )}
                  >
                    {t}
                  </Button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button 
              onClick={createWorkspace} 
              disabled={isCreatingWorkspace || !newWorkspaceName}
              className="w-full bg-brand text-brand-foreground hover:bg-brand/90 font-bold h-11"
            >
              {isCreatingWorkspace ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Workspace'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Toaster position="top-right" />
      
      <ProductTour 
        steps={tourSteps}
        isOpen={isTourOpen}
        onComplete={handleTourComplete}
      />
    </div>
  );
}
