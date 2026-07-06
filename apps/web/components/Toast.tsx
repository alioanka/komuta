'use client';

/**
 * Tiny dependency-free toast system. Wrap the app in <ToastProvider> and call
 * `useToast().push({ title, body, tone })` anywhere below it.
 */

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { cn } from '@/components/ui';
import { IconBell, IconCheck, IconClose } from '@/components/icons';

export type ToastTone = 'info' | 'success' | 'danger';

export interface ToastInput {
  title: string;
  body?: string;
  tone?: ToastTone;
  /** Auto-dismiss in ms (default 5000). */
  duration?: number;
}

interface ToastItem extends ToastInput {
  id: number;
}

interface ToastContextValue {
  push: (t: ToastInput) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const toneStyles: Record<ToastTone, { bar: string; icon: string }> = {
  info: { bar: 'bg-brand-accent', icon: 'text-brand-accent' },
  success: { bar: 'bg-brand-success', icon: 'text-brand-success' },
  danger: { bar: 'bg-brand-danger', icon: 'text-brand-danger' },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (input: ToastInput) => {
      const id = ++idRef.current;
      // Keep at most 4 toasts on screen.
      setToasts((list) => [...list.slice(-3), { ...input, id }]);
      const duration = input.duration ?? 5000;
      window.setTimeout(() => dismiss(id), duration);
    },
    [dismiss],
  );

  const value = useMemo<ToastContextValue>(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Viewport */}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2"
      >
        {toasts.map((t) => {
          const tone = toneStyles[t.tone ?? 'info'];
          return (
            <div
              key={t.id}
              className="animate-fade-up pointer-events-auto relative flex items-start gap-3 overflow-hidden rounded-xl border border-slate-200/80 bg-white py-3 pl-4 pr-3 shadow-card-hover"
              role="status"
            >
              <span className={cn('absolute inset-y-0 left-0 w-1', tone.bar)} />
              <span className={cn('mt-0.5 shrink-0', tone.icon)}>
                {t.tone === 'success' ? (
                  <IconCheck width={17} height={17} />
                ) : (
                  <IconBell width={17} height={17} />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-800">{t.title}</p>
                {t.body && <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{t.body}</p>}
              </div>
              <button
                onClick={() => dismiss(t.id)}
                className="shrink-0 rounded-md p-1 text-slate-300 transition-colors hover:bg-slate-50 hover:text-slate-500"
                aria-label="Kapat"
              >
                <IconClose width={14} height={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
