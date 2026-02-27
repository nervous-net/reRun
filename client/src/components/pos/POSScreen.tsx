// ABOUTME: Main POS checkout screen for clerks with barcode scanning and payment processing
// ABOUTME: Keyboard-friendly layout with customer bar, scan input, transaction panel, and quick actions

import { type CSSProperties, useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Alert } from '../common/Alert';
import { api } from '../../api/client';
import { CustomerBar } from './CustomerBar';
import { TransactionPanel, type LineItem } from './TransactionPanel';
import { PaymentModal } from './PaymentModal';
import { HeldTransactions } from './HeldTransactions';
import { Receipt } from './Receipt';

interface Customer {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  email: string | null;
  balance: number;
  member_barcode: string;
  date_of_birth: string | null;
}

const TAX_RATE = 0.08;

export function POSScreen() {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [scanValue, setScanValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [showHeld, setShowHeld] = useState(false);
  const [heldCount, setHeldCount] = useState(0);
  const [completedTransaction, setCompletedTransaction] = useState<any>(null);
  const scanRef = useRef<HTMLInputElement>(null);

  const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
  const tax = Math.round(subtotal * TAX_RATE);
  const total = subtotal + tax;

  // Keep scan input focused
  const focusScanInput = useCallback(() => {
    if (!showPayment && !showHeld && !completedTransaction) {
      setTimeout(() => scanRef.current?.focus(), 50);
    }
  }, [showPayment, showHeld, completedTransaction]);

  useEffect(() => {
    focusScanInput();
  }, [focusScanInput, lineItems]);

  // Fetch held transaction count
  const refreshHeldCount = useCallback(async () => {
    try {
      const data = await api.transactions.held();
      const list = Array.isArray(data) ? data : data.transactions ?? [];
      setHeldCount(list.length);
    } catch {
      // Silently ignore held count fetch errors
    }
  }, []);

  useEffect(() => {
    refreshHeldCount();
  }, [refreshHeldCount]);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // F5 to hold transaction (prevent Layout from navigating)
      if (e.key === 'F5') {
        e.preventDefault();
        e.stopPropagation();
        handleHoldTransaction();
        return;
      }

      // Enter to complete when payment modal is not open but items exist
      if (e.key === 'Enter' && !showPayment && !showHeld && lineItems.length > 0) {
        const target = e.target as HTMLElement;
        // Only trigger if focused on scan input or the scan input is empty
        if (target === scanRef.current && scanValue.trim() === '') {
          e.preventDefault();
          setShowPayment(true);
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [showPayment, showHeld, lineItems.length, scanValue]);

  async function handleScan() {
    const barcode = scanValue.trim();
    if (!barcode) return;

    setError(null);
    setScanValue('');

    try {
      // Try looking up as a copy barcode first
      const copyResult = await api.copies.lookupBarcode(barcode);
      if (copyResult && copyResult.id) {
        // It's a copy barcode - add rental line item
        if (!customer) {
          setError('Scan or search for a customer first before adding rentals.');
          focusScanInput();
          return;
        }
        const titleName = copyResult.title?.name ?? copyResult.titleName ?? 'Unknown Title';
        const format = copyResult.format ?? 'DVD';
        const rate = copyResult.pricingRate ?? copyResult.pricing?.rate ?? 399;
        setLineItems((prev) => [
          ...prev,
          {
            type: 'rental',
            description: `${titleName} (${format})`,
            amount: rate,
            copyId: copyResult.id,
            titleId: copyResult.titleId ?? copyResult.title_id,
          },
        ]);
        focusScanInput();
        return;
      }
    } catch {
      // Not a copy barcode, try as member barcode
    }

    try {
      // Try as member barcode search
      const customers = await api.customers.search(barcode);
      const customerList = Array.isArray(customers) ? customers : customers.customers ?? [];
      const match = customerList.find(
        (c: Customer) => c.member_barcode === barcode
      );
      if (match) {
        setCustomer(match);
        focusScanInput();
        return;
      }
    } catch {
      // Search failed
    }

    setError(`Barcode not recognized: ${barcode}`);
    focusScanInput();
  }

  function handleRemoveItem(index: number) {
    setLineItems((prev) => prev.filter((_, i) => i !== index));
    focusScanInput();
  }

  function handleVoidLastItem() {
    if (lineItems.length > 0) {
      setLineItems((prev) => prev.slice(0, -1));
    }
    focusScanInput();
  }

  async function handleHoldTransaction() {
    if (lineItems.length === 0) return;
    try {
      await api.transactions.hold({
        customerId: customer?.id ?? null,
        customerName: customer
          ? `${customer.first_name} ${customer.last_name}`
          : null,
        items: lineItems,
        total,
      });
      resetTransaction();
      refreshHeldCount();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to hold transaction');
    }
  }

  async function handleRecallHeld(holdId: string) {
    try {
      const recalled = await api.transactions.recall(holdId);
      if (recalled) {
        if (recalled.customerId) {
          try {
            const cust = await api.customers.get(recalled.customerId);
            setCustomer(cust);
          } catch {
            // Customer lookup failed, proceed without
          }
        }
        setLineItems(recalled.items ?? []);
      }
      refreshHeldCount();
      focusScanInput();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to recall transaction');
    }
  }

  function handleAddLateFee() {
    if (!customer) {
      setError('Select a customer first to add a late fee.');
      return;
    }
    setLineItems((prev) => [
      ...prev,
      {
        type: 'fee',
        description: 'Late Fee',
        amount: 100,
      },
    ]);
    focusScanInput();
  }

  function handlePaymentComplete(transaction: any) {
    setShowPayment(false);
    setCompletedTransaction({
      id: transaction.id ?? 'N/A',
      date: transaction.date ?? new Date().toISOString(),
      customerName: customer
        ? `${customer.first_name} ${customer.last_name}`
        : null,
      paymentMethod: transaction.paymentMethod ?? 'cash',
      items: lineItems.map((item) => ({
        description: item.description,
        amount: item.amount,
      })),
      subtotal,
      tax,
      total,
      cashTendered: transaction.cashTendered,
      changeDue: transaction.changeDue,
    });
  }

  function handleReceiptClose() {
    setCompletedTransaction(null);
    resetTransaction();
  }

  function resetTransaction() {
    setCustomer(null);
    setLineItems([]);
    setScanValue('');
    setError(null);
    focusScanInput();
  }

  return (
    <div style={styles.container}>
      {/* Customer Bar */}
      <CustomerBar
        customer={customer}
        onCustomerSelect={setCustomer}
        onClear={() => setCustomer(null)}
      />

      {/* Scan input bar */}
      <div style={styles.scanBar}>
        <span style={styles.scanLabel}>SCAN:</span>
        <div style={styles.scanInputWrapper}>
          <input
            ref={scanRef}
            style={styles.scanInput}
            value={scanValue}
            onChange={(e) => setScanValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleScan();
              }
            }}
            placeholder="Scan barcode or type item code..."
            autoFocus
          />
        </div>
        <span style={styles.itemCount}>
          {lineItems.length} item{lineItems.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Error display */}
      {error && (
        <div style={styles.errorRow}>
          <Alert variant="error" onDismiss={() => setError(null)}>
            {error}
          </Alert>
        </div>
      )}

      {/* Main body: Transaction Panel + Quick Actions */}
      <div style={styles.body}>
        {/* Transaction panel (center) */}
        <div style={styles.transactionArea}>
          <TransactionPanel
            items={lineItems}
            onRemoveItem={handleRemoveItem}
            subtotal={subtotal}
            tax={tax}
            total={total}
          />
        </div>

        {/* Quick actions sidebar (right) */}
        <div style={styles.sidebar}>
          <div style={styles.sidebarHeader}>Quick Actions</div>
          <div style={styles.sidebarActions}>
            <Button variant="secondary" onClick={handleAddLateFee}>
              Add Late Fee
            </Button>
            <Button variant="secondary" onClick={handleVoidLastItem} disabled={lineItems.length === 0}>
              Void Last Item
            </Button>
            <div style={styles.sidebarDivider} />
            <Button
              variant="secondary"
              onClick={handleHoldTransaction}
              disabled={lineItems.length === 0}
            >
              Hold [F5]
            </Button>
            <Button variant="secondary" onClick={() => setShowHeld(true)}>
              Recall Held {heldCount > 0 ? `(${heldCount})` : ''}
            </Button>
            <div style={styles.sidebarDivider} />
            <Button variant="danger" onClick={resetTransaction} disabled={lineItems.length === 0 && !customer}>
              Clear All
            </Button>
          </div>
        </div>
      </div>

      {/* Payment bar (bottom) */}
      <div style={styles.paymentBar}>
        <div style={styles.paymentTotal}>
          <span style={styles.paymentTotalLabel}>Total:</span>
          <span style={styles.paymentTotalAmount}>{`$${(total / 100).toFixed(2)}`}</span>
        </div>
        <Button
          variant="primary"
          onClick={() => setShowPayment(true)}
          disabled={lineItems.length === 0}
        >
          Complete [Enter]
        </Button>
      </div>

      {/* Payment Modal */}
      {showPayment && (
        <PaymentModal
          total={total}
          customer={customer}
          lineItems={lineItems}
          onComplete={handlePaymentComplete}
          onCancel={() => {
            setShowPayment(false);
            focusScanInput();
          }}
        />
      )}

      {/* Held Transactions Modal */}
      <HeldTransactions
        isOpen={showHeld}
        onClose={() => {
          setShowHeld(false);
          focusScanInput();
        }}
        onRecall={handleRecallHeld}
      />

      {/* Receipt Modal */}
      {completedTransaction && (
        <Receipt
          transaction={completedTransaction}
          isOpen={!!completedTransaction}
          onClose={handleReceiptClose}
        />
      )}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'hidden',
  },
  scanBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-sm)',
    padding: '8px 12px',
    borderBottom: '1px solid var(--border-color)',
    backgroundColor: 'var(--bg-primary)',
  },
  scanLabel: {
    color: 'var(--crt-green)',
    fontSize: 'var(--font-size-md)',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    whiteSpace: 'nowrap',
    textShadow: '0 0 8px rgba(85, 255, 255, 0.3)',
  },
  scanInputWrapper: {
    flex: 1,
  },
  scanInput: {
    fontFamily: 'inherit',
    fontSize: 'var(--font-size-lg)',
    padding: '8px 12px',
    backgroundColor: 'var(--bg-input)',
    color: 'var(--crt-green)',
    border: '2px solid var(--crt-green)',
    borderRadius: 'var(--border-radius)',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box' as const,
    textShadow: '0 0 5px rgba(85, 255, 255, 0.3)',
    transition: 'box-shadow 0.15s ease',
  },
  itemCount: {
    color: 'var(--text-secondary)',
    fontSize: 'var(--font-size-sm)',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    whiteSpace: 'nowrap',
  },
  errorRow: {
    padding: '4px 12px',
  },
  body: {
    display: 'flex',
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
  transactionArea: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    padding: '8px 12px',
    minHeight: 0,
  },
  sidebar: {
    width: '250px',
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    borderLeft: '1px solid var(--border-color)',
    backgroundColor: 'var(--bg-secondary)',
    padding: '8px',
  },
  sidebarHeader: {
    color: 'var(--crt-green)',
    fontSize: 'var(--font-size-sm)',
    textTransform: 'uppercase',
    letterSpacing: '2px',
    padding: '4px 8px',
    borderBottom: '1px solid var(--crt-green-dim)',
    marginBottom: '8px',
  },
  sidebarActions: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-xs)',
  },
  sidebarDivider: {
    height: '1px',
    backgroundColor: 'var(--border-color)',
    margin: '4px 0',
  },
  paymentBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 16px',
    borderTop: '2px solid var(--crt-green)',
    backgroundColor: 'var(--bg-secondary)',
    flexShrink: 0,
  },
  paymentTotal: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-sm)',
  },
  paymentTotalLabel: {
    color: 'var(--text-secondary)',
    fontSize: 'var(--font-size-md)',
    textTransform: 'uppercase',
    letterSpacing: '1px',
  },
  paymentTotalAmount: {
    color: 'var(--crt-green)',
    fontSize: 'var(--font-size-xxl)',
    textShadow: '0 0 10px rgba(85, 255, 255, 0.5)',
    fontWeight: 'bold',
    letterSpacing: '1px',
  },
};
