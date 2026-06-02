import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ClerkProvider, useUser, useAuth } from '@clerk/react';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

function ClerkAppWrapper() {
  const { isLoaded, isSignedIn, user } = useUser();
  const { getToken, signOut } = useAuth();

  const auth = {
    isLoaded,
    isSignedIn: !!isSignedIn,
    userId: user?.id ?? null,
    email: user?.primaryEmailAddress?.emailAddress ?? null,
    displayName: user?.fullName ?? null,
    photoURL: user?.imageUrl ?? null,
    getToken,
    signOut,
  };

  return <App auth={auth} />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <ClerkProvider publishableKey={PUBLISHABLE_KEY} afterSignOutUrl="/">
        <ClerkAppWrapper />
      </ClerkProvider>
    </ErrorBoundary>
  </StrictMode>,
);
