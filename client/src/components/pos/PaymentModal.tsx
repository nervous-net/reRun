// ABOUTME: Payment dialog for completing POS transactions
// ABOUTME: Supports cash (with change calculation), credit card, and account balance payment methods

import { type CSSProperties, useState } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Alert } from '../common/Alert';
import { api } from '../../api/client';
import type { LineItem } from './TransactionPanel';

interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  balance: number;
}

interface PaymentModalProps {
  total: number;
  customer: Customer | null;
  lineItems: LineItem[];
  onComplete: (transaction: any) => void;
  onCancel: () => void;
}

type PaymentMethod = 'cash' | 'credit' | 'account';

function formatCurrency(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function PaymentModal({ total, customer, lineItems, onComplete, onCancel }: PaymentModalProps) {
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [cashTendered, setCashTendered] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tenderedCents = Math.round(parseFloat(cashTendered || '0') * 100);
  const changeDue = tenderedCents - total;
  const canCompleteCash = tenderedCents >= total;
  const canCompleteAccount = customer !== null && customer.balance >= total;

  async function handleComplete() {
    setProcessing(true);
    setError(null);
    try {
      // Checkout rental copies first (creates rental records with due dates)
      const rentalItems = lineItems.filter((item) => item.type === 'rental' && item.copyId && item.pricingRuleId);
      for (const item of rentalItems) {
        await api.rentals.checkout({
          customerId: customer!.id,
          copyId: item.copyId!,
          pricingRuleId: item.pricingRuleId!,
        });
      }

      // Determine transaction type from items
      const hasRentals = lineItems.some((i) => i.type === 'rental');
      const hasProducts = lineItems.some((i) => i.type === 'product');
      const txnType = hasRentals && hasProducts ? 'mixed' : hasRentals ? 'rental' : hasProducts ? 'sale' : 'fee';

      const transaction = await api.transactions.create({
        customerId: customer?.id ?? null,
        type: txnType,
        paymentMethod: method,
        items: lineItems.map((item) => ({
          type: item.type,
          description: item.description,
          amount: item.amount,
          copyId: item.copyId ?? null,
          productId: item.productId ?? null,
        })),
        amountTendered: method === 'cash' ? tenderedCents : undefined,
      });
      onComplete(transaction);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed');
    } finally {
      setProcessing(false);
    }
  }

  const isCompleteDisabled =
    processing ||
    (method === 'cash' && !canCompleteCash) ||
    (method === 'account' && !canCompleteAccount);

  const footer = (
    <>
      <Button variant="secondary" onClick={onCancel} disabled={processing}>
        Cancel
      </Button>
      <Button variant="primary" onClick={handleComplete} disabled={isCompleteDisabled}>
        {processing ? 'Processing...' : 'Complete Payment'}
      </Button>
    </>
  );

  return (
    <Modal isOpen onClose={onCancel} title="Payment" footer={footer}>
      <div style={styles.content}>
        {/* Total display */}
        <div style={styles.totalDisplay}>
          <span style={styles.totalLabel}>Total Due</span>
          <span style={styles.totalAmount}>{formatCurrency(total)}</span>
        </div>

        {error && (
          <Alert variant="error" onDismiss={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Payment method selector */}
        <div style={styles.methodGroup}>
          <span style={styles.sectionLabel}>Payment Method</span>
          <div style={styles.methodButtons}>
            {(['cash', 'credit', 'account'] as PaymentMethod[]).map((m) => (
              <Button
                key={m}
                variant={method === m ? 'primary' : 'secondary'}
                onClick={() => setMethod(m)}
              >
                {m === 'cash' ? 'Cash' : m === 'credit' ? 'Credit Card' : 'Account'}
              </Button>
            ))}
          </div>
        </div>

        {/* Cash panel */}
        {method === 'cash' && (
          <div style={styles.methodPanel}>
            <Input
              label="Amount Tendered ($)"
              type="number"
              step="0.01"
              min="0"
              value={cashTendered}
              onChange={(e) => setCashTendered(e.target.value)}
              placeholder="0.00"
              autoFocus
            />
            {canCompleteCash && (
              <div style={styles.changeDisplay}>
                <span style={styles.changeLabel}>Change Due</span>
                <span style={styles.changeAmount}>{formatCurrency(changeDue)}</span>
              </div>
            )}
            {!canCompleteCash && cashTendered.length > 0 && (
              <Alert variant="warning">
                Insufficient amount. Need {formatCurrency(total - tenderedCents)} more.
              </Alert>
            )}
          </div>
        )}

        {/* Credit panel */}
        {method === 'credit' && (
          <div style={styles.methodPanel}>
            <Alert variant="info">
              Process credit card on terminal, then confirm payment.
            </Alert>
          </div>
        )}

        {/* Account panel */}
        {method === 'account' && (
          <div style={styles.methodPanel}>
            {customer ? (
              <>
                <div style={styles.accountInfo}>
                  <span style={styles.accountLabel}>Account Balance</span>
                  <span
                    style={{
                      ...styles.accountBalance,
                      color: customer.balance >= total ? 'var(--crt-green)' : 'var(--crt-red)',
                    }}
                  >
                    {formatCurrency(customer.balance)}
                  </span>
                </div>
                {!canCompleteAccount && (
                  <Alert variant="error">
                    Insufficient account balance. Need {formatCurrency(total - customer.balance)} more.
                  </Alert>
                )}
                {canCompleteAccount && (
                  <div style={styles.accountInfo}>
                    <span style={styles.accountLabel}>Balance After</span>
                    <span style={styles.accountBalance}>
                      {formatCurrency(customer.balance - total)}
                    </span>
                  </div>
                )}
              </>
            ) : (
              <Alert variant="error">
                No customer selected. Scan a member card to use account payment.
              </Alert>
            )}
          </div>
        )}
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
  methodGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-sm)',
  },
  sectionLabel: {
    color: 'var(--text-secondary)',
    fontSize: 'var(--font-size-sm)',
    textTransform: 'uppercase',
    letterSpacing: '1px',
  },
  methodButtons: {
    display: 'flex',
    gap: 'var(--space-sm)',
  },
  methodPanel: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-sm)',
    padding: '12px',
    backgroundColor: 'var(--bg-primary)',
    borderRadius: 'var(--border-radius)',
    border: '1px solid var(--border-color)',
  },
  changeDisplay: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 0',
    borderTop: '1px solid var(--border-color)',
    marginTop: '4px',
  },
  changeLabel: {
    color: 'var(--crt-amber)',
    fontSize: 'var(--font-size-md)',
    textTransform: 'uppercase',
    letterSpacing: '1px',
  },
  changeAmount: {
    color: 'var(--crt-amber)',
    fontSize: 'var(--font-size-xl)',
    textShadow: 'var(--glow-amber)',
    fontWeight: 'bold',
  },
  accountInfo: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '4px 0',
  },
  accountLabel: {
    color: 'var(--text-secondary)',
    fontSize: 'var(--font-size-md)',
    textTransform: 'uppercase',
    letterSpacing: '1px',
  },
  accountBalance: {
    fontSize: 'var(--font-size-lg)',
    fontWeight: 'bold',
  },
};
