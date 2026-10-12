import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({ 
  isOpen, 
  onClose, 
  title, 
  size = 'md', 
  children 
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const sizes = {
    sm: 'sm:max-w-md',
    md: 'sm:max-w-lg',
    lg: 'sm:max-w-2xl',
    xl: 'sm:max-w-4xl'
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm sm:backdrop-blur-md"
          />
          
          <motion.div
            initial={{ y: '100%', opacity: 0.5 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 350 }}
            className={`
              relative w-full ${sizes[size]} bg-surface-card border-t sm:border border-border-subtle 
              rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col 
              max-h-[90dvh] sm:max-h-[85vh] overflow-hidden z-10 pb-safe text-text-primary
            `}
          >
            {/* Mobile Sheet Drag Indicator */}
            <div className="sm:hidden w-full flex justify-center pt-2 pb-1 bg-surface-subtle">
              <div className="w-10 h-1 rounded-full bg-border-medium" />
            </div>

            {/* Modal Header */}
            <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-border-subtle bg-surface-subtle">
              {title ? (
                <h3 className="font-semibold text-sm sm:text-base text-text-primary truncate">
                  {title}
                </h3>
              ) : (
                <div />
              )}
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                aria-label="Tutup Dialog"
              >
                <X size={16} />
              </button>
            </div>
            
            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-5 overscroll-contain">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({ isOpen, onClose, title, children }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />
          
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
            className="relative w-full max-w-lg bg-surface-card border-t border-border-subtle rounded-t-[20px] shadow-2xl flex flex-col max-h-[85vh] overflow-hidden z-10 text-text-primary"
          >
            <div className="w-12 h-1.5 bg-border-medium rounded-full mx-auto my-3 cursor-pointer" onClick={onClose} />
            
            {title && (
              <div className="flex items-center justify-between px-6 pb-4 border-b border-border-subtle">
                <h3 className="font-display font-black text-sm tracking-widest text-text-primary uppercase truncate">
                  {title}
                </h3>
                <button
                  onClick={onClose}
                  className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-surface-hover rounded-[6px] transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  aria-label="Tutup"
                >
                  <X size={16} />
                </button>
              </div>
            )}
            
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
