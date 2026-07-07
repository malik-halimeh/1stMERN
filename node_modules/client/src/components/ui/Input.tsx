import React, { forwardRef } from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
  success?: boolean;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      helperText,
      error,
      success,
      leadingIcon,
      trailingIcon,
      disabled,
      className = '',
      id,
      ...props
    },
    ref
  ) => {
    const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;

    // Build border/text classes based on state
    let borderClass = 'border-text-disabled hover:border-text-muted';
    let focusClass = 'focus:ring-2 focus:ring-primary focus:border-primary';
    let helperColorClass = 'text-text-secondary';

    if (disabled) {
      borderClass = 'border-text-disabled bg-dashboard-section-bg text-text-disabled cursor-not-allowed';
      focusClass = '';
    } else if (error) {
      borderClass = 'border-danger text-danger';
      focusClass = 'focus:ring-2 focus:ring-danger focus:border-danger';
      helperColorClass = 'text-danger';
    } else if (success) {
      borderClass = 'border-success text-success';
      focusClass = 'focus:ring-2 focus:ring-success focus:border-success';
      helperColorClass = 'text-success';
    }

    return (
      <div className="flex flex-col gap-1 w-full font-sans">
        {label && (
          <label
            htmlFor={inputId}
            className={`text-label-sm font-medium ${
              error ? 'text-danger' : success ? 'text-success' : 'text-text-primary'
            }`}
          >
            {label}
          </label>
        )}

        <div className="relative flex items-center">
          {leadingIcon && (
            <span className="absolute left-4 text-text-muted flex items-center justify-center pointer-events-none">
              {leadingIcon}
            </span>
          )}

          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            className={`w-full px-4 py-2 border rounded-input bg-surface text-body placeholder:text-text-muted transition-colors focus:outline-none ${borderClass} ${focusClass} ${
              leadingIcon ? 'pl-12' : ''
            } ${trailingIcon ? 'pr-12' : ''} ${className}`}
            {...props}
          />

          {trailingIcon && (
            <span className="absolute right-4 text-text-muted flex items-center justify-center pointer-events-none">
              {trailingIcon}
            </span>
          )}
        </div>

        {(error || helperText) && (
          <p className={`text-caption ${helperColorClass}`}>
            {error || helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;
