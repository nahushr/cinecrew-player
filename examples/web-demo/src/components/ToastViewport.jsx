import React from 'react';

export function ToastViewport({ toast, onDismiss }) {
  if (!toast) return null;
  return (
    <div className="demo-toast" role="status" aria-live="polite">
      <span className="demo-toast__icon" aria-hidden="true">✓</span>
      <div className="demo-toast__copy">
        <strong>{toast.title}</strong>
        <span>{toast.message}</span>
      </div>
      <button type="button" onClick={onDismiss} aria-label="Dismiss notification">×</button>
    </div>
  );
}
