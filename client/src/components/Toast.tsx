import { useSyncExternalStore, type ReactNode } from 'react';
import Icon from './Icon';

/* Toast ringan tanpa context: modul-level store + hook subscribe. */

export type ToastKind = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function push(kind: ToastKind, message: string, durationMs = 4000) {
  const id = nextId++;
  items = [...items, { id, kind, message }];
  emit();
  window.setTimeout(() => {
    items = items.filter((t) => t.id !== id);
    emit();
  }, durationMs);
}

export const toast = {
  success: (message: string) => push('success', message),
  error: (message: string) => push('error', message, 6000),
  info: (message: string) => push('info', message),
  warning: (message: string) => push('warning', message, 5000),
  dismiss: (id: number) => {
    items = items.filter((t) => t.id !== id);
    emit();
  },
};

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

const ICON_BY_KIND: Record<ToastKind, 'check-circle' | 'alert-triangle' | 'info' | 'clock'> = {
  success: 'check-circle',
  error: 'alert-triangle',
  info: 'info',
  warning: 'clock',
};

/** Host notifikasi — pasang sekali di root aplikasi. */
export function ToastHost() {
  const list = useSyncExternalStore(subscribe, () => items, () => items);
  if (list.length === 0) return null;
  return (
    <div className="toast-host" role="status" aria-live="polite">
      {list.map((t) => (
        <div key={t.id} className={`toast toast-${t.kind}`}>
          <Icon name={ICON_BY_KIND[t.kind]} size={17} />
          <span>{t.message}</span>
          <button className="toast-close" onClick={() => toast.dismiss(t.id)} aria-label="Tutup notifikasi">
            <Icon name="x" size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

/** Field error inline dari respons 400 backend. */
export function FieldError({ message }: { message?: string }): ReactNode {
  if (!message) return null;
  return (
    <span className="field-error">
      <Icon name="alert-triangle" size={12} /> {message}
    </span>
  );
}
