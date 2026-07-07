import React, { useEffect } from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastProps {
  id: string;
  message: string;
  type: ToastType;
  onClose: (id: string) => void;
  duration?: number;
}

const Toast: React.FC<ToastProps> = ({
  id,
  message,
  type,
  onClose,
  duration = 5000,
}) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose(id);
    }, duration);
    return () => clearTimeout(timer);
  }, [id, duration, onClose]);

  const config = {
    success: {
      bg: 'bg-white border-l-4 border-success',
      icon: <CheckCircle2 className="h-5 w-5 text-success" />,
      text: 'text-text-primary',
    },
    error: {
      bg: 'bg-white border-l-4 border-danger',
      icon: <AlertCircle className="h-5 w-5 text-danger" />,
      text: 'text-text-primary',
    },
    warning: {
      bg: 'bg-white border-l-4 border-warning',
      icon: <AlertTriangle className="h-5 w-5 text-warning" />,
      text: 'text-text-primary',
    },
    info: {
      bg: 'bg-white border-l-4 border-info',
      icon: <Info className="h-5 w-5 text-info" />,
      text: 'text-text-primary',
    },
  };

  return (
    <div
      role="alert"
      className={`flex items-start gap-3 p-4 rounded-dropdown shadow-level2 border border-dashboard-section-bg max-w-sm w-full font-sans transition-all duration-300 animate-slide-in ${config[type].bg}`}
    >
      <div className="flex-shrink-0 mt-0.5">{config[type].icon}</div>
      <div className="flex-grow">
        <p className={`text-secondary text-body text-sm font-medium ${config[type].text}`}>{message}</p>
      </div>
      <button
        onClick={() => onClose(id)}
        className="flex-shrink-0 text-text-muted hover:text-text-secondary transition-colors focus:outline-none"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};

export default Toast;
