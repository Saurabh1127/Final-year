import React, { useEffect, useId, useRef } from 'react';
import './Modal.css';

/**
 * Samvada Modal Component
 * Accessible dialog overlay with background blur, focus trap isolation, and Escape key handling.
 */
export function Modal({
  isOpen,
  onClose,
  title,
  description = '',
  size = 'md', // 'sm' | 'md' | 'lg' | 'xl'
  children,
  footer = null,
  showCloseButton = true,
  className = '',
}) {
  const generatedId = useId();
  const titleId = `${generatedId}-title`;
  const descId = `${generatedId}-desc`;
  const modalRef = useRef(null);

  // Handle ESC key, focus trapping, and scroll lock
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Auto-focus first focusable element inside modal
    const timer = setTimeout(() => {
      if (modalRef.current) {
        const focusable = modalRef.current.querySelectorAll(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length > 0) {
          focusable[0].focus();
        }
      }
    }, 50);

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose?.();
        return;
      }

      // Focus trap within modal
      if (e.key === 'Tab') {
        if (!modalRef.current) return;
        const focusable = modalRef.current.querySelectorAll(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) {
          e.preventDefault();
          return;
        }

        const firstElement = focusable[0];
        const lastElement = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      clearTimeout(timer);
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="sam-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose?.();
        }
      }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descId : undefined}
        className={`sam-modal sam-modal--${size} ${className}`.trim()}
      >
        {(title || showCloseButton) && (
          <div className="sam-modal-header">
            <div className="sam-modal-title-group">
              {title && (
                <h2 id={titleId} className="sam-modal-title">
                  {title}
                </h2>
              )}
              {description && (
                <p id={descId} className="sam-modal-desc">
                  {description}
                </p>
              )}
            </div>

            {showCloseButton && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close dialog"
                className="sam-modal-close-btn"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>
        )}

        <div className="sam-modal-body">{children}</div>

        {footer && <div className="sam-modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

export default Modal;
