// ABOUTME: Held transactions list panel for the POS screen
// ABOUTME: Fetches and displays paused transactions for recall with customer name and totals

import { type CSSProperties, useCallback, useEffect, useState } from 'react';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';

import { api } from '../../api/client';

interface HeldTransaction {
  id: string;
  customerId: string | null;
  customerName: string | null;
  itemCount: number;
  total: number;
  heldAt: string;
}

interface HeldTransactionsProps {
  isOpen: boolean;
  onClose: () => void;
  onRecall: (holdId: string) => void;
}

function formatCurrency(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatTime(isoStr: string): string {
  const d = new Date(isoStr);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}

export function HeldTransactions({ isOpen, onClose, onRecall }: HeldTransactionsProps) {
  const [held, setHeld] = useState<HeldTransaction[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchHeld = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.transactions.held();
      setHeld(Array.isArray(data) ? data : data.data ?? []);
    } catch {
      setHeld([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchHeld();
    }
  }, [isOpen, fetchHeld]);

  function handleRecall(holdId: string) {
    onRecall(holdId);
    onClose();
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Held Transactions">
      <div style={styles.content}>
        {loading && (
          <div style={styles.emptyState}>Loading held transactions...</div>
        )}
        {!loading && held.length === 0 && (
          <div style={styles.emptyState}>No held transactions</div>
        )}
        {held.map((tx) => (
          <div
            key={tx.id}
            style={styles.row}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--accent-06)';
              e.currentTarget.style.textShadow = 'var(--glow-green)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.textShadow = 'none';
            }}
          >
            <div style={styles.rowInfo}>
              <span style={styles.customerName}>
                {tx.customerName ?? 'Walk-in'}
              </span>
              <span style={styles.meta}>
                {tx.itemCount} item{tx.itemCount !== 1 ? 's' : ''} | {formatCurrency(tx.total)} | {formatTime(tx.heldAt)}
              </span>
            </div>
            <Button variant="primary" onClick={() => handleRecall(tx.id)}>
              Recall
            </Button>
          </div>
        ))}
      </div>
    </Modal>
  );
}

const styles: Record<string, CSSProperties> = {
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-xs)',
  },
  emptyState: {
    color: 'var(--text-muted)',
    fontStyle: 'italic',
    padding: 'var(--space-lg) var(--space-md)',
    textAlign: 'center',
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 12px',
    borderBottom: '1px solid var(--border-color)',
    transition: 'background-color 0.1s ease',
  },
  rowInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  customerName: {
    color: 'var(--text-primary)',
    fontSize: 'var(--font-size-md)',
  },
  meta: {
    color: 'var(--text-secondary)',
    fontSize: 'var(--font-size-sm)',
  },
};
