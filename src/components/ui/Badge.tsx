import React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'cyan' | 'amber';
}

export const Badge: React.FC<BadgeProps> = ({ className = '', variant = 'primary', children, ...props }) => {
  const variants = {
    primary: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 border-indigo-500/25',
    secondary: 'bg-surface-subtle text-text-secondary border-border-subtle',
    success: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/25',
    warning: 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/25',
    danger: 'bg-rose-500/15 text-rose-600 dark:text-rose-300 border-rose-500/25',
    cyan: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-300 border-cyan-500/25',
    amber: 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/25'
  };

  return (
    <span
      className={`
        inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium
        border ${variants[variant]} ${className}
      `}
      {...props}
    >
      {children}
    </span>
  );
};
