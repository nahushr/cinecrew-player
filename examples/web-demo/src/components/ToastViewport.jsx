import React from 'react';

export function ToastViewport({ toast, onDismiss }) {
  if (!toast) return null;
  const isError = toast.variant === 'error';
  return (
    <div className={`demo-toast${isError ? ' demo-toast--error' : ''}`} role={isError ? 'alert' : 'status'} aria-live={isError ? 'assertive' : 'polite'}>
      <span className="demo-toast__icon" aria-hidden="true">{isError ? '!' : '✓'}</span>
      <div className="demo-toast__copy">
        <strong>{toast.title}</strong>
        <span>{toast.message}</span>
      </div>
      <button type="button" onClick={onDismiss} aria-label="Dismiss notification">×</button>
    </div>
  );
}
