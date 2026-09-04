import React, { createContext, useContext, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'motion/react';


interface Toast {
  id: string;
  title: string;
  message: string;
  type?: 'success' | 'error' | 'info' | 'warning';
  icon?: string;
}

interface ToastContextType {
  showToast: (title: string, message: string, type?: 'success' | 'error' | 'info' | 'warning', icon?: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((title: string, message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info', icon: string = '') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, title, message, type, icon }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => {
            const bgColors = {
              success: 'bg-emerald-950 border-emerald-900 text-emerald-400',
              error: 'bg-rose-950 border-rose-900 text-rose-400',
              warning: 'bg-amber-950 border-amber-900 text-amber-400',
              info: 'bg-zinc-900 border-zinc-800 text-zinc-300'
            };
            
            return (
              <motion.div
                key={toast.id}
                initial={{ opacity: 0, y: 50, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                className={`p-4 rounded-xl border shadow-xl flex items-start gap-3 w-72 pointer-events-auto ${bgColors[toast.type || 'info']}`}
              >
                {toast.icon && <div className="text-xl">{toast.icon}</div>}
                <div>
                  <h4 className="font-bold text-sm text-white mb-0.5">{toast.title}</h4>
                  <p className="text-xs opacity-80">{toast.message}</p>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
}
