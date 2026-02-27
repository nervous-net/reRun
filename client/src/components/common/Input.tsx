// ABOUTME: Text input component styled for the CRT theme
// ABOUTME: Supports label, focus glow, and standard input props

import { type CSSProperties, type InputHTMLAttributes } from 'react';

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'style'> {
  label?: string;
  className?: string;
}

const wrapperStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-xs)',
  width: '100%',
};

const labelStyle: CSSProperties = {
  color: 'var(--text-secondary)',
  fontSize: 'var(--font-size-sm)',
  textTransform: 'uppercase',
  letterSpacing: '1px',
};

const inputStyle: CSSProperties = {
  fontFamily: 'inherit',
  fontSize: 'var(--font-size-md)',
  padding: '6px 8px',
  backgroundColor: 'var(--bg-input)',
  color: 'var(--text-primary)',
  border: '1px solid var(--border-color)',
  borderRadius: 'var(--border-radius)',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
  transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
};

const disabledInputStyle: CSSProperties = {
  opacity: 0.4,
  cursor: 'not-allowed',
};

export function Input({
  label,
  className,
  disabled,
  onFocus,
  onBlur,
  ...rest
}: InputProps) {
  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = 'var(--crt-green)';
    e.currentTarget.style.boxShadow = 'var(--glow-green)';
    onFocus?.(e);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = 'var(--border-color)';
    e.currentTarget.style.boxShadow = 'none';
    onBlur?.(e);
  };

  return (
    <div style={wrapperStyle} className={className}>
      {label && <label style={labelStyle}>{label}</label>}
      <input
        style={{
          ...inputStyle,
          ...(disabled ? disabledInputStyle : {}),
        }}
        disabled={disabled}
        onFocus={handleFocus}
        onBlur={handleBlur}
        {...rest}
      />
    </div>
  );
}
