import { useEffect, type ReactNode } from 'react';
import Icon from './Icon';
import { Button } from './ui';

/**
 * Dialog konfirmasi konsisten (pengganti window.confirm bawaan browser).
 * Render terkontrol: <ConfirmDialog open ... onConfirm onDismiss />
 */
export interface ConfirmOptions {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Ya, lanjutkan',
  cancelLabel = 'Batal',
  danger,
  onConfirm,
  onDismiss,
}: {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onDismiss: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onDismiss]);

  if (!open) return null;

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onDismiss();
      }}
    >
      <div className="modal modal-sm" role="alertdialog" aria-modal="true" aria-label={title}>
        <div className={`confirm-icon${danger ? ' danger' : ''}`}>
          <Icon name={danger ? 'alert-triangle' : 'info'} size={22} />
        </div>
        <h3>{title}</h3>
        <div className="confirm-msg">{message}</div>
        <div className="form-actions">
          <Button variant="default" onClick={onDismiss}>
            {cancelLabel}
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} autoFocus>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
