import { motion, AnimatePresence } from 'motion/react';
import { Bot, Sparkles, X } from 'lucide-react';

interface IzyBubbleProps {
  isOpen: boolean;
  onToggle: () => void;
}

export function IzyBubble({ isOpen, onToggle }: IzyBubbleProps) {
  return (
    <div className="fixed bottom-6 right-6 z-[80]">
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={onToggle}
        className="h-16 w-16 rounded-full bg-blue-600 text-white shadow-2xl shadow-blue-600/40 flex items-center justify-center group relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-tr from-blue-700 to-blue-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        <div className="relative z-10">
          {isOpen ? <X className="h-8 w-8" /> : <Bot className="h-8 w-8" />}
        </div>
        {!isOpen && (
          <div className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-rose-500 text-[10px] font-black text-white ring-4 ring-background">
            <Sparkles className="h-3 w-3" />
          </div>
        )}
      </motion.button>
    </div>
  );
}
