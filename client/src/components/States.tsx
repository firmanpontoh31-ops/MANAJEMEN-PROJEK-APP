import type { ReactNode } from 'react';
import Icon, { type IconName } from './Icon';
import { Button } from './ui';

/** Status loading konsisten. */
export function Loading({ label = 'Memuat data…' }: { label?: string }) {
  return (
    <div className="state-block" role="status">
      <Icon name="loader" size={26} className="spin" />
      <p>{label}</p>
    </div>
  );
}

/** Placeholder tabel saat data sedang dimuat. */
export function SkeletonRows({ rows = 4 }: { rows?: number }) {
  return (
    <div style={{ padding: '4px 0' }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="skeleton skeleton-row"
          style={{ width: `${90 - i * 9}%`, opacity: 1 - i * 0.12 }}
        />
      ))}
    </div>
  );
}

/** Empty state informatif dengan aksi opsional. */
export function EmptyState({
  icon = 'inbox',
  title,
  description,
  action,
}: {
  icon?: IconName;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="state-block">
      <div className="state-icon">
        <Icon name={icon} size={24} />
      </div>
      <p className="state-title">{title}</p>
      {description && <p className="state-desc">{description}</p>}
      {action}
    </div>
  );
}

/** Error state dengan tombol coba lagi. */
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="state-block state-error" role="alert">
      <div className="state-icon state-icon-error">
        <Icon name="alert-triangle" size={24} />
      </div>
      <p className="state-title">Terjadi kesalahan</p>
      <p className="state-desc">{message}</p>
      {onRetry && (
        <Button icon="refresh" onClick={onRetry}>
          Coba lagi
        </Button>
      )}
    </div>
  );
}
