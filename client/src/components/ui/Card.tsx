import React, { forwardRef } from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  // Option to override default padding if needed, but defaults to p-6 (24px)
  customPadding?: string;
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ children, className = '', customPadding = 'p-6', ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`bg-surface rounded-card shadow-level1 border border-dashboard-section-bg/50 ${customPadding} ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

export default Card;
