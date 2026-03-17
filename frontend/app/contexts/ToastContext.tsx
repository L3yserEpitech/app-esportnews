'use client';

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { X, ExternalLink, AlertTriangle } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface Toast {
  id: string;
  message: string;
  linkUrl?: string;
  linkLabel?: string;
  duration?: number;
}

interface ToastContextValue {
  showToast: (toast: Omit<Toast, 'id'>) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}

// ─────────────────────────────────────────────────────────────────────────────
// Single toast item
// ─────────────────────────────────────────────────────────────────────────────

function ToastItem({ toast, onDismiss, position }: { toast: Toast; onDismiss: (id: string) => void; position: 'top' | 'bottom-right' }) {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    // Trigger enter animation
    const enterTimer = setTimeout(() => setIsVisible(true), 10);

    // Auto-dismiss
    const duration = toast.duration ?? 8000;
    timerRef.current = setTimeout(() => {
      handleDismiss();
    }, duration);

    return () => {
      clearTimeout(enterTimer);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleDismiss = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => onDismiss(toast.id), 300);
  }, [toast.id, onDismiss]);

  const enterClass = position === 'top'
    ? (isVisible && !isExiting ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0')
    : (isVisible && !isExiting ? 'translate-x-0 opacity-100' : 'translate-x-8 opacity-0');

  return (
    <div
      className={`
        relative w-full max-w-sm bg-[var(--color-bg-secondary)] border border-[var(--color-border-primary)]/50
        rounded-xl shadow-2xl shadow-black/30 overflow-hidden
        transition-all duration-300 ease-out ${enterClass}
      `}
    >
      {/* Top accent line */}
      <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-[#F22E62] via-[#F22E62]/60 to-transparent" />

      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-[#F22E62]/10 border border-[#F22E62]/20 flex items-center justify-center mt-0.5">
            <AlertTriangle className="w-4 h-4 text-[#F22E62]" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[var(--color-text-primary)] leading-snug">
              {toast.message}
            </p>

            {toast.linkUrl && (
              <a
                href={toast.linkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 mt-2.5 px-3 py-1.5 rounded-lg text-xs font-bold
                  bg-[#F22E62]/10 text-[#F22E62] border border-[#F22E62]/20
                  hover:bg-[#F22E62]/20 hover:border-[#F22E62]/30
                  transition-all duration-200"
              >
                <ExternalLink className="w-3 h-3" />
                {toast.linkLabel || 'Voir sur Liquipedia'}
              </a>
            )}
          </div>

          {/* Close button */}
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center
              text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]
              hover:bg-[var(--color-bg-tertiary)] transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts(prev => [...prev, { ...toast, id }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {/* Desktop: bottom-right */}
      {toasts.length > 0 && (
        <div className="fixed bottom-6 right-6 z-[9999] hidden md:flex flex-col gap-3 pointer-events-auto">
          {toasts.map(toast => (
            <ToastItem key={toast.id} toast={toast} onDismiss={dismissToast} position="bottom-right" />
          ))}
        </div>
      )}

      {/* Mobile: top */}
      {toasts.length > 0 && (
        <div className="fixed top-4 left-4 right-4 z-[9999] flex md:hidden flex-col gap-3 pointer-events-auto">
          {toasts.map(toast => (
            <ToastItem key={toast.id} toast={toast} onDismiss={dismissToast} position="top" />
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
}
