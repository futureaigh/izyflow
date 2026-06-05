import { useState, useEffect, Suspense, lazy } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Toaster } from './ui/sonner';

// Lazy load non-critical components
const Sidebar = lazy(() => import('./Sidebar'));
const Dashboard = lazy(() => import('./Dashboard'));
const Accounts = lazy(() => import('./Accounts'));
const Invoices = lazy(() => import('./Invoices'));
const Transactions = lazy(() => import('./Transactions'));
const Calculator = lazy(() => import('./Calculator'));
const Settings = lazy(() => import('./Settings'));
const Subscription = lazy(() => import('./Subscription'));
const Receipts = lazy(() => import('./Receipts'));
const Catalog = lazy(() => import('./Catalog'));
const SupportChat = lazy(() => import('./SupportChat'));
const IzyAssistant = lazy(() => import('./IzyAssistant'));
const IzyBubble = lazy(() => import('./IzyBubble'));
const AdminPortal = lazy(() => import('./AdminPortal'));
const ProductTour = lazy(() => import('./ProductTour'));

const LoadingFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-[#050505]">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand mx-auto mb-4" />
      <p className="text-gray-400">Loading...</p>
    </div>
  </div>
);

const CriticalApp = ({ children }: { children: React.ReactNode }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    className="min-h-screen"
  >
    {children}
  </motion.div>
);

interface OptimizedLayoutProps {
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

export default function OptimizedLayout({ auth }: OptimizedLayoutProps) {
  const [isClient, setIsClient] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setIsClient(true);
    setHydrated(true);
  }, []);

  if (!isClient || !hydrated) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand mx-auto mb-4" />
          <p className="text-gray-400">Initializing...</p>
        </div>
      </div>
    );
  }

  if (!auth.isLoaded) {
    return <LoadingFallback />;
  }

  if (!auth.isSignedIn) {
    return (
      <CriticalApp>
        <Suspense fallback={<LoadingFallback />}>
          <LandingPageOptimized />
          <Toaster position="top-right" />
        </Suspense>
      </CriticalApp>
    );
  }

  return (
    <CriticalApp>
      <div className="flex h-screen w-full bg-background text-foreground overflow-hidden">
        {/* Desktop Sidebar */}
        <Suspense fallback={<div className="w-64 bg-card border-r border-border" />}>
          <Sidebar />
        </Suspense>

        <main className="flex-1 overflow-y-auto bg-background">
          <Suspense fallback={<LoadingFallback />}>
            <div className="p-4 md:p-8 pt-20 md:pt-8">
              <AnimatePresence mode="wait">
                {/* Lazy-loaded routes/components would go here */}
                <motion.div
                  key="dashboard"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                >
                  <Dashboard />
                </motion.div>
              </AnimatePresence>
            </div>
          </Suspense>
        </main>

        {/* Lazy-loaded modals */}
        <Suspense fallback={null}>
          <SupportChat />
          <IzyAssistant />
          <IzyBubble />
          <ProductTour />
          <AdminPortal />
          <Toaster position="top-right" />
        </Suspense>
      </div>
    </CriticalApp>
  );
}