import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageCircle, X, Send, User, Bot, Loader2, Sparkles, HelpCircle } from 'lucide-react';
import { cn } from '../lib/utils';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface SupportChatProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SupportChat({ isOpen, onClose }: SupportChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: "Hi! I'm your support assistant. How can I help you with IzyFlow today?" }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;
    // Redirect to WhatsApp for support if they start typing or just provide a button
    const url = `https://wa.me/233507750048?text=${encodeURIComponent(input.trim())}`;
    window.open(url, '_blank');
    setInput('');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="fixed right-0 top-0 h-screen w-full md:w-[400px] bg-card border-l border-border shadow-2xl z-[90] flex flex-col"
        >
          {/* Header */}
          <div className="p-6 border-b border-border flex items-center justify-between bg-emerald-600 text-white shadow-soft">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
                <MessageCircle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg">Support Chat</h3>
                <p className="text-xs text-emerald-100 flex items-center gap-1">
                  <Sparkles className="h-3 w-3" /> Live on WhatsApp
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* WhatsApp Direct Link */}
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-6">
            <div className="w-20 h-20 rounded-3xl bg-emerald-100 flex items-center justify-center animate-bounce-slow">
              <MessageCircle className="h-10 w-10 text-emerald-600" />
            </div>
            <div className="space-y-2">
              <h4 className="text-xl font-black text-foreground tracking-tight">Need help?</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Our support team is active 24/7 on WhatsApp to assist you with any issues.
              </p>
            </div>
            
            <a 
              href="https://wa.me/233507750048" 
              target="_blank" 
              rel="noopener noreferrer"
              className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-black flex items-center justify-center gap-2 hover:bg-emerald-700 transition-all shadow-lg active:scale-[0.98]"
            >
              <MessageCircle className="h-5 w-5" />
              Chat on WhatsApp
            </a>
            
            <div className="pt-4 text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
              Direct Support: +233 50 775 0048
            </div>
          </div>

          {/* Inline placeholder for consistency */}
          <div className="p-6 border-t border-border bg-muted/30">
            <div className="relative">
              <input
                type="text"
                placeholder="Type your message..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                className="w-full h-12 pl-4 pr-12 rounded-xl border border-border bg-background focus:ring-2 focus:ring-emerald-500/20 transition-all outline-none text-sm"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors disabled:opacity-50"
              >
                <Send className="h-5 w-5" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
