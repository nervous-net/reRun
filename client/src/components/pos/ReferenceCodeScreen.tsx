// ABOUTME: Screen shown after checkout completes, displaying the reference code for Lightspeed handoff
// ABOUTME: Shows reference code in large monospace text with easy-copy selection and a Done button

import { type CSSProperties } from 'react';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';

interface ReferenceCodeScreenProps {
  referenceCode: string;
  total: number;
  onDone: () => void;
}

function formatCurrency(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function ReferenceCodeScreen({ referenceCode, total, onDone }: ReferenceCodeScreenProps) {
  return (
    <Modal
      isOpen={true}
      onClose={onDone}
      title="Transaction Completed"
      footer={<Button variant="primary" onClick={onDone}>Done</Button>}
    >
      <div style={styles.body}>
        <p style={styles.instruction}>
          Use this reference code in Lightspeed to complete the transaction.
        </p>

        <div style={styles.code}>{referenceCode}</div>

        <div style={styles.total}>{formatCurrency(total)}</div>
      </div>
    </Modal>
  );
}

const styles: Record<string, CSSProperties> = {
  body: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '16px',
  },
  instruction: {
    color: 'var(--text-secondary)',
    fontSize: 'var(--font-size-md)',
    textAlign: 'center',
    margin: 0,
  },
  code: {
    fontFamily: 'var(--font-mono)',
    fontSize: '48px',
    color: 'var(--crt-green-bright, var(--crt-green))',
    letterSpacing: '4px',
    userSelect: 'all',
    padding: '16px 32px',
    border: '1px solid var(--crt-green)',
    borderRadius: 'var(--border-radius)',
    textAlign: 'center',
  },
  total: {
    fontSize: 'var(--font-size-lg, 18px)',
    color: 'var(--text-primary)',
  },
};
