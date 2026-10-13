import React from 'react';
import { CheckCircle, AlertCircle, Info } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  text: string;
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="toast"
          onClick={() => onDismiss(toast.id)}
          style={{ cursor: 'pointer' }}
        >
          {toast.type === 'success' && <CheckCircle size={16} color="#34d399" />}
          {toast.type === 'error' && <AlertCircle size={16} color="#f87171" />}
          {toast.type === 'info' && <Info size={16} color="#60a5fa" />}
          <span>{toast.text}</span>
        </div>
      ))}
    </div>
  );
};
