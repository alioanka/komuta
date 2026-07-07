'use client';

/**
 * Portal-based overlay primitives: Modal, ConfirmDialog and Drawer.
 * Dependency-free (Tailwind + createPortal). Modals go full-screen on small
 * viewports; the Drawer slides in from the right.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button, cn } from './index';
import { IconClose } from '@/components/icons';

/** Lock body scroll while an overlay is open. */
function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [active]);
}

function useEscape(active: boolean, onClose: () => void) {
  useEffect(() => {
    if (!active) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [active, onClose]);
}

/** Render children into document.body (client-only). */
function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(children, document.body);
}

/* -------------------------------------------------------------- Modal --- */
export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  /** Sticky footer (usually action buttons). */
  footer?: React.ReactNode;
  size?: 'md' | 'lg';
}

export function Modal({ open, onClose, title, subtitle, children, footer, size = 'md' }: ModalProps) {
  useBodyScrollLock(open);
  useEscape(open, onClose);
  const backdropRef = useRef<HTMLDivElement>(null);

  const onBackdrop = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === backdropRef.current) onClose();
    },
    [onClose],
  );

  if (!open) return null;

  return (
    <Portal>
      <div
        ref={backdropRef}
        onMouseDown={onBackdrop}
        className="fixed inset-0 z-[90] flex items-stretch justify-center bg-slate-900/40 backdrop-blur-[2px] sm:items-center sm:p-4"
        role="dialog"
        aria-modal="true"
      >
        <div
          className={cn(
            'animate-fade-up flex w-full flex-col bg-white shadow-card-hover',
            'h-full sm:h-auto sm:max-h-[calc(100vh-4rem)] sm:rounded-2xl',
            size === 'lg' ? 'sm:max-w-2xl' : 'sm:max-w-lg',
          )}
        >
          <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-slate-900">{title}</h2>
              {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
            </div>
            <button
              onClick={onClose}
              className="shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              aria-label="Kapat"
            >
              <IconClose width={18} height={18} />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>

          {footer && (
            <div className="flex flex-col-reverse gap-2 border-t border-slate-100 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
              {footer}
            </div>
          )}
        </div>
      </div>
    </Portal>
  );
}

/* ------------------------------------------------------ ConfirmDialog --- */
export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  /** Body text — include the entity name so the user knows what is affected. */
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
  loading?: boolean;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Onayla',
  cancelLabel = 'Vazgeç',
  tone = 'danger',
  loading,
}: ConfirmDialogProps) {
  useBodyScrollLock(open);
  useEscape(open, onClose);

  if (!open) return null;

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[95] flex items-end justify-center bg-slate-900/40 p-4 backdrop-blur-[2px] sm:items-center"
        role="alertdialog"
        aria-modal="true"
      >
        <div className="animate-fade-up w-full max-w-md rounded-2xl bg-white p-6 shadow-card-hover">
          <div className="flex items-start gap-3.5">
            <span
              className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
                tone === 'danger' ? 'bg-red-50 text-brand-danger' : 'bg-brand/10 text-brand',
              )}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <path d="M12 9v4M12 17h.01" />
              </svg>
            </span>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-slate-900">{title}</h2>
              <div className="mt-1.5 text-sm leading-relaxed text-slate-600">{message}</div>
            </div>
          </div>
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={onClose} disabled={loading}>
              {cancelLabel}
            </Button>
            <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>
              {confirmLabel}
            </Button>
          </div>
        </div>
      </div>
    </Portal>
  );
}

/* ------------------------------------------------------------- Drawer --- */
export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function Drawer({ open, onClose, title, subtitle, children, footer }: DrawerProps) {
  useBodyScrollLock(open);
  useEscape(open, onClose);

  if (!open) return null;

  return (
    <Portal>
      <div className="fixed inset-0 z-[90]" role="dialog" aria-modal="true">
        <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]" onMouseDown={onClose} />
        <div className="animate-slide-in absolute inset-y-0 right-0 flex w-full max-w-xl flex-col bg-white shadow-card-hover">
          <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-slate-900">{title}</h2>
              {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
            </div>
            <button
              onClick={onClose}
              className="shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              aria-label="Kapat"
            >
              <IconClose width={18} height={18} />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
          {footer && (
            <div className="flex flex-col-reverse gap-2 border-t border-slate-100 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
              {footer}
            </div>
          )}
        </div>
      </div>
    </Portal>
  );
}
