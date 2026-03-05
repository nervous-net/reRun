// ABOUTME: Screen shown after checkout completes, displaying the reference code for Lightspeed handoff
// ABOUTME: Shows reference code in large monospace text with easy-copy selection and a Done button

import { type CSSProperties } from 'react';
import { Button } from '../common/Button';

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
    <div style={styles.container}>
      <h2 style={styles.heading}>Rental Complete</h2>

      <p style={styles.instruction}>
        Use this reference code in Lightspeed to complete the transaction.
      </p>

      <div style={styles.code}>{referenceCode}</div>

      <div style={styles.total}>{formatCurrency(total)}</div>

      <div style={styles.actions}>
        <Button variant="primary" onClick={onDone}>Done</Button>
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '32px',
    gap: '16px',
  },
  heading: {
    fontSize: 'var(--font-size-xl, 24px)',
    color: 'var(--crt-green)',
    textTransform: 'uppercase',
    letterSpacing: '2px',
    margin: 0,
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
  actions: {
    marginTop: '16px',
  },
};
