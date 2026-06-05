import { useEffect, useState } from 'react';
import { useClerk } from '@clerk/react';
import { Toaster } from './components/ui/sonner';

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
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth.isLoaded) return;

    if (auth.isSignedIn) {
      setUser({
        uid: auth.userId,
        email: auth.email,
        displayName: auth.displayName
      });
    } else {
      setUser(null);
    }
    setLoading(false);
  }, [auth.isLoaded, auth.isSignedIn]);

  if (!auth.isLoaded || loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand mx-auto mb-4"></div>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-5xl font-bold mb-4">IzyFlow</h1>
          <p className="text-gray-400">Please sign in to continue</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold mb-4">Welcome to IzyFlow</h1>
        <p className="text-lg text-gray-300">Welcome back, {user.displayName || user.email}</p>
      </div>
      <Toaster position="top-right" />
    </div>
  );
}