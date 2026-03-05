// ABOUTME: Data table component with CRT-styled rows and green header
// ABOUTME: Supports column definitions, row click handlers, and empty state

import { type CSSProperties, type ReactNode } from 'react';

interface Column {
  key: string;
  label: string;
  width?: string;
}

interface TableProps {
  columns: Column[];
  data: Record<string, ReactNode>[];
  onRowClick?: (row: Record<string, ReactNode>, index: number) => void;
  emptyMessage?: string;
  className?: string;
  caption?: string;
}

const tableStyle: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 'var(--font-size-md)',
};

const thStyle: CSSProperties = {
  color: 'var(--crt-green)',
  textTransform: 'uppercase',
  letterSpacing: '1px',
  fontSize: 'var(--font-size-sm)',
  textAlign: 'left',
  padding: '4px 8px',
  borderBottom: '1px solid var(--crt-green-dim)',
  whiteSpace: 'nowrap',
};

const tdStyle: CSSProperties = {
  color: 'var(--text-primary)',
  padding: '4px 8px',
  borderBottom: '1px solid var(--border-color)',
};

const clickableRowStyle: CSSProperties = {
  cursor: 'pointer',
};

const emptyStyle: CSSProperties = {
  color: 'var(--text-muted)',
  textAlign: 'center',
  padding: 'var(--space-lg) var(--space-md)',
  fontStyle: 'italic',
};

function getRowStyle(index: number, clickable: boolean): CSSProperties {
  return {
    backgroundColor: index % 2 === 1 ? 'var(--accent-02)' : 'transparent',
    transition: 'background-color 0.1s ease',
    ...(clickable ? clickableRowStyle : {}),
  };
}

export function Table({ columns, data, onRowClick, emptyMessage = 'No data', className, caption }: TableProps) {
  const handleRowMouseEnter = (e: React.MouseEvent<HTMLTableRowElement>) => {
    if (onRowClick) {
      e.currentTarget.style.backgroundColor = 'var(--accent-06)';
    }
  };

  const handleRowMouseLeave = (e: React.MouseEvent<HTMLTableRowElement>, index: number) => {
    e.currentTarget.style.backgroundColor =
      index % 2 === 1 ? 'var(--accent-02)' : 'transparent';
  };

  const handleRowFocus = (e: React.FocusEvent<HTMLTableRowElement>) => {
    e.currentTarget.style.backgroundColor = 'var(--accent-06)';
  };

  const handleRowBlur = (e: React.FocusEvent<HTMLTableRowElement>, index: number) => {
    e.currentTarget.style.backgroundColor =
      index % 2 === 1 ? 'var(--accent-02)' : 'transparent';
  };

  const handleRowKeyDown = (
    e: React.KeyboardEvent<HTMLTableRowElement>,
    row: Record<string, ReactNode>,
    index: number
  ) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onRowClick?.(row, index);
    }
  };

  return (
    <table style={tableStyle} className={className}>
      {caption && <caption className="sr-only">{caption}</caption>}
      <thead>
        <tr>
          {columns.map((col) => (
            <th key={col.key} style={{ ...thStyle, width: col.width }} scope="col">
              {col.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.length === 0 ? (
          <tr>
            <td style={emptyStyle} colSpan={columns.length}>
              {emptyMessage}
            </td>
          </tr>
        ) : (
          data.map((row, index) => (
            <tr
              key={index}
              style={getRowStyle(index, !!onRowClick)}
              onClick={onRowClick ? () => onRowClick(row, index) : undefined}
              onMouseEnter={handleRowMouseEnter}
              onMouseLeave={(e) => handleRowMouseLeave(e, index)}
              {...(onRowClick
                ? {
                    tabIndex: 0,
                    role: 'button' as const,
                    onKeyDown: (e: React.KeyboardEvent<HTMLTableRowElement>) =>
                      handleRowKeyDown(e, row, index),
                    onFocus: handleRowFocus,
                    onBlur: (e: React.FocusEvent<HTMLTableRowElement>) =>
                      handleRowBlur(e, index),
                  }
                : {})}
            >
              {columns.map((col) => (
                <td key={col.key} style={tdStyle}>
                  {row[col.key]}
                </td>
              ))}
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
