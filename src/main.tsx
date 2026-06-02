import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';
const mockAuth = {
  isLoaded: true,
  isSignedIn: true,
  userId: "dev-user",
  email: "developer@example.com",
  displayName: "Developer",
  photoURL: null,
  getToken: async () => "dev-token",
  signOut: async () => { console.log("Sign out"); }
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App auth={mockAuth} />
    </ErrorBoundary>
  </StrictMode>,
);
