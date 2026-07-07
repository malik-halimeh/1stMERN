import React from 'react';
import Button from './Button';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-16 text-center bg-surface border border-dashboard-section-bg rounded-card shadow-level1 max-w-xl mx-auto font-sans">
      <div className="p-4 bg-dashboard-section-bg rounded-full text-text-secondary mb-6 flex items-center justify-center">
        {icon}
      </div>
      <h3 className="text-h3 text-text-primary mb-2 font-semibold">{title}</h3>
      <p className="text-secondary text-text-secondary mb-6 max-w-sm">{description}</p>
      {actionLabel && onAction && (
        <Button variant="primary" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
};

export default EmptyState;
