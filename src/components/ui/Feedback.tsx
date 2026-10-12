import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from './Button';

export interface TooltipProps {
  content: string;
  children: React.ReactElement;
}

export const Tooltip: React.FC<TooltipProps> = ({ content, children }) => {
  const [visible, setVisible] = React.useState(false);

  return (
    <div 
      className="relative inline-block"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      {children}
      <AnimatePresence>
        {visible && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 5 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-surface-elevated border border-border-medium text-text-primary font-mono text-[10px] font-bold uppercase tracking-wider rounded-[6px] whitespace-nowrap z-50 shadow-xl pointer-events-none"
          >
            {content}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, description, action }) => {
  return (
    <div className="flex flex-col items-center justify-center text-center p-8 md:p-12 border border-border-medium border-dashed rounded-[16px] bg-surface-card/40 backdrop-blur-sm">
      {icon && <div className="text-text-muted mb-4">{icon}</div>}
      <h3 className="font-display font-bold text-sm tracking-widest text-text-primary uppercase mb-2">{title}</h3>
      <p className="text-xs text-text-muted max-w-sm leading-relaxed mb-6">{description}</p>
      {action && <div>{action}</div>}
    </div>
  );
};

export interface LoadingStateProps {
  message?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({ message = 'Memproses data siber...' }) => {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 gap-3.5">
      <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      <span className="font-mono text-xs text-text-secondary tracking-widest uppercase animate-pulse">
        {message}
      </span>
    </div>
  );
};

export interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({ 
  title = 'System Interrupted', 
  message, 
  onRetry 
}) => {
  return (
    <div className="border border-red-500/20 bg-red-950/10 backdrop-blur-md rounded-[16px] p-6 max-w-lg mx-auto flex flex-col items-center text-center gap-4">
      <div className="p-3 bg-red-500/10 rounded-full text-red-500 border border-red-500/20">
        <AlertTriangle size={24} />
      </div>
      <div>
        <h3 className="font-display font-black text-sm md:text-base text-red-400 tracking-wider uppercase mb-1">{title}</h3>
        <p className="text-xs text-text-muted leading-relaxed font-sans">{message}</p>
      </div>
      {onRetry && (
        <Button variant="danger" size="sm" onClick={onRetry} className="mt-2 flex items-center gap-2">
          <RefreshCw size={12} />
          REBOOT SESSION
        </Button>
      )}
    </div>
  );
};

export interface SectionHeadingProps {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export const SectionHeading: React.FC<SectionHeadingProps> = ({ icon, title, subtitle, action }) => {
  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6 border-b border-border-subtle pb-4">
      <div className="flex items-start gap-3">
        {icon && <div className="mt-1 flex items-center justify-center shrink-0">{icon}</div>}
        <div>
          <h2 className="font-display font-black text-lg md:text-xl text-text-primary tracking-widest uppercase leading-none mb-1.5">
            {title}
          </h2>
          {subtitle && (
            <p className="text-xs text-text-muted uppercase tracking-wider font-mono">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
};

export interface ProgressBarProps {
  progress: number;
  colorTheme?: string;
  className?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ progress, colorTheme = '#6366f1', className = '' }) => {
  const pct = Math.min(100, Math.max(0, progress));
  return (
    <div className={`w-full h-2 bg-surface-sunken rounded-full overflow-hidden border border-border-subtle p-[1px] ${className}`}>
      <div
        className="h-full rounded-full transition-all duration-500 ease-out relative"
        style={{ 
          width: `${pct}%`,
          backgroundColor: colorTheme,
          boxShadow: `0 0 10px ${colorTheme}30`
        }}
      >
        <div className="absolute inset-0 bg-white/10 animate-pulse mix-blend-overlay"></div>
      </div>
    </div>
  );
};

export interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'rect' | 'circle';
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '', variant = 'rect' }) => {
  const shapes = {
    text: 'h-4 w-full rounded-[6px]',
    rect: 'h-24 w-full rounded-[10px]',
    circle: 'w-12 h-12 rounded-full'
  };
  return (
    <div className={`animate-pulse bg-surface-subtle border border-border-subtle ${shapes[variant]} ${className}`} />
  );
};
