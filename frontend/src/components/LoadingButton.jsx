import React, { useRef } from 'react';

export const LoadingButton = ({
  children,
  loading = false,
  disabled = false,
  loadingText,
  onClick,
  className = '',
  type = 'button',
  ...props
}) => {
  const isClickingRef = useRef(false);

  const handleClick = (e) => {
    if (loading || disabled) {
      e.preventDefault();
      return;
    }
    if (isClickingRef.current) {
      e.preventDefault();
      return;
    }

    isClickingRef.current = true;
    if (onClick) {
      try {
        const result = onClick(e);
        if (result && typeof result.then === 'function') {
          result.finally(() => {
            isClickingRef.current = false;
          });
        } else {
          // Release guard on next tick for synchronous clicks
          setTimeout(() => {
            isClickingRef.current = false;
          }, 500);
        }
      } catch (err) {
        isClickingRef.current = false;
        throw err;
      }
    } else {
      setTimeout(() => {
        isClickingRef.current = false;
      }, 500);
    }
  };

  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={handleClick}
      className={`relative inline-flex items-center justify-center ${className}`}
      {...props}
    >
      {loading && (
        <svg
          className="animate-spin -ml-1 mr-2 h-4 w-4 text-current"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}
      {loading ? (loadingText || children) : children}
    </button>
  );
};

export default LoadingButton;
