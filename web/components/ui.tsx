'use client';

import React, { useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Search, X } from 'lucide-react';
import { SPRING_MICRO } from '../lib/motion';

/* ── Kbd ─────────────────────────────────────────────────────────── */

export function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="kbd">{children}</kbd>;
}

/* ── Button ──────────────────────────────────────────────────────── */

type ButtonProps = {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  href?: string;
  className?: string;
  children: React.ReactNode;
  onClick?: React.MouseEventHandler<HTMLElement>;
  type?: 'button' | 'submit';
  disabled?: boolean;
  ariaLabel?: string;
  target?: string;
  rel?: string;
};

export function Button({
  variant = 'primary',
  size = 'md',
  href,
  className = '',
  children,
  onClick,
  type = 'button',
  disabled,
  ariaLabel,
  target,
  rel,
}: ButtonProps) {
  const cls = `btn btn-${variant} ${size === 'md' ? '' : `btn-${size}`} ${className}`.trim();
  if (href) {
    // internal routes use Next Link (SPA navigation + prefetch)
    if (href.startsWith('/')) {
      return (
        <Link href={href} className={cls} onClick={onClick} aria-label={ariaLabel}>
          {children}
        </Link>
      );
    }
    return (
      <a href={href} className={cls} onClick={onClick} aria-label={ariaLabel} target={target} rel={rel}>
        {children}
      </a>
    );
  }
  return (
    <button type={type} className={cls} onClick={onClick} disabled={disabled} aria-label={ariaLabel}>
      {children}
    </button>
  );
}

/* ── Card ────────────────────────────────────────────────────────── */

export function Card({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return <div className={`card ${className}`.trim()}>{children}</div>;
}

/* ── Chip ────────────────────────────────────────────────────────── */

export function Chip({
  variant = 'default',
  className = '',
  children,
}: {
  variant?: 'default' | 'iso' | 'active';
  className?: string;
  children: React.ReactNode;
}) {
  const v = variant === 'iso' ? 'chip-iso' : variant === 'active' ? 'chip-active' : '';
  return <span className={`chip ${v} ${className}`.trim()}>{children}</span>;
}

/* ── SegmentedControl ────────────────────────────────────────────── */

export type SegOption = { value: string; label: React.ReactNode; title?: string };

export function SegmentedControl({
  options,
  value,
  onChange,
  ariaLabel,
  scrollable = false,
  className = '',
}: {
  options: SegOption[];
  value: string;
  onChange: (v: string) => void;
  ariaLabel: string;
  scrollable?: boolean;
  className?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [thumb, setThumb] = useState({ x: 0, width: 0, ready: false });

  const measure = () => {
    const root = rootRef.current;
    const idx = options.findIndex((o) => o.value === value);
    const btn = idx >= 0 ? btnRefs.current[idx] : null;
    if (!root || !btn) return;
    const rr = root.getBoundingClientRect();
    const br = btn.getBoundingClientRect();
    setThumb({ x: br.left - rr.left, width: br.width, ready: true });
  };

  useLayoutEffect(measure, [value, options]);
  useLayoutEffect(() => {
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const idx = options.findIndex((o) => o.value === value);
    const next = (idx + (e.key === 'ArrowRight' ? 1 : -1) + options.length) % options.length;
    onChange(options[next].value);
    btnRefs.current[next]?.focus();
  };

  return (
    <div
      ref={rootRef}
      role="tablist"
      aria-label={ariaLabel}
      className={`seg ${scrollable ? 'seg-scrollable' : ''} ${className}`.trim()}
      onKeyDown={onKeyDown}
    >
      {thumb.ready && (
        <motion.span
          aria-hidden
          className="seg-thumb"
          initial={false}
          animate={{ x: thumb.x, width: thumb.width }}
          transition={SPRING_MICRO}
        />
      )}
      {options.map((o, i) => (
        <button
          key={o.value}
          ref={(el) => {
            btnRefs.current[i] = el;
          }}
          role="tab"
          aria-selected={o.value === value}
          title={o.title}
          className={`seg-item ${o.value === value ? 'is-active' : ''}`}
          onClick={() => onChange(o.value)}
          tabIndex={o.value === value ? 0 : -1}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ── SearchInput ─────────────────────────────────────────────────── */

export function SearchInput({
  value,
  onChange,
  placeholder,
  ariaLabel,
  kbdHint,
  id,
  autoFocus = false,
  inputRef,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  ariaLabel: string;
  kbdHint?: string;
  id?: string;
  autoFocus?: boolean;
  inputRef?: React.RefObject<HTMLInputElement>;
}) {
  return (
    <div className="search-wrap">
      <span className="search-icon" aria-hidden>
        <Search size={18} />
      </span>
      <input
        ref={inputRef}
        id={id}
        type="text"
        role="searchbox"
        autoComplete="off"
        spellCheck={false}
        className="search-input"
        placeholder={placeholder}
        aria-label={ariaLabel}
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
      />
      {value ? (
        <button className="search-clear" onClick={() => onChange('')} aria-label="Clear search">
          <X size={16} />
        </button>
      ) : kbdHint ? (
        <span className="search-kbd" aria-hidden>
          <Kbd>{kbdHint}</Kbd>
        </span>
      ) : null}
    </div>
  );
}

/* ── Skeleton ────────────────────────────────────────────────────── */

export function Skeleton({ height = 120, className = '' }: { height?: number; className?: string }) {
  return <div className={`skeleton ${className}`.trim()} style={{ minHeight: height }} aria-hidden />;
}

/* ── SectionHeading ──────────────────────────────────────────────── */

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = 'left',
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: 'left' | 'center';
}) {
  const alignCls = align === 'center' ? 'text-center mx-auto' : '';
  return (
    <div className={`max-w-prose ${alignCls}`}>
      {eyebrow && (
        <p className="mono mb-3 text-[0.72rem] font-bold uppercase tracking-[0.12em] text-primary">{eyebrow}</p>
      )}
      <h2 className="h2">{title}</h2>
      {description && <p className="body-scale mt-3 text-soft">{description}</p>}
    </div>
  );
}

/* ── EmptyState / ErrorState ─────────────────────────────────────── */

export function EmptyState({
  icon,
  title,
  hint,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      {icon && <span className="text-soft">{icon}</span>}
      <p className="text-base font-semibold text-strong">{title}</p>
      {hint && <p className="small-scale max-w-sm">{hint}</p>}
      {action}
    </div>
  );
}

export function ErrorState({
  title,
  hint,
  onRetry,
}: {
  title: string;
  hint?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="error-state" role="alert">
      <p className="text-base font-semibold text-strong">{title}</p>
      {hint && <p className="small-scale max-w-sm">{hint}</p>}
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
