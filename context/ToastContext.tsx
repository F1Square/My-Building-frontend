import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import Toast from '../components/Toast';
import { setToastInstance } from '../utils/alert';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastOptions {
  message: string;
  type?: ToastType;
  duration?: number;
}

interface ToastContextType {
  showToast: (options: ToastOptions) => void;
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<ToastType>('info');
  const [toastDuration, setToastDuration] = useState(3000);

  const showToast = useCallback(({ message, type = 'info', duration = 3000 }: ToastOptions) => {
    setToastMessage(message);
    setToastType(type);
    setToastDuration(duration);
    setToastVisible(true);
  }, []);

  const success = useCallback((message: string, duration = 3000) => {
    showToast({ message, type: 'success', duration });
  }, [showToast]);

  const error = useCallback((message: string, duration = 3000) => {
    showToast({ message, type: 'error', duration });
  }, [showToast]);

  const warning = useCallback((message: string, duration = 3000) => {
    showToast({ message, type: 'warning', duration });
  }, [showToast]);

  const info = useCallback((message: string, duration = 3000) => {
    showToast({ message, type: 'info', duration });
  }, [showToast]);

  // Register toast instance for global use
  useEffect(() => {
    setToastInstance({ showToast, success, error, warning, info });
  }, [showToast, success, error, warning, info]);

  return (
    <ToastContext.Provider value={{ showToast, success, error, warning, info }}>
      {children}
      <Toast
        visible={toastVisible}
        message={toastMessage}
        type={toastType}
        duration={toastDuration}
        onHide={() => setToastVisible(false)}
      />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextType {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
