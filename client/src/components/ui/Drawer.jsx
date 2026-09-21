import React, { useEffect, useId, useRef } from 'react';
import './Drawer.css';

/**
 * Samvada Drawer Component
 * Side sheet panel for sidebars, participant lists, transcripts, and settings with focus isolation.
 */
export function Drawer({
  isOpen,
  onClose,
  position = 'right', // 'right' | 'left' | 'bottom'
  size = 'md', // 'sm' | 'md' | 'lg'
  title = '',
  children,
  footer = null,
  showCloseButton = true,
  className = '',
}) {
  const generatedId = useId();
  const titleId = `${generatedId}-drawer-title`;
  const drawerRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Auto-focus first focusable element
    const timer = setTimeout(() => {
      if (drawerRef.current) {
        const focusable = drawerRef.current.querySelectorAll(
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

      // Focus trap within drawer
      if (e.key === 'Tab') {
        if (!drawerRef.current) return;
        const focusable = drawerRef.current.querySelectorAll(
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
    <>
      <div
        className="sam-drawer-backdrop"
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        className={`sam-drawer sam-drawer--${position} sam-drawer--${size} ${className}`.trim()}
      >
        {(title || showCloseButton) && (
          <div className="sam-drawer-header">
            {title && (
              <h3 id={titleId} className="sam-drawer-title">
                {title}
              </h3>
            )}

            {showCloseButton && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close panel"
                className="sam-drawer-close-btn"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>
        )}

        <div className="sam-drawer-body">{children}</div>

        {footer && <div className="sam-drawer-footer">{footer}</div>}
      </aside>
    </>
  );
}

export default Drawer;
