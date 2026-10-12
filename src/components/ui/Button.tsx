import React from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'cyan';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'primary', size = 'md', isLoading, disabled, children, ...props }, ref) => {
    const baseStyle = 'inline-flex items-center justify-center font-semibold tracking-normal transition-all duration-150 select-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-base disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]';
    
    const sizes = {
      sm: 'px-3 py-1.5 text-xs rounded-lg gap-1.5 min-h-[32px]',
      md: 'px-4 py-2 text-sm rounded-xl gap-2 min-h-[40px]',
      lg: 'px-6 py-3 text-base rounded-xl gap-2.5 min-h-[48px]'
    };

    const variants = {
      primary: 'bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-400/30 shadow-sm shadow-indigo-600/20',
      secondary: 'bg-surface-subtle hover:bg-surface-card-hover text-text-primary border border-border-subtle',
      outline: 'bg-transparent hover:bg-surface-hover text-text-primary border border-border-medium',
      ghost: 'bg-transparent hover:bg-surface-hover text-text-secondary hover:text-text-primary',
      danger: 'bg-rose-600 hover:bg-rose-500 text-white border border-rose-400/30 shadow-sm',
      cyan: 'bg-cyan-600 hover:bg-cyan-500 text-white border border-cyan-400/30 shadow-sm'
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

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'cyan';
  size?: 'sm' | 'md' | 'lg';
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className = '', icon, variant = 'secondary', size = 'md', ...props }, ref) => {
    const baseStyle = 'inline-flex items-center justify-center font-bold tracking-wide transition-all duration-200 select-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-base disabled:opacity-50 disabled:pointer-events-none active:scale-[0.96]';
    
    const sizes = {
      sm: 'w-8 h-8 rounded-[6px] text-xs',
      md: 'w-10 h-10 rounded-[10px] text-sm',
      lg: 'w-12 h-12 rounded-[16px] text-base'
    };

    const variants = {
      primary: 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md border border-indigo-500/30',
      secondary: 'bg-surface-subtle hover:bg-surface-card-hover text-text-primary border border-border-subtle',
      outline: 'bg-transparent hover:bg-surface-hover text-text-primary border border-border-medium',
      ghost: 'bg-transparent hover:bg-surface-hover text-text-secondary hover:text-text-primary',
      danger: 'bg-rose-600 hover:bg-rose-500 text-white shadow-md border border-rose-500/30',
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
