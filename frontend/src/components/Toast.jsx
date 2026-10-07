import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { toastBus } from '../utils/toastBus';

const ToastContext = createContext(null);

const ICONS = {
  error: (
    <svg className="w-5 h-5 flex-shrink-0 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  warning: (
    <svg className="w-5 h-5 flex-shrink-0 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  success: (
    <svg className="w-5 h-5 flex-shrink-0 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  info: (
    <svg className="w-5 h-5 flex-shrink-0 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
};

const STYLES = {
  error: 'bg-red-50 border-red-400 text-red-900',
  warning: 'bg-amber-50 border-amber-400 text-amber-900',
  success: 'bg-green-50 border-green-400 text-green-900',
  info: 'bg-blue-50 border-blue-400 text-blue-900'
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const recentMessagesRef = useRef(new Map());

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(({ type = 'info', message, duration }) => {
    if (!message) return;

    const now = Date.now();
    const lastSeen = recentMessagesRef.current.get(message);
    if (lastSeen && now - lastSeen < 3000) {
      return;
    }
    recentMessagesRef.current.set(message, now);

    const id = `${now}-${Math.random().toString(36).slice(2, 11)}`;
    const finalDuration = duration !== undefined 
      ? duration 
      : type === 'error' 
        ? 8000 
        : 3000;

    const newToast = { id, type, message, duration: finalDuration };

    setToasts((prev) => {
      const updated = [...prev, newToast];
      if (updated.length > 3) {
        return updated.slice(updated.length - 3);
      }
      return updated;
    });

    if (finalDuration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, finalDuration);
    }
  }, [removeToast]);

  useEffect(() => {
    const unsubscribe = toastBus.subscribe((payload) => {
      addToast(payload);
    });
    return unsubscribe;
  }, [addToast]);

  const toastMethods = {
    error: (msg, opts) => addToast({ type: 'error', message: msg, ...opts }),
    success: (msg, opts) => addToast({ type: 'success', message: msg, ...opts }),
    warning: (msg, opts) => addToast({ type: 'warning', message: msg, ...opts }),
    info: (msg, opts) => addToast({ type: 'info', message: msg, ...opts }),
    addToast
  };

  return (
    <ToastContext.Provider value={toastMethods}>
      {children}
      <div
        className="fixed top-4 left-1/2 -translate-x-1/2 md:translate-x-0 md:left-auto md:right-4 z-[10000] flex flex-col gap-2 w-full max-w-sm px-4 pointer-events-none"
      >
        {toasts.map((toast) => {
          const isError = toast.type === 'error';
          return (
            <div
              key={toast.id}
              role={isError ? 'alert' : 'status'}
              aria-live={isError ? 'assertive' : 'polite'}
              className={`pointer-events-auto animate-[toast-in_220ms_ease-out] flex items-start p-3.5 rounded-lg border shadow-lg ${
                STYLES[toast.type] || STYLES.info
              }`}
            >
              <div className="mr-3 mt-0.5">
                {ICONS[toast.type] || ICONS.info}
              </div>
              <div className="flex-1 text-sm font-medium leading-5 break-words whitespace-pre-line">
                {toast.message}
              </div>
              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                className="ml-3 inline-flex text-gray-400 hover:text-gray-700 focus:outline-none p-1 rounded-md"
                aria-label="Close"
              >
                <span className="sr-only">Close</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    return {
      error: (msg, opts) => toastBus.emit('error', msg, opts),
      success: (msg, opts) => toastBus.emit('success', msg, opts),
      warning: (msg, opts) => toastBus.emit('warning', msg, opts),
      info: (msg, opts) => toastBus.emit('info', msg, opts),
      addToast: (payload) => toastBus.emit(payload.type || 'info', payload.message, payload)
    };
  }
  return context;
};

export default ToastProvider;
