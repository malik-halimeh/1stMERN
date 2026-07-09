import React from 'react';

export type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'primary' | 'neutral';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  className = '',
  ...props
}) => {
  const configs = {
    primary: 'bg-primary/10 text-primary border border-primary/25',
    success: 'bg-green-50 text-success border border-green-200',
    warning: 'bg-amber-50 text-warning border border-amber-200',
    danger: 'bg-red-50 text-danger border border-red-200',
    info: 'bg-sky-50 text-info border border-sky-200',
    neutral: 'bg-dashboard-section-bg text-text-secondary border border-text-disabled/30',
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-caption font-semibold border font-sans select-none tracking-wide ${configs[variant]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
};

export default Badge;
