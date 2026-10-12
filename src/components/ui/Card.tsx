import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
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
    md: 'p-5 sm:p-6',
    lg: 'p-6 sm:p-8'
  };

  const borders = {
    subtle: 'border-border-subtle bg-surface-card text-text-primary shadow-md',
    indigo: 'border-indigo-500/30 bg-surface-card text-text-primary shadow-md',
    danger: 'border-rose-500/30 bg-surface-card text-text-primary shadow-md'
  };

  return (
    <div
      className={`
        rounded-2xl border transition-all duration-200
        ${borders[borderVariant]}
        ${paddings[padding]}
        ${interactive ? 'hover:border-border-medium hover:bg-surface-card-hover hover:-translate-y-0.5 cursor-pointer group' : ''}
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  );
};
