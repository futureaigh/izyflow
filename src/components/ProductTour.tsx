import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from './ui/button';
import { ChevronRight, ChevronLeft, X, Sparkles } from 'lucide-react';
import { cn } from '../lib/utils';

export interface TourStep {
  targetId: string;
  title: string;
  content: string;
  position: 'top' | 'bottom' | 'left' | 'right';
}

interface ProductTourProps {
  steps: TourStep[];
  onComplete: () => void;
  isOpen: boolean;
}

export function ProductTour({ steps, onComplete, isOpen }: ProductTourProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  
  const currentStep = steps[currentStepIndex];

  useEffect(() => {
    if (isOpen) {
      const updateRect = () => {
        const element = document.getElementById(currentStep.targetId);
        if (element) {
          setTargetRect(element.getBoundingClientRect());
        }
      };

      updateRect();
      window.addEventListener('resize', updateRect);
      window.addEventListener('scroll', updateRect);

      return () => {
        window.removeEventListener('resize', updateRect);
        window.removeEventListener('scroll', updateRect);
      };
    }
  }, [isOpen, currentStep]);

  const handleNext = () => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    } else {
      onComplete();
    }
  };

  const handlePrev = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  };

  if (!isOpen || !targetRect) return null;

  const spotlightStyle = {
    top: targetRect.top - 8,
    left: targetRect.left - 8,
    width: targetRect.width + 16,
    height: targetRect.height + 16,
  };

  // Calculate popover position
  let popoverStyle: any = {};
  const padding = 20;

  switch (currentStep.position) {
    case 'bottom':
      popoverStyle = {
        top: targetRect.bottom + padding,
        left: targetRect.left + targetRect.width / 2,
        x: '-50%',
      };
      break;
    case 'top':
      popoverStyle = {
        bottom: window.innerHeight - targetRect.top + padding,
        left: targetRect.left + targetRect.width / 2,
        x: '-50%',
      };
      break;
    case 'right':
      popoverStyle = {
        top: targetRect.top + targetRect.height / 2,
        left: targetRect.right + padding,
        y: '-50%',
      };
      break;
    case 'left':
      popoverStyle = {
        top: targetRect.top + targetRect.height / 2,
        right: window.innerWidth - targetRect.left + padding,
        y: '-50%',
      };
      break;
  }

  return (
    <div className="fixed inset-0 z-[100] pointer-events-none">
      {/* Backdrop with hole */}
      <div 
        className="absolute inset-0 bg-black/60 pointer-events-auto"
        style={{
          clipPath: `polygon(
            0% 0%, 0% 100%, 
            ${spotlightStyle.left}px 100%, 
            ${spotlightStyle.left}px ${spotlightStyle.top}px, 
            ${spotlightStyle.left + spotlightStyle.width}px ${spotlightStyle.top}px, 
            ${spotlightStyle.left + spotlightStyle.width}px ${spotlightStyle.top + spotlightStyle.height}px, 
            ${spotlightStyle.left}px ${spotlightStyle.top + spotlightStyle.height}px, 
            ${spotlightStyle.left}px 100%, 
            100% 100%, 100% 0%
          )`
        }}
      />

      {/* Popover */}
      <motion.div
        key={currentStepIndex}
        initial={{ opacity: 0, scale: 0.9, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="absolute bg-white p-6 rounded-2xl shadow-2xl w-[320px] pointer-events-auto border border-border"
        style={popoverStyle}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-lg bg-brand/10 flex items-center justify-center">
              <Sparkles className="h-3 w-3 text-brand" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Step {currentStepIndex + 1} of {steps.length}</span>
          </div>
          <button onClick={onComplete} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <h4 className="text-lg font-black text-slate-900 mb-2 leading-tight">{currentStep.title}</h4>
        <p className="text-sm text-slate-500 mb-6 leading-relaxed">{currentStep.content}</p>

        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={handlePrev}
            disabled={currentStepIndex === 0}
            className="text-xs font-bold"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <Button
            size="sm"
            onClick={handleNext}
            className="bg-brand text-white font-bold h-9 px-4 rounded-xl shadow-lg shadow-brand/20"
          >
            {currentStepIndex === steps.length - 1 ? 'Finish Tour' : 'Next Step'}
            {currentStepIndex < steps.length - 1 && <ChevronRight className="h-4 w-4 ml-1" />}
          </Button>
        </div>

        {/* Pulse effect on target element */}
        <motion.div 
          className="fixed pointer-events-none ring-4 ring-brand/50 rounded-lg"
          initial={{ opacity: 0, scale: 1 }}
          animate={{ 
            opacity: [0, 0.5, 0],
            scale: [0.95, 1.05, 0.95]
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          style={spotlightStyle}
        />
      </motion.div>
    </div>
  );
}
