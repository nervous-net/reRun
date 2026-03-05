// ABOUTME: Native select dropdown styled to match the CRT theme
// ABOUTME: Supports label, options array, and standard select props

import { type CSSProperties, type SelectHTMLAttributes, useId } from 'react';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'style'> {
  label?: string;
  options: SelectOption[];
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

const selectStyle: CSSProperties = {
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
  cursor: 'pointer',
  transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
  appearance: 'none',
  backgroundImage:
    'url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' fill=\'%2333FF00\'%3E%3Cpath d=\'M6 8L1 3h10z\'/%3E%3C/svg%3E")',
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 8px center',
  paddingRight: '28px',
};

const disabledSelectStyle: CSSProperties = {
  opacity: 0.4,
  cursor: 'not-allowed',
};

export function Select({
  label,
  options,
  className,
  disabled,
  onFocus,
  onBlur,
  ...rest
}: SelectProps) {
  const autoId = useId();
  const selectId = rest.id || autoId;

  const handleFocus = (e: React.FocusEvent<HTMLSelectElement>) => {
    e.currentTarget.style.borderColor = 'var(--crt-green)';
    e.currentTarget.style.boxShadow = 'var(--glow-green)';
    onFocus?.(e);
  };

  const handleBlur = (e: React.FocusEvent<HTMLSelectElement>) => {
    e.currentTarget.style.borderColor = 'var(--border-color)';
    e.currentTarget.style.boxShadow = 'none';
    onBlur?.(e);
  };

  return (
    <div style={wrapperStyle} className={className}>
      {label && (
        <label htmlFor={selectId} style={labelStyle}>
          {label}
        </label>
      )}
      <select
        id={selectId}
        style={{
          ...selectStyle,
          ...(disabled ? disabledSelectStyle : {}),
        }}
        disabled={disabled}
        onFocus={handleFocus}
        onBlur={handleBlur}
        {...(!label ? { 'aria-label': options.find((o) => o.value === '')?.label } : {})}
        {...rest}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
