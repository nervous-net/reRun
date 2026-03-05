// ABOUTME: Reusable button component with CRT-themed variants
// ABOUTME: Supports primary, secondary, danger, and ghost styles with glow effects

import { type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'style'> {
  variant?: ButtonVariant;
  children: ReactNode;
  className?: string;
}

const baseStyle: CSSProperties = {
  fontFamily: 'inherit',
  fontSize: 'var(--font-size-md)',
  padding: '4px 12px',
  background: 'transparent',
  cursor: 'pointer',
  textTransform: 'uppercase',
  letterSpacing: '1px',
  borderRadius: 'var(--border-radius)',
  transition: 'box-shadow 0.15s ease, border-color 0.15s ease, color 0.15s ease',
  lineHeight: 1.4,
};

const variantStyles: Record<ButtonVariant, CSSProperties> = {
  primary: {
    color: 'var(--crt-green)',
    border: '1px solid var(--crt-green)',
  },
  secondary: {
    color: 'var(--crt-green-dim)',
    border: '1px solid var(--crt-green-dim)',
  },
  danger: {
    color: 'var(--crt-red)',
    border: '1px solid var(--crt-red)',
  },
  ghost: {
    color: 'var(--crt-green-dim)',
    border: '1px solid transparent',
  },
};

const disabledStyle: CSSProperties = {
  opacity: 0.4,
  cursor: 'not-allowed',
};

export function Button({
  variant = 'primary',
  children,
  className,
  disabled,
  onMouseEnter,
  onMouseLeave,
  onFocus: onFocusProp,
  onBlur: onBlurProp,
  ...rest
}: ButtonProps) {
  const applyGlow = (target: HTMLButtonElement) => {
    if (variant === 'primary') {
      target.style.boxShadow = 'var(--glow-green)';
      target.style.borderColor = 'var(--crt-green-bright)';
      target.style.color = 'var(--crt-green-bright)';
    } else if (variant === 'secondary') {
      target.style.boxShadow = '0 0 8px var(--accent-15)';
      target.style.color = 'var(--crt-green)';
    } else if (variant === 'danger') {
      target.style.boxShadow = 'var(--glow-red)';
      target.style.borderColor = 'var(--crt-red)';
      target.style.color = 'var(--crt-red)';
    } else if (variant === 'ghost') {
      target.style.color = 'var(--crt-green)';
    }
  };

  const resetGlow = (target: HTMLButtonElement) => {
    const vs = variantStyles[variant];
    target.style.boxShadow = '';
    target.style.borderColor = (vs.border ? vs.border.toString().replace(/^1px solid /, '') : '');
    target.style.color = (vs.color as string) || '';
  };

  const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled) return;
    applyGlow(e.currentTarget);
    onMouseEnter?.(e);
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
    resetGlow(e.currentTarget);
    onMouseLeave?.(e);
  };

  const handleFocus = (e: React.FocusEvent<HTMLButtonElement>) => {
    if (disabled) return;
    applyGlow(e.currentTarget);
    onFocusProp?.(e);
  };

  const handleBlur = (e: React.FocusEvent<HTMLButtonElement>) => {
    resetGlow(e.currentTarget);
    onBlurProp?.(e);
  };

  const style: CSSProperties = {
    ...baseStyle,
    ...variantStyles[variant],
    ...(disabled ? disabledStyle : {}),
  };

  return (
    <button
      className={className}
      style={style}
      disabled={disabled}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleFocus}
      onBlur={handleBlur}
      {...rest}
    >
      {children}
    </button>
  );
}
