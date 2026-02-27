// ABOUTME: Printable receipt component for completed POS transactions
// ABOUTME: Monospace layout styled for @media print with store header, line items, and totals

import { type CSSProperties } from 'react';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';

interface ReceiptItem {
  description: string;
  amount: number;
}

interface ReceiptTransaction {
  id: string;
  date: string;
  customerName: string | null;
  paymentMethod: string;
  items: ReceiptItem[];
  subtotal: number;
  tax: number;
  total: number;
  cashTendered?: number;
  changeDue?: number;
}

interface ReceiptProps {
  transaction: ReceiptTransaction;
  isOpen: boolean;
  onClose: () => void;
}

function formatCurrency(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(isoStr: string): string {
  const d = new Date(isoStr);
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export function Receipt({ transaction, isOpen, onClose }: ReceiptProps) {
  function handlePrint() {
    window.print();
  }

  const footer = (
    <>
      <Button variant="secondary" onClick={onClose}>
        Close
      </Button>
      <Button variant="primary" onClick={handlePrint}>
        Print Receipt
      </Button>
    </>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Receipt" footer={footer}>
      <div style={styles.receipt} className="pos-receipt">
        {/* Store Header */}
        <div style={styles.header}>
          <div style={styles.storeName}>reRun Video</div>
          <div style={styles.storeTagline}>Your Neighborhood Video Store</div>
          <div style={styles.separator}>{'='.repeat(40)}</div>
        </div>

        {/* Transaction Info */}
        <div style={styles.info}>
          <div>TX# {transaction.id}</div>
          <div>{formatDate(transaction.date)}</div>
          {transaction.customerName && (
            <div>Customer: {transaction.customerName}</div>
          )}
        </div>

        <div style={styles.separator}>{'-'.repeat(40)}</div>

        {/* Line Items */}
        <div style={styles.items}>
          {transaction.items.map((item, i) => (
            <div key={i} style={styles.itemRow}>
              <span style={styles.itemDesc}>{item.description}</span>
              <span style={styles.itemAmount}>{formatCurrency(item.amount)}</span>
            </div>
          ))}
        </div>

        <div style={styles.separator}>{'-'.repeat(40)}</div>

        {/* Totals */}
        <div style={styles.totals}>
          <div style={styles.totalRow}>
            <span>Subtotal</span>
            <span>{formatCurrency(transaction.subtotal)}</span>
          </div>
          <div style={styles.totalRow}>
            <span>Tax</span>
            <span>{formatCurrency(transaction.tax)}</span>
          </div>
          <div style={{ ...styles.totalRow, ...styles.grandTotal }}>
            <span>TOTAL</span>
            <span>{formatCurrency(transaction.total)}</span>
          </div>
          <div style={styles.totalRow}>
            <span>Paid ({transaction.paymentMethod})</span>
            <span>{formatCurrency(transaction.cashTendered ?? transaction.total)}</span>
          </div>
          {transaction.changeDue != null && transaction.changeDue > 0 && (
            <div style={styles.totalRow}>
              <span>Change</span>
              <span>{formatCurrency(transaction.changeDue)}</span>
            </div>
          )}
        </div>

        <div style={styles.separator}>{'='.repeat(40)}</div>

        {/* Footer */}
        <div style={styles.footer}>
          <div>Thank you for choosing reRun!</div>
          <div style={styles.footerSmall}>Rentals are due back in 3 days</div>
          <div style={styles.footerSmall}>Late fees may apply</div>
        </div>

        {/* Print-only styles injected via style tag */}
        <style>{`
          @media print {
            body * { visibility: hidden !important; }
            .pos-receipt, .pos-receipt * { visibility: visible !important; }
            .pos-receipt {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 80mm !important;
              background: white !important;
              color: black !important;
              font-family: 'Courier New', monospace !important;
              font-size: 12px !important;
              padding: 8px !important;
            }
          }
        `}</style>
      </div>
    </Modal>
  );
}

const styles: Record<string, CSSProperties> = {
  receipt: {
    fontFamily: "'Courier New', monospace",
    fontSize: 'var(--font-size-sm)',
    color: 'var(--text-primary)',
    padding: '8px',
    lineHeight: 1.5,
  },
  header: {
    textAlign: 'center',
  },
  storeName: {
    fontSize: 'var(--font-size-lg)',
    fontWeight: 'bold',
    color: 'var(--crt-green)',
    letterSpacing: '2px',
    textTransform: 'uppercase',
  },
  storeTagline: {
    color: 'var(--text-secondary)',
    fontSize: 'var(--font-size-sm)',
    marginBottom: '4px',
  },
  separator: {
    color: 'var(--text-muted)',
    textAlign: 'center',
    margin: '4px 0',
    letterSpacing: '1px',
  },
  info: {
    color: 'var(--text-secondary)',
    fontSize: 'var(--font-size-sm)',
  },
  items: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  itemRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '8px',
  },
  itemDesc: {
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  itemAmount: {
    whiteSpace: 'nowrap',
  },
  totals: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  totalRow: {
    display: 'flex',
    justifyContent: 'space-between',
  },
  grandTotal: {
    fontWeight: 'bold',
    color: 'var(--crt-green)',
    fontSize: 'var(--font-size-md)',
    borderTop: '1px solid var(--border-color)',
    paddingTop: '2px',
    marginTop: '2px',
  },
  footer: {
    textAlign: 'center',
    color: 'var(--text-secondary)',
    marginTop: '4px',
  },
  footerSmall: {
    fontSize: 'var(--font-size-sm)',
    color: 'var(--text-muted)',
  },
};
