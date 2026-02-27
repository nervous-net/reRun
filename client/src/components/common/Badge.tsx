// ABOUTME: Small pill-shaped badge for status indicators
// ABOUTME: Variants map to CRT colors: success=green, warning=amber, danger=red, info=cyan

import { type CSSProperties, type ReactNode } from 'react';

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info';

interface BadgeProps {
  variant: BadgeVariant;
  children: ReactNode;
  className?: string;
}

const baseStyle: CSSProperties = {
  display: 'inline-block',
  fontSize: 'var(--font-size-sm)',
  padding: '1px 8px',
  borderRadius: '9999px',
  backgroundColor: 'var(--bg-primary)',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  lineHeight: 1.6,
  whiteSpace: 'nowrap',
};

const variantStyles: Record<BadgeVariant, CSSProperties> = {
  success: {
    color: 'var(--crt-green)',
    border: '1px solid var(--crt-green-dim)',
  },
  warning: {
    color: 'var(--crt-amber)',
    border: '1px solid var(--crt-amber-dim)',
  },
  danger: {
    color: 'var(--crt-red)',
    border: '1px solid var(--crt-red)',
  },
  info: {
    color: 'var(--crt-cyan)',
    border: '1px solid var(--crt-cyan)',
  },
};

export function Badge({ variant, children, className }: BadgeProps) {
  return (
    <span style={{ ...baseStyle, ...variantStyles[variant] }} className={className}>
      {children}
    </span>
  );
}
