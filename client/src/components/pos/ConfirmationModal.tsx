// ABOUTME: Confirmation modal shown before completing a rental checkout
// ABOUTME: Displays line items, tax, total to ring up in Lightspeed, and confirm/cancel actions

import { type CSSProperties } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import type { LineItem } from './TransactionPanel';

interface ConfirmationModalProps {
  lineItems: LineItem[];
  total: number;
  tax: number;
  onConfirm: () => void;
  onCancel: () => void;
  processing: boolean;
}

function formatCurrency(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function ConfirmationModal({ lineItems, total, tax, onConfirm, onCancel, processing }: ConfirmationModalProps) {
  const footer = (
    <>
      <Button variant="secondary" onClick={onCancel} disabled={processing}>
        Cancel
      </Button>
      <Button variant="primary" onClick={onConfirm} disabled={processing}>
        {processing ? 'Processing...' : 'Complete Rental'}
      </Button>
    </>
  );

  return (
    <Modal isOpen onClose={onCancel} title="Confirm Rental" footer={footer}>
      <div style={styles.content}>
        {/* Line items */}
        <div style={styles.lineItems}>
          {lineItems.map((item, index) => (
            <div key={index} style={styles.lineItem}>
              <span style={styles.lineDescription}>{item.description}</span>
              <span style={styles.lineAmount}>{formatCurrency(item.amount)}</span>
            </div>
          ))}
        </div>

        {/* Tax (hidden when zero — Lightspeed handles tax) */}
        {tax > 0 && (
          <div style={styles.taxRow}>
            <span style={styles.taxLabel}>Tax</span>
            <span style={styles.taxAmount}>{formatCurrency(tax)}</span>
          </div>
        )}

        {/* Total to ring up */}
        <div style={styles.totalDisplay}>
          <span style={styles.totalLabel}>Ring Up in Lightspeed</span>
          <span style={styles.totalAmount}>{formatCurrency(total)}</span>
        </div>
      </div>
    </Modal>
  );
}

const styles: Record<string, CSSProperties> = {
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-md)',
  },
  lineItems: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-xs)',
  },
  lineItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '4px 0',
  },
  lineDescription: {
    color: 'var(--text-primary)',
    fontSize: 'var(--font-size-md)',
  },
  lineAmount: {
    color: 'var(--text-primary)',
    fontSize: 'var(--font-size-md)',
    fontFamily: 'var(--font-mono)',
  },
  taxRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '4px 0',
    borderTop: '1px solid var(--border-color)',
  },
  taxLabel: {
    color: 'var(--text-secondary)',
    fontSize: 'var(--font-size-md)',
    textTransform: 'uppercase',
    letterSpacing: '1px',
  },
  taxAmount: {
    color: 'var(--text-secondary)',
    fontSize: 'var(--font-size-md)',
    fontFamily: 'var(--font-mono)',
  },
  totalDisplay: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    backgroundColor: 'var(--bg-primary)',
    border: '1px solid var(--crt-green)',
    borderRadius: 'var(--border-radius)',
  },
  totalLabel: {
    color: 'var(--text-secondary)',
    fontSize: 'var(--font-size-md)',
    textTransform: 'uppercase',
    letterSpacing: '1px',
  },
  totalAmount: {
    color: 'var(--crt-green)',
    fontSize: 'var(--font-size-xxl)',
    textShadow: '0 0 10px var(--accent-50)',
    fontWeight: 'bold',
  },
};
