import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';
import { ClerkProvider, useUser, useAuth } from '@clerk/react';

// Get Clerk publishable key from env
const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

function ClerkAppWrapper() {
  const { isLoaded, isSignedIn, user } = useUser();
  const { getToken, signOut } = useAuth();

  const authProp = {
    isLoaded,
    isSignedIn: !!isSignedIn,
    userId: user?.id || null,
    email: user?.primaryEmailAddress?.emailAddress || null,
    displayName: user?.fullName || null,
    photoURL: user?.imageUrl || null,
    getToken,
    signOut
  };

  return <App auth={authProp} />;
}

const mockAuth = {
  isLoaded: true,
  isSignedIn: true,
  userId: "mock-clerk-user-id",
  email: "developer@example.com",
  displayName: "Developer",
  photoURL: null,
  getToken: async () => "mock-token",
  signOut: async () => { console.log("Signing out mock user"); }
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      {PUBLISHABLE_KEY ? (
        <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
          <ClerkAppWrapper />
        </ClerkProvider>
      ) : (
        <App auth={mockAuth} />
      )}
    </ErrorBoundary>
  </StrictMode>,
);
