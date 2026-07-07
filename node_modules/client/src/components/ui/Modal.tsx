import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      // Prevent background scrolling
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-text-primary/40 backdrop-blur-sm transition-opacity"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        className="w-full max-w-lg bg-surface rounded-modal shadow-level3 border border-dashboard-section-bg flex flex-col overflow-hidden max-h-[90vh] animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-dashboard-section-bg select-none">
          {title ? (
            <h3 className="text-h3 font-semibold text-text-primary">{title}</h3>
          ) : (
            <div />
          )}
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-secondary transition-colors focus:outline-none p-1 hover:bg-dashboard-section-bg rounded-btn"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-grow p-6 overflow-y-auto text-body text-text-secondary">
          {children}
        </div>

        {/* Modal Footer */}
        {footer && (
          <div className="px-6 py-4 border-t border-dashboard-section-bg bg-background/50 flex justify-end gap-3 select-none">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export default Modal;
