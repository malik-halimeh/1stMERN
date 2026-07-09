import React, { forwardRef } from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'success' | 'danger';
  isLoading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      className = '',
      variant = 'primary',
      isLoading = false,
      disabled,
      icon,
      iconPosition = 'left',
      type = 'button',
      ...props
    },
    ref
  ) => {
    // Styling classes strictly mapped to our design tokens
    const baseStyle =
      'inline-flex items-center justify-center font-sans font-medium text-secondary rounded-btn transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:cursor-not-allowed disabled:pointer-events-none px-4 py-2 relative';

    const variants = {
      primary: 'bg-primary text-white hover:bg-primary-dark active:bg-primary-active disabled:bg-text-disabled disabled:text-text-muted',
      secondary: 'bg-white border border-primary text-primary hover:bg-primary/5 active:bg-primary/10 disabled:border-text-disabled disabled:text-text-disabled',
      ghost: 'bg-transparent text-text-secondary hover:bg-dashboard-section-bg hover:text-text-primary active:bg-text-disabled/20 disabled:text-text-disabled',
      success: 'bg-success text-white hover:bg-green-700 active:bg-green-800 disabled:bg-text-disabled disabled:text-text-muted',
      danger: 'bg-danger text-white hover:bg-red-700 active:bg-red-800 disabled:bg-text-disabled disabled:text-text-muted',
    };

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || isLoading}
        className={`${baseStyle} ${variants[variant]} ${className}`}
        {...props}
      >
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <svg
              className="animate-spin h-5 w-5 text-current"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          </div>
        )}

        <div className={`flex items-center gap-2 ${isLoading ? 'opacity-0' : 'opacity-100'}`}>
          {icon && iconPosition === 'left' && <span className="flex-shrink-0">{icon}</span>}
          {children}
          {icon && iconPosition === 'right' && <span className="flex-shrink-0">{icon}</span>}
        </div>
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;
