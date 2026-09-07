import React from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface SecurityToastProps {
  visible: boolean;
  message?: string;
}

export const SecurityToast: React.FC<SecurityToastProps> = ({
  visible,
  message = 'Sesi tidak aktif. Mengunci otomatis demi keamanan...'
}) => {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -20, x: '-50%' }}
          animate={{ opacity: 1, y: 0, x: '-50%' }}
          exit={{ opacity: 0, y: -20, x: '-50%' }}
          className="fixed top-4 left-1/2 z-50 bg-red-950/90 border border-red-500/40 text-red-200 px-5 py-2.5 rounded-xl shadow-2xl backdrop-blur-md flex items-center gap-3 text-sm font-medium"
        >
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
          <div>{message}</div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
