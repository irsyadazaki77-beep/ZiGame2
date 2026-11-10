import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', label, error, icon, type = 'text', id, ...props }, ref) => {
    const errorId = id ? `${id}-error` : error ? 'input-error-msg' : undefined;
    return (
      <div className="w-full flex flex-col gap-1.5">
        {label && (
          <label htmlFor={id} className="text-xs font-mono font-bold text-text-secondary uppercase tracking-wider">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {icon && (
            <div className="absolute left-3.5 text-text-muted flex items-center justify-center pointer-events-none">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            id={id}
            type={type}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : undefined}
            className={`
              w-full bg-surface-sunken border border-border-medium text-text-primary font-sans text-sm rounded-[10px] py-2.5 px-3.5
              placeholder:text-text-muted transition-all focus:outline-none focus:border-indigo-500
              focus:ring-2 focus:ring-indigo-500/20 focus:ring-offset-0 disabled:opacity-50 disabled:pointer-events-none
              ${icon ? 'pl-10' : ''}
              ${error ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : ''}
              ${className}
            `}
            {...props}
          />
        </div>
        {error && (
          <span id={errorId} className="text-xs font-mono text-rose-400 tracking-wide mt-0.5 uppercase">
            {error}
          </span>
        )}
      </div>
    );
  }
);
Input.displayName = 'Input';

export interface SearchInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
}

export const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className = '', ...props }, ref) => {
    return (
      <div className="relative w-full">
        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted flex items-center justify-center pointer-events-none">
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        </div>
        <input
          ref={ref}
          type="text"
          className={`
            w-full bg-surface-sunken border border-border-medium text-text-primary font-sans text-xs rounded-full pl-10 pr-4.5 py-2.5
            placeholder:text-text-muted transition-all focus:outline-none focus:border-indigo-500
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

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: { value: string; label: string }[];
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className = '', label, options, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label className="text-xs font-mono font-bold text-text-secondary uppercase tracking-wider">
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            className={`
              w-full bg-surface-sunken border border-border-medium text-text-primary text-xs font-bold uppercase tracking-wider rounded-[10px] px-3.5 py-2.5 pr-10
              focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 cursor-pointer appearance-none
              ${className}
            `}
            {...props}
          >
            {options.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-surface-elevated text-text-primary">
                {opt.label}
              </option>
            ))}
          </select>
          <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-text-muted">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
          </div>
        </div>
      </div>
    );
  }
);
Select.displayName = 'Select';

export interface SwitchProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  label?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

export const Switch: React.FC<SwitchProps> = ({ className = '', label, checked, onCheckedChange, ...props }) => {
  return (
    <label className={`flex items-center justify-between cursor-pointer group select-none gap-4 ${className}`}>
      {label && (
        <span className="text-xs font-mono font-bold text-text-primary uppercase tracking-wider font-sans">
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
        <div className={`w-10 h-6 rounded-full transition-colors duration-200 border border-border-subtle ${checked ? 'bg-indigo-600' : 'bg-surface-sunken'}`}></div>
        <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform duration-200 shadow-md ${checked ? 'translate-x-4' : 'translate-x-0'}`}></div>
      </div>
    </label>
  );
};
