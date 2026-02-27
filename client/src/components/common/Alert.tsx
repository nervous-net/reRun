// ABOUTME: Full-width alert box with colored left border for notifications
// ABOUTME: Supports info, warning, error, and success variants with optional dismiss

import { type CSSProperties, type ReactNode } from 'react';

type AlertVariant = 'info' | 'warning' | 'error' | 'success';

interface AlertProps {
  variant: AlertVariant;
  children: ReactNode;
  onDismiss?: () => void;
  className?: string;
}

const baseStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  padding: 'var(--space-sm) var(--space-md)',
  backgroundColor: 'var(--bg-secondary)',
  borderRadius: 'var(--border-radius)',
  fontSize: 'var(--font-size-md)',
  borderTop: 'none',
  borderRight: 'none',
  borderBottom: 'none',
  borderLeftStyle: 'solid',
  borderLeftWidth: '4px',
};

const variantStyles: Record<AlertVariant, CSSProperties> = {
  info: {
    color: 'var(--crt-cyan)',
    borderLeftColor: 'var(--crt-cyan)',
  },
  warning: {
    color: 'var(--crt-amber)',
    borderLeftColor: 'var(--crt-amber)',
  },
  error: {
    color: 'var(--crt-red)',
    borderLeftColor: 'var(--crt-red)',
  },
  success: {
    color: 'var(--crt-green)',
    borderLeftColor: 'var(--crt-green)',
  },
};

const dismissButtonStyle: CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: 'inherit',
  fontSize: 'var(--font-size-md)',
  cursor: 'pointer',
  padding: '0 0 0 var(--space-sm)',
  fontFamily: 'inherit',
  lineHeight: 1,
  opacity: 0.7,
  flexShrink: 0,
};

const contentStyle: CSSProperties = {
  flex: 1,
};

export function Alert({ variant, children, onDismiss, className }: AlertProps) {
  return (
    <div style={{ ...baseStyle, ...variantStyles[variant] }} className={className} role="alert">
      <div style={contentStyle}>{children}</div>
      {onDismiss && (
        <button style={dismissButtonStyle} onClick={onDismiss} aria-label="Dismiss">
          X
        </button>
      )}
    </div>
  );
}
