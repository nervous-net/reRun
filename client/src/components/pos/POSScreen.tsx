// ABOUTME: Main POS checkout screen for clerks with barcode scanning and payment processing
// ABOUTME: Keyboard-friendly layout with customer bar, scan input, transaction panel, and quick actions

import { type CSSProperties, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
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
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
  balance: number;
  memberBarcode: string;
  birthday: string | null;
}

interface PricingRule {
  id: string;
  name: string;
  rate: number;
  durationDays: number;
}

export function POSScreen() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [scanValue, setScanValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [showHeld, setShowHeld] = useState(false);
  const [heldCount, setHeldCount] = useState(0);
  const [completedTransaction, setCompletedTransaction] = useState<any>(null);
  const [pricingRules, setPricingRules] = useState<PricingRule[]>([]);
  const [pendingScan, setPendingScan] = useState<{ copyId: string; titleId: string; titleName: string; format: string } | null>(null);
  const [taxRate, setTaxRate] = useState(0.08);
  const [storeName, setStoreName] = useState('reRun Video');
  const scanRef = useRef<HTMLInputElement>(null);
  const holdRef = useRef<() => void>(() => {});

  const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
  const tax = Math.round(subtotal * taxRate);
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

  // Fetch pricing rules on mount
  useEffect(() => {
    api.pricing.list().then((data) => {
      const rules = Array.isArray(data) ? data : data.data ?? [];
      setPricingRules(rules.filter((r: any) => r.active));
    }).catch(() => {});
  }, []);

  // Fetch tax rate and store name from settings
  useEffect(() => {
    api.settings.list().then((data) => {
      const settings = data.data ?? data;
      if (settings?.tax_rate != null) {
        setTaxRate(Number(settings.tax_rate) / 10000);
      }
      if (settings?.store_name) {
        setStoreName(settings.store_name);
      }
    }).catch((err) => {
      console.error('Failed to load settings for POS:', err);
    });
  }, []);

  // Pre-load customer from query params (e.g. from reservation click)
  useEffect(() => {
    const customerId = searchParams.get('customerId');
    if (customerId && !customer) {
      api.customers.get(customerId).then((c) => {
        setCustomer(c);
        setSearchParams({}, { replace: true });
      }).catch(() => {});
    }
  }, [searchParams, customer, setSearchParams]);

  // Fetch held transaction count
  const refreshHeldCount = useCallback(async () => {
    try {
      const data = await api.transactions.held();
      const list = Array.isArray(data) ? data : data.data ?? [];
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
        holdRef.current();
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
        if (copyResult.status !== 'in') {
          setError(`"${titleName}" is currently ${copyResult.status} and not available.`);
          focusScanInput();
          return;
        }
        // Show pricing rule picker
        setPendingScan({
          copyId: copyResult.id,
          titleId: copyResult.titleId ?? copyResult.title?.id,
          titleName,
          format,
        });
        return;
      }
    } catch {
      // Not a copy barcode, try as member barcode
    }

    try {
      // Try as member barcode search
      const custData = await api.customers.search(barcode);
      const customerList = Array.isArray(custData) ? custData : custData.data ?? [];
      const match = customerList.find(
        (c: Customer) => c.memberBarcode === barcode
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

  function handleSelectPricing(rule: PricingRule) {
    if (!pendingScan) return;
    setLineItems((prev) => [
      ...prev,
      {
        type: 'rental',
        description: `${pendingScan.titleName} (${pendingScan.format})`,
        amount: rule.rate,
        copyId: pendingScan.copyId,
        titleId: pendingScan.titleId,
        pricingRuleId: rule.id,
      },
    ]);
    setPendingScan(null);
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
          ? `${customer.firstName} ${customer.lastName}`
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

  holdRef.current = handleHoldTransaction;

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
        ? `${customer.firstName} ${customer.lastName}`
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

      {/* Pricing Rule Picker */}
      {pendingScan && (
        <div style={styles.pricingOverlay} onClick={() => setPendingScan(null)}>
          <div style={styles.pricingPanel} onClick={(e) => e.stopPropagation()}>
            <div style={styles.pricingHeader}>
              Select Rental Period — {pendingScan.titleName} ({pendingScan.format})
            </div>
            <div style={styles.pricingOptions}>
              {pricingRules.length === 0 ? (
                <div style={{ color: 'var(--text-secondary)', padding: 'var(--space-sm)', textAlign: 'center' }}>
                  No pricing rules configured
                </div>
              ) : (
                pricingRules.map((rule) => (
                  <Button key={rule.id} variant="secondary" onClick={() => handleSelectPricing(rule)}>
                    {rule.name} — ${(rule.rate / 100).toFixed(2)}
                  </Button>
                ))
              )}
            </div>
            <div style={{ textAlign: 'right', marginTop: 'var(--space-sm)' }}>
              <Button variant="ghost" onClick={() => setPendingScan(null)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}

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
          storeName={storeName}
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
    textShadow: '0 0 8px var(--accent-30)',
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
    textShadow: '0 0 5px var(--accent-30)',
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
    textShadow: '0 0 10px var(--accent-50)',
    fontWeight: 'bold',
    letterSpacing: '1px',
  },
  pricingOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'var(--overlay-60)',
    zIndex: 900,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pricingPanel: {
    backgroundColor: 'var(--bg-panel)',
    border: '1px solid var(--crt-green)',
    borderRadius: 'var(--border-radius)',
    padding: 'var(--space-md)',
    minWidth: '350px',
    maxWidth: '450px',
    boxShadow: '0 0 20px var(--accent-15)',
  },
  pricingHeader: {
    color: 'var(--crt-green)',
    fontSize: 'var(--font-size-md)',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    marginBottom: 'var(--space-md)',
    borderBottom: '1px solid var(--border-color)',
    paddingBottom: 'var(--space-sm)',
  },
  pricingOptions: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-xs)',
  },
};
