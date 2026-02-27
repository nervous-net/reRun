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
    backgroundColor: index % 2 === 1 ? 'rgba(51, 255, 0, 0.02)' : 'transparent',
    transition: 'background-color 0.1s ease',
    ...(clickable ? clickableRowStyle : {}),
  };
}

export function Table({ columns, data, onRowClick, emptyMessage = 'No data', className }: TableProps) {
  const handleRowMouseEnter = (e: React.MouseEvent<HTMLTableRowElement>) => {
    if (onRowClick) {
      e.currentTarget.style.backgroundColor = 'rgba(51, 255, 0, 0.06)';
    }
  };

  const handleRowMouseLeave = (e: React.MouseEvent<HTMLTableRowElement>, index: number) => {
    e.currentTarget.style.backgroundColor =
      index % 2 === 1 ? 'rgba(51, 255, 0, 0.02)' : 'transparent';
  };

  return (
    <table style={tableStyle} className={className}>
      <thead>
        <tr>
          {columns.map((col) => (
            <th key={col.key} style={{ ...thStyle, width: col.width }}>
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
