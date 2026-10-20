/**
 * Komponen UI bersama — dipakai seluruh halaman agar tampilan & perilaku konsisten.
 */
import type { CSSProperties, ReactNode } from 'react';
import Icon, { type IconName } from './Icon';

export type Tone = 'blue' | 'violet' | 'mint' | 'amber' | 'red' | 'slate';

const TONE_VAR: Record<Tone, string> = {
  blue: 'var(--primary)',
  violet: 'var(--violet)',
  mint: 'var(--mint)',
  amber: 'var(--amber)',
  red: 'var(--danger)',
  slate: '#94a3b8',
};

/* ------------------------------- Tombol ------------------------------- */

export function Button({
  children,
  variant = 'default',
  size,
  icon,
  iconRight,
  type = 'button',
  disabled,
  onClick,
  title,
  className = '',
  style,
  autoFocus,
}: {
  children?: ReactNode;
  variant?: 'primary' | 'secondary' | 'default' | 'ghost' | 'danger' | 'link';
  size?: 'sm' | 'lg';
  icon?: IconName;
  iconRight?: IconName;
  type?: 'button' | 'submit';
  disabled?: boolean;
  onClick?: () => void;
  title?: string;
  className?: string;
  style?: CSSProperties;
  autoFocus?: boolean;
}) {
  const variantClass =
    variant === 'primary'
      ? 'btn-primary'
      : variant === 'danger'
        ? 'btn-danger'
        : variant === 'ghost'
          ? 'btn-ghost'
          : variant === 'link'
            ? 'btn-link'
            : variant === 'secondary'
              ? 'btn-secondary'
              : '';
  return (
    <button
      type={type}
      className={`btn ${variantClass} ${size ? `btn-${size}` : ''} ${className}`.trim()}
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={style}
      autoFocus={autoFocus}
    >
      {icon && <Icon name={icon} size={size === 'sm' ? 14 : 16} />}
      {children}
      {iconRight && <Icon name={iconRight} size={size === 'sm' ? 14 : 16} />}
    </button>
  );
}

export function IconButton({
  name,
  label,
  onClick,
  variant = 'ghost',
  size = 16,
  className = '',
}: {
  name: IconName;
  label: string;
  onClick?: () => void;
  variant?: 'ghost' | 'danger' | 'secondary' | 'default';
  size?: number;
  className?: string;
}) {
  const cls =
    variant === 'danger' ? 'btn-danger' : variant === 'secondary' ? 'btn-secondary' : variant === 'default' ? '' : 'btn-ghost';
  return (
    <button
      type="button"
      className={`btn btn-icon ${cls} ${className}`.trim()}
      onClick={onClick}
      title={label}
      aria-label={label}
    >
      <Icon name={name} size={size} />
    </button>
  );
}

/* -------------------------------- Kartu ------------------------------- */

export function Card({
  title,
  subtitle,
  action,
  children,
  className = '',
  style,
  bodyless,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  bodyless?: boolean;
}) {
  return (
    <section className={`card ${className}`.trim()} style={style}>
      {(title || action) && (
        <header className="card-head">
          <div>
            {typeof title === 'string' ? (
              <h2 className="card-title">
                <Icon name="layers" size={16} /> {title}
              </h2>
            ) : (
              title
            )}
            {subtitle && <p className="card-sub">{subtitle}</p>}
          </div>
          {action && <div className="row">{action}</div>}
        </header>
      )}
      {bodyless ? children : <div>{children}</div>}
    </section>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
  eyebrow,
  breadcrumb,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
  breadcrumb?: ReactNode;
}) {
  return (
    <div className="page-head">
      <div style={{ minWidth: 0 }}>
        {breadcrumb}
        {eyebrow}
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-sub">{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

/* -------------------------------- Pill -------------------------------- */

export function Pill({
  tone = 'slate',
  children,
  dot,
}: {
  tone?: Tone;
  children: ReactNode;
  dot?: boolean;
}) {
  return (
    <span className={`pill pill-${tone}`}>
      {dot && <span className="pill-dot" />}
      {children}
    </span>
  );
}

/* ------------------------------ Progress ----------------------------- */

export function ProgressBar({
  value,
  tone = 'blue',
  width,
}: {
  value: number;
  tone?: Tone;
  width?: number;
}) {
  const cls = tone === 'blue' ? '' : ` ${tone}`;
  return (
    <div className={`progress${cls}`} style={width ? { width } : undefined}>
      <span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function ProgressRing({
  value,
  size = 74,
  thickness = 8,
  tone = 'blue',
  caption,
}: {
  value: number;
  size?: number;
  thickness?: number;
  tone?: Tone;
  caption?: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="ring-wrap" style={{ width: size, height: size }}>
      <svg className="ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={thickness} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={TONE_VAR[tone]}
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={`${(c * pct) / 100} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span className="ring-label" style={{ inset: 0 }}>
        <span style={{ fontSize: size / 4.4 }}>{Math.round(pct)}%</span>
        {caption && (
          <span style={{ fontSize: 10, color: 'var(--text-2)', fontWeight: 600 }}>{caption}</span>
        )}
      </span>
    </div>
  );
}

/* ------------------------------ Grafik ------------------------------- */

export interface DonutSlice {
  label: string;
  value: number;
  tone: Tone;
}

export function DonutChart({
  slices,
  size = 148,
  thickness = 20,
  centerLabel,
  centerValue,
}: {
  slices: DonutSlice[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerValue?: string;
}) {
  const total = slices.reduce((a, s) => a + s.value, 0);
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  const arcs = slices.map((s) => {
    const len = total > 0 ? (s.value / total) * c : 0;
    const arc = { ...s, len, offset };
    offset += len;
    return arc;
  });
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Distribusi status tugas">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={thickness} />
      {arcs.map((a) => (
        <circle
          key={a.label}
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={TONE_VAR[a.tone]}
          strokeWidth={thickness}
          strokeDasharray={`${a.len} ${c - a.len}`}
          strokeDashoffset={-a.offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      ))}
      {centerValue && (
        <text
          x={size / 2}
          y={size / 2 - 2}
          textAnchor="middle"
          style={{ fontSize: 22, fontWeight: 700, fill: 'var(--text)' }}
        >
          {centerValue}
        </text>
      )}
      {centerLabel && (
        <text
          x={size / 2}
          y={size / 2 + 16}
          textAnchor="middle"
          style={{ fontSize: 11, fill: 'var(--text-2)' }}
        >
          {centerLabel}
        </text>
      )}
    </svg>
  );
}

export function BarList({
  items,
}: {
  items: Array<{ label: string; value: number; meta?: string; tone?: Tone }>;
}) {
  return (
    <div className="bar-list">
      {items.map((it) => (
        <div className="bar-item" key={it.label}>
          <span className="bar-name">{it.label}</span>
          <span className="bar-meta">{it.meta ?? `${it.value}%`}</span>
          <span className="bar-track">
            <span
              className="bar-fill"
              style={{ width: `${Math.max(0, Math.min(100, it.value))}%`, background: TONE_VAR[it.tone ?? 'blue'] }}
            />
          </span>
        </div>
      ))}
    </div>
  );
}

/* -------------------------------- Form -------------------------------- */

export function Field({
  label,
  required,
  hint,
  error,
  children,
  className = '',
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`field ${className}`.trim()}>
      <label>
        {label} {required && <span className="req">*</span>}
      </label>
      {children}
      {error ? (
        <span className="field-error">
          <Icon name="alert-triangle" size={12} /> {error}
        </span>
      ) : (
        hint && <span className="field-hint">{hint}</span>
      )}
    </div>
  );
}

export function FormSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: IconName;
  children: ReactNode;
}) {
  return (
    <div className="form-section">
      <div className="form-section-title">
        {icon && <Icon name={icon} size={15} />}
        {title}
      </div>
      {children}
    </div>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Cari…',
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  ariaLabel?: string;
}) {
  return (
    <div className="search-box">
      <Icon name="search" size={15} />
      <input
        className="input"
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
      />
    </div>
  );
}

/* ------------------------------- Navigasi ---------------------------- */

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: T; label: string; icon?: IconName }>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="segmented" role="group">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={value === o.value ? 'active' : ''}
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
        >
          {o.icon && <Icon name={o.icon} size={14} />}
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: Array<{ key: T; label: string; icon?: IconName }>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          role="tab"
          aria-selected={value === t.key}
          className={`tab${value === t.key ? ' active' : ''}`}
          onClick={() => onChange(t.key)}
        >
          {t.icon && <Icon name={t.icon} size={15} />}
          {t.label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------- Avatar ------------------------------ */

export function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
  const tones: Tone[] = ['blue', 'violet', 'mint', 'amber'];
  const sum = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const tone = tones[sum % tones.length];
  return (
    <span className={`avatar ${size === 'sm' ? 'avatar-sm' : ''} ${tone}`} title={name} aria-hidden="true">
      {initials || '?'}
    </span>
  );
}
