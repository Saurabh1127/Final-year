import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { Toast } from './Toast';

const ToastContext = createContext(null);

let toastCount = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    ({ message, description = '', variant = 'info', duration = 4000 }) => {
      const id = `toast-${++toastCount}-${Date.now()}`;
      setToasts((prev) => [...prev, { id, message, description, variant, duration }]);
      return id;
    },
    []
  );

  const toastMethods = useMemo(() => {
    const fn = (message, options = {}) => addToast({ message, ...options });
    fn.success = (message, description) => addToast({ message, description, variant: 'success' });
    fn.error = (message, description) => addToast({ message, description, variant: 'error' });
    fn.warning = (message, description) => addToast({ message, description, variant: 'warning' });
    fn.info = (message, description) => addToast({ message, description, variant: 'info' });
    return fn;
  }, [addToast]);

  return (
    <ToastContext.Provider value={{ toast: toastMethods, addToast, removeToast }}>
      {children}
      {toasts.length > 0 && (
        <div className="sam-toast-container" aria-live="polite">
          {toasts.map((t) => (
            <Toast key={t.id} {...t} onClose={removeToast} />
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

export default ToastContext;
