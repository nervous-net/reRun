// ABOUTME: Line items display panel for the POS transaction
// ABOUTME: Table-style layout showing item descriptions, amounts, and running totals

import { type CSSProperties } from 'react';
export interface LineItem {
  type: 'rental' | 'product' | 'fee';
  description: string;
  amount: number;
  copyId?: string;
  titleId?: string;
  productId?: string;
}

interface TransactionPanelProps {
  items: LineItem[];
  onRemoveItem: (index: number) => void;
  subtotal: number;
  tax: number;
  total: number;
}

function formatCurrency(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function typeIcon(type: LineItem['type']): string {
  switch (type) {
    case 'rental':
      return '[R]';
    case 'product':
      return '[P]';
    case 'fee':
      return '[F]';
  }
}

export function TransactionPanel({ items, onRemoveItem, subtotal, tax, total }: TransactionPanelProps) {
  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <span style={{ ...styles.headerCol, width: '32px' }}>#</span>
        <span style={{ ...styles.headerCol, flex: 1 }}>Description</span>
        <span style={{ ...styles.headerCol, width: '80px', textAlign: 'right' }}>Amount</span>
        <span style={{ ...styles.headerCol, width: '40px' }} />
      </div>

      {/* Items */}
      <div style={styles.itemsList}>
        {items.length === 0 && (
          <div style={styles.emptyState}>
            Scan items or add products to begin transaction
          </div>
        )}
        {items.map((item, index) => (
          <div
            key={index}
            style={{
              ...styles.row,
              backgroundColor: index % 2 === 1 ? 'rgba(85, 255, 255, 0.02)' : 'transparent',
            }}
          >
            <span style={{ ...styles.cell, width: '32px', color: 'var(--text-secondary)' }}>
              {typeIcon(item.type)}
            </span>
            <span style={{ ...styles.cell, flex: 1 }}>
              {item.description}
            </span>
            <span style={{ ...styles.cell, width: '80px', textAlign: 'right' }}>
              {formatCurrency(item.amount)}
            </span>
            <span style={{ ...styles.cell, width: '40px', textAlign: 'center' }}>
              <button
                onClick={() => onRemoveItem(index)}
                style={styles.removeButton}
              >
                X
              </button>
            </span>
          </div>
        ))}
      </div>

      {/* Footer totals */}
      <div style={styles.footer}>
        <div style={styles.totalRow}>
          <span style={styles.totalLabel}>Subtotal</span>
          <span style={styles.totalValue}>{formatCurrency(subtotal)}</span>
        </div>
        <div style={styles.totalRow}>
          <span style={styles.totalLabel}>Tax</span>
          <span style={styles.totalValue}>{formatCurrency(tax)}</span>
        </div>
        <div style={styles.grandTotalRow}>
          <span style={styles.grandTotalLabel}>TOTAL</span>
          <span style={styles.grandTotalValue}>{formatCurrency(total)}</span>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 0,
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--border-radius)',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    padding: '6px 8px',
    borderBottom: '1px solid var(--crt-green-dim)',
    backgroundColor: 'var(--bg-secondary)',
  },
  headerCol: {
    color: 'var(--crt-green)',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    fontSize: 'var(--font-size-sm)',
  },
  itemsList: {
    flex: 1,
    overflowY: 'auto',
    minHeight: 0,
  },
  emptyState: {
    color: 'var(--text-muted)',
    fontStyle: 'italic',
    padding: 'var(--space-lg) var(--space-md)',
    textAlign: 'center',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    padding: '4px 8px',
    borderBottom: '1px solid var(--border-color)',
  },
  cell: {
    color: 'var(--text-primary)',
    fontSize: 'var(--font-size-md)',
  },
  footer: {
    borderTop: '1px solid var(--crt-green-dim)',
    padding: '8px 12px',
    backgroundColor: 'var(--bg-secondary)',
  },
  totalRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '2px 0',
  },
  totalLabel: {
    color: 'var(--text-secondary)',
    fontSize: 'var(--font-size-sm)',
    textTransform: 'uppercase',
    letterSpacing: '1px',
  },
  totalValue: {
    color: 'var(--text-primary)',
    fontSize: 'var(--font-size-md)',
  },
  grandTotalRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '4px 0 0',
    marginTop: '4px',
    borderTop: '1px solid var(--border-color)',
  },
  grandTotalLabel: {
    color: 'var(--crt-green)',
    fontSize: 'var(--font-size-lg)',
    textTransform: 'uppercase',
    letterSpacing: '2px',
    textShadow: '0 0 10px rgba(85, 255, 255, 0.5)',
  },
  grandTotalValue: {
    color: 'var(--crt-green)',
    fontSize: 'var(--font-size-lg)',
    textShadow: '0 0 10px rgba(85, 255, 255, 0.5)',
    fontWeight: 'bold',
  },
  removeButton: {
    background: 'transparent',
    border: '1px solid var(--crt-red)',
    color: 'var(--crt-red)',
    fontFamily: 'inherit',
    fontSize: 'var(--font-size-sm)',
    padding: '0 4px',
    cursor: 'pointer',
    borderRadius: 'var(--border-radius)',
    lineHeight: 1.4,
  },
};
