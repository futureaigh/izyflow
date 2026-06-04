import { useEffect, useState } from 'react';
import { SignIn, SignUp } from '@clerk/react';
import { AnimatePresence, motion } from 'motion/react';
import { Button } from './ui/button';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'sign-in' | 'sign-up';
}

export function AuthModal({ isOpen, onClose, mode }: AuthModalProps) {
  const [isSignUp, setIsSignUp] = useState(mode === 'sign-up');

  useEffect(() => { setIsSignUp(mode === 'sign-up'); }, [mode]);

  useEffect(() => {
    if (!isOpen) return;
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [isOpen, onClose]);
  useEffect(() => {
    if (isOpen) {
      window.location.hash = isSignUp ? '#/sign-up' : '#/sign-in';
    } else {
      if (window.location.hash.includes('sign-in') || window.location.hash.includes('sign-up')) {
        window.location.hash = '';
      }
    }
  }, [isOpen, isSignUp]);
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={onClose}
              className="absolute -top-2 -right-2 z-10 flex size-6 items-center justify-center rounded-full bg-background text-muted-foreground hover:text-foreground shadow-sm"
              aria-label="Close"
            >
              ✕
            </button>
            {isSignUp ? (
              <SignUp routing="hash" signInUrl="#/sign-in" />
            ) : (
              <SignIn routing="hash" signUpUrl="#/sign-up" />
            )}
            <div className="mt-4 text-center">
              <Button
                variant="ghost"
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                {isSignUp
                  ? 'Already have an account? Sign In'
                  : "Don't have an account? Sign Up"}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}