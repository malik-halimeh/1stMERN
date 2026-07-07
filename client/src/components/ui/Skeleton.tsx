import React from 'react';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'text' | 'rect' | 'circle';
}

const Skeleton: React.FC<SkeletonProps> = ({
  variant = 'rect',
  className = '',
  ...props
}) => {
  const baseClass = 'animate-pulse bg-text-disabled/30';

  const variantClasses = {
    text: 'h-4 w-full rounded-btn',
    rect: 'w-full rounded-card',
    circle: 'rounded-full',
  };

  return (
    <div
      className={`${baseClass} ${variantClasses[variant]} ${className}`}
      {...props}
    />
  );
};

export default Skeleton;
