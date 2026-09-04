import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, AlertTriangle, RefreshCw, Loader2, Info } from 'lucide-react';

// ==========================================
// 1. BUTTON
// ==========================================
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'cyan';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'primary', size = 'md', isLoading, disabled, children, ...props }, ref) => {
    const baseStyle = 'inline-flex items-center justify-center font-bold tracking-wide uppercase transition-all duration-200 select-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]';
    
    const sizes = {
      sm: 'px-3 py-1.5 text-xs rounded-[6px] gap-1.5 min-h-[32px]',
      md: 'px-5 py-2.5 text-sm rounded-[10px] gap-2 min-h-[44px]',
      lg: 'px-8 py-4 text-base rounded-[16px] gap-3 min-h-[52px]'
    };

    const variants = {
      primary: 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/15 border border-indigo-500/30 focus-visible:ring-indigo-500',
      secondary: 'bg-zinc-900 hover:bg-zinc-800 text-zinc-100 border border-zinc-800/80 focus-visible:ring-zinc-600',
      outline: 'bg-transparent hover:bg-zinc-900 text-zinc-200 border border-zinc-800 focus-visible:ring-zinc-600',
      ghost: 'bg-transparent hover:bg-zinc-900/60 text-zinc-400 hover:text-zinc-100 focus-visible:ring-zinc-700',
      danger: 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/15 border border-red-500/30 focus-visible:ring-red-500',
      cyan: 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-600/15 border border-cyan-500/30 focus-visible:ring-cyan-500'
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`${baseStyle} ${sizes[size]} ${variants[variant]} ${className}`}
        {...props}
      >
        {isLoading && <Loader2 className="w-4 h-4 animate-spin text-current" />}
        {!isLoading && children}
      </button>
    );
  }
);
Button.displayName = 'Button';

// ==========================================
// 2. CARD
// ==========================================
interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  borderVariant?: 'subtle' | 'indigo' | 'danger';
}

export const Card: React.FC<CardProps> = ({ 
  className = '', 
  interactive = false, 
  padding = 'md', 
  borderVariant = 'subtle',
  children, 
  ...props 
}) => {
  const paddings = {
    none: 'p-0',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8'
  };

  const borders = {
    subtle: 'border-zinc-800/80 bg-zinc-900/60 shadow-[0_4px_24px_rgba(0,0,0,0.4)]',
    indigo: 'border-indigo-500/20 bg-zinc-900/80 shadow-[0_4px_24px_rgba(79,70,229,0.08)]',
    danger: 'border-red-500/20 bg-zinc-900/80 shadow-[0_4px_24px_rgba(239,68,68,0.08)]'
  };

  return (
    <div
      className={`
        rounded-[16px] border backdrop-blur-md transition-all duration-300
        ${borders[borderVariant]}
        ${paddings[padding]}
        ${interactive ? 'hover:border-indigo-500/40 hover:-translate-y-1 hover:shadow-[0_12px_32px_rgba(79,70,229,0.12)] cursor-pointer group' : ''}
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  );
};

// ==========================================
// 3. INPUT
// ==========================================
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', label, error, icon, type = 'text', ...props }, ref) => {
    return (
      <div className="w-full flex flex-col gap-1.5">
        {label && (
          <label className="text-xs font-mono font-bold text-zinc-400 uppercase tracking-wider">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {icon && (
            <div className="absolute left-3.5 text-zinc-500 flex items-center justify-center pointer-events-none">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            type={type}
            className={`
              w-full bg-zinc-950 border border-zinc-800 text-zinc-100 font-sans text-sm rounded-[10px] py-2.5 px-3.5
              placeholder:text-zinc-600 transition-all focus:outline-none focus:border-indigo-500
              focus:ring-2 focus:ring-indigo-500/20 focus:ring-offset-0 disabled:opacity-50 disabled:pointer-events-none
              ${icon ? 'pl-10' : ''}
              ${error ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : ''}
              ${className}
            `}
            {...props}
          />
        </div>
        {error && (
          <span className="text-xs font-mono text-red-400 tracking-wide mt-0.5 uppercase">
            {error}
          </span>
        )}
      </div>
    );
  }
);
Input.displayName = 'Input';

// ==========================================
// 4. BADGE
// ==========================================
interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'cyan' | 'amber';
}

export const Badge: React.FC<BadgeProps> = ({ className = '', variant = 'primary', children, ...props }) => {
  const variants = {
    primary: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    secondary: 'bg-zinc-800 text-zinc-400 border-zinc-700',
    success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    warning: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    danger: 'bg-red-500/10 text-red-400 border-red-500/20',
    cyan: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    amber: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
  };

  return (
    <span
      className={`
        inline-flex items-center px-2.5 py-0.5 rounded-[6px] text-[10px] font-mono font-bold
        uppercase border tracking-widest ${variants[variant]} ${className}
      `}
      {...props}
    >
      {children}
    </span>
  );
};

// ==========================================
// 5. MODAL
// ==========================================
interface ModalProps {
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
  // Listen for escape key press
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
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl'
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Backdrop Click closes menu */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
          />
          
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 15 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className={`
              relative w-full ${sizes[size]} bg-zinc-900 border border-zinc-800 rounded-[16px] 
              shadow-2xl shadow-black/80 flex flex-col max-h-[85vh] overflow-hidden z-10
            `}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80">
              {title ? (
                <h3 className="font-display font-black text-sm md:text-base tracking-widest text-white uppercase truncate">
                  {title}
                </h3>
              ) : (
                <div />
              )}
              <button
                onClick={onClose}
                className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-[6px] transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
                aria-label="Tutup"
              >
                <X size={16} />
              </button>
            </div>
            
            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

// ==========================================
// 6. TOOLTIP
// ==========================================
interface TooltipProps {
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
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-zinc-950 border border-zinc-800 text-zinc-300 font-mono text-[10px] font-bold uppercase tracking-wider rounded-[6px] whitespace-nowrap z-50 shadow-xl pointer-events-none"
          >
            {content}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ==========================================
// 7. EMPTY STATE
// ==========================================
interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, description, action }) => {
  return (
    <div className="flex flex-col items-center justify-center text-center p-8 md:p-12 border border-zinc-800/50 border-dashed rounded-[16px] bg-zinc-900/10 backdrop-blur-sm">
      {icon && <div className="text-zinc-600 mb-4">{icon}</div>}
      <h3 className="font-display font-bold text-sm tracking-widest text-zinc-300 uppercase mb-2">{title}</h3>
      <p className="text-xs text-zinc-500 max-w-sm leading-relaxed mb-6">{description}</p>
      {action && <div>{action}</div>}
    </div>
  );
};

// ==========================================
// 8. LOADING STATE
// ==========================================
interface LoadingStateProps {
  message?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({ message = 'Memproses data siber...' }) => {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 gap-3.5">
      <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      <span className="font-mono text-xs text-zinc-400 tracking-widest uppercase animate-pulse">
        {message}
      </span>
    </div>
  );
};

// ==========================================
// 9. ERROR STATE
// ==========================================
interface ErrorStateProps {
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
        <p className="text-xs text-zinc-400 leading-relaxed font-sans">{message}</p>
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

// ==========================================
// 10. SECTION HEADING
// ==========================================
interface SectionHeadingProps {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export const SectionHeading: React.FC<SectionHeadingProps> = ({ icon, title, subtitle, action }) => {
  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6 border-b border-zinc-800/50 pb-4">
      <div className="flex items-start gap-3">
        {icon && <div className="mt-1 flex items-center justify-center shrink-0">{icon}</div>}
        <div>
          <h2 className="font-display font-black text-lg md:text-xl text-white tracking-widest uppercase leading-none mb-1.5">
            {title}
          </h2>
          {subtitle && (
            <p className="text-xs text-zinc-500 uppercase tracking-wider font-mono">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
};

// ==========================================
// 11. ICON BUTTON
// ==========================================
interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'cyan';
  size?: 'sm' | 'md' | 'lg';
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className = '', icon, variant = 'secondary', size = 'md', ...props }, ref) => {
    const baseStyle = 'inline-flex items-center justify-center font-bold tracking-wide transition-all duration-200 select-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.96]';
    
    const sizes = {
      sm: 'w-8 h-8 rounded-[6px] text-xs',
      md: 'w-10 h-10 rounded-[10px] text-sm',
      lg: 'w-12 h-12 rounded-[16px] text-base'
    };

    const variants = {
      primary: 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md border border-indigo-500/30',
      secondary: 'bg-zinc-900 hover:bg-zinc-800 text-zinc-100 border border-zinc-800/80',
      outline: 'bg-transparent hover:bg-zinc-900 text-zinc-200 border border-zinc-800',
      ghost: 'bg-transparent hover:bg-zinc-900/60 text-zinc-400 hover:text-zinc-100',
      danger: 'bg-red-600 hover:bg-red-500 text-white shadow-md border border-red-500/30',
      cyan: 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-md border border-cyan-500/30'
    };

    return (
      <button
        ref={ref}
        className={`${baseStyle} ${sizes[size]} ${variants[variant]} ${className}`}
        {...props}
      >
        {icon}
      </button>
    );
  }
);
IconButton.displayName = 'IconButton';

// ==========================================
// 12. SEARCH INPUT
// ==========================================
interface SearchInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
}

export const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className = '', ...props }, ref) => {
    return (
      <div className="relative w-full">
        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 flex items-center justify-center pointer-events-none">
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        </div>
        <input
          ref={ref}
          type="text"
          className={`
            w-full bg-zinc-950 border border-zinc-800 text-zinc-100 font-sans text-xs rounded-full pl-10 pr-4.5 py-2.5
            placeholder:text-zinc-600 transition-all focus:outline-none focus:border-indigo-500
            focus:ring-2 focus:ring-indigo-500/20 focus:ring-offset-0 disabled:opacity-50 disabled:pointer-events-none
            ${className}
          `}
          {...props}
        />
      </div>
    );
  }
);
SearchInput.displayName = 'SearchInput';

// ==========================================
// 13. SELECT
// ==========================================
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: { value: string; label: string }[];
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className = '', label, options, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label className="text-xs font-mono font-bold text-zinc-400 uppercase tracking-wider">
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            className={`
              w-full bg-zinc-950 border border-zinc-800 text-zinc-300 text-xs font-bold uppercase tracking-wider rounded-[10px] px-3.5 py-2.5 pr-10
              focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 cursor-pointer appearance-none
              ${className}
            `}
            {...props}
          >
            {options.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-zinc-950 text-zinc-300">
                {opt.label}
              </option>
            ))}
          </select>
          <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
          </div>
        </div>
      </div>
    );
  }
);
Select.displayName = 'Select';

// ==========================================
// 14. SWITCH
// ==========================================
interface SwitchProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  label?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

export const Switch: React.FC<SwitchProps> = ({ className = '', label, checked, onCheckedChange, ...props }) => {
  return (
    <label className={`flex items-center justify-between cursor-pointer group select-none gap-4 ${className}`}>
      {label && (
        <span className="text-xs font-mono font-bold text-zinc-300 uppercase tracking-wider font-sans">
          {label}
        </span>
      )}
      <div className="relative">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onCheckedChange(e.target.checked)}
          className="sr-only"
          {...props}
        />
        <div className={`w-10 h-6 rounded-full transition-colors duration-200 border border-zinc-800 ${checked ? 'bg-indigo-600' : 'bg-zinc-950'}`}></div>
        <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform duration-200 shadow-md ${checked ? 'translate-x-4' : 'translate-x-0'}`}></div>
      </div>
    </label>
  );
};

// ==========================================
// 15. BOTTOM SHEET
// ==========================================
interface BottomSheetProps {
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
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />
          
          {/* Sheet Container */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
            className="relative w-full max-w-lg bg-zinc-900 border-t border-zinc-800 rounded-t-[20px] shadow-2xl flex flex-col max-h-[85vh] overflow-hidden z-10"
          >
            {/* Grabber handle bar for swipe down intuition */}
            <div className="w-12 h-1.5 bg-zinc-800 rounded-full mx-auto my-3 cursor-pointer" onClick={onClose} />
            
            {/* Header */}
            {title && (
              <div className="flex items-center justify-between px-6 pb-4 border-b border-zinc-800/80">
                <h3 className="font-display font-black text-sm tracking-widest text-white uppercase truncate">
                  {title}
                </h3>
                <button
                  onClick={onClose}
                  className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-[6px] transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  aria-label="Tutup"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </button>
              </div>
            )}
            
            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

// ==========================================
// 16. PROGRESS BAR
// ==========================================
interface ProgressBarProps {
  progress: number;
  colorTheme?: string;
  className?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ progress, colorTheme = '#6366f1', className = '' }) => {
  const pct = Math.min(100, Math.max(0, progress));
  return (
    <div className={`w-full h-2 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800 p-[1px] ${className}`}>
      <div
        className="h-full rounded-full transition-all duration-500 ease-out relative"
        style={{ 
          width: `${pct}%`,
          backgroundColor: colorTheme,
          boxShadow: `0 0 10px ${colorTheme}40`
        }}
      >
        <div className="absolute inset-0 bg-white/10 animate-pulse mix-blend-overlay"></div>
      </div>
    </div>
  );
};

// ==========================================
// 17. SKELETON
// ==========================================
interface SkeletonProps {
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
    <div className={`animate-pulse bg-zinc-800/40 border border-zinc-800/20 ${shapes[variant]} ${className}`} />
  );
};
