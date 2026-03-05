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
import { ConfirmationModal } from './ConfirmationModal';
import { ReferenceCodeScreen } from './ReferenceCodeScreen';
import { HeldTransactions } from './HeldTransactions';
import { FamilyMemberPicker } from './FamilyMemberPicker';

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
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showHeld, setShowHeld] = useState(false);
  const [heldCount, setHeldCount] = useState(0);
  const [referenceCode, setReferenceCode] = useState<string | null>(null);
  const [completedTotal, setCompletedTotal] = useState<number | null>(null);
  const [pricingRules, setPricingRules] = useState<PricingRule[]>([]);
  const [pendingScan, setPendingScan] = useState<{ copyId: string; titleId: string; titleName: string; format: string } | null>(null);
  const [taxRate, setTaxRate] = useState(0.08);
  const [processing, setProcessing] = useState(false);
  const [ageWarning, setAgeWarning] = useState<{ rating: string; message: string } | null>(null);
  const [parentApproved, setParentApproved] = useState(false);
  const [familyMembers, setFamilyMembers] = useState<any[]>([]);
  const [selectedFamilyMember, setSelectedFamilyMember] = useState<any | null>(null);
  const [showFamilyPicker, setShowFamilyPicker] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [selectedSearchTitle, setSelectedSearchTitle] = useState<any | null>(null);
  const [titleCopies, setTitleCopies] = useState<any[]>([]);
  const scanRef = useRef<HTMLInputElement>(null);
  const holdRef = useRef<() => void>(() => {});

  const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
  const tax = Math.round(subtotal * taxRate);
  const total = subtotal + tax;

  // Keep scan input focused
  const focusScanInput = useCallback(() => {
    if (!showConfirmation && !showHeld && !referenceCode && !showSearchResults) {
      setTimeout(() => scanRef.current?.focus(), 50);
    }
  }, [showConfirmation, showHeld, referenceCode, showSearchResults]);

  useEffect(() => {
    focusScanInput();
  }, [focusScanInput, lineItems]);

  // Fetch family members when a customer is selected
  async function handleCustomerSelected(cust: Customer) {
    setCustomer(cust);
    setSelectedFamilyMember(null);
    try {
      const res = await api.customers.getFamily(cust.id);
      const members = res.data || [];
      setFamilyMembers(members);
      if (members.length > 0) {
        setShowFamilyPicker(true);
      }
    } catch {
      setFamilyMembers([]);
    }
  }

  function handleFamilyMemberSelect(member: any | null) {
    setSelectedFamilyMember(member);
    setShowFamilyPicker(false);
    focusScanInput();
  }

  // Fetch pricing rules on mount
  useEffect(() => {
    api.pricing.list().then((data) => {
      const rules = Array.isArray(data) ? data : data.data ?? [];
      setPricingRules(rules.filter((r: any) => r.active));
    }).catch(() => {});
  }, []);

  // Fetch tax rate from settings
  useEffect(() => {
    api.settings.list().then((data) => {
      const settings = data.data ?? data;
      if (settings?.tax_rate != null) {
        setTaxRate(Number(settings.tax_rate) / 10000);
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
        handleCustomerSelected(c);
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

      // Enter to complete when confirmation modal is not open but items exist
      if (e.key === 'Enter' && !showConfirmation && !showHeld && lineItems.length > 0) {
        const target = e.target as HTMLElement;
        // Only trigger if focused on scan input or the scan input is empty
        if (target === scanRef.current && scanValue.trim() === '') {
          e.preventDefault();
          setShowConfirmation(true);
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [showConfirmation, showHeld, lineItems.length, scanValue]);

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
        handleCustomerSelected(match);
        focusScanInput();
        return;
      }
    } catch {
      // Search failed
    }

    // Try as title name search
    try {
      const searchData = await api.search.query({ q: barcode, available: 'true', limit: '10' });
      const titles = searchData.titles ?? [];
      if (titles.length > 0) {
        setSearchResults(titles);
        setShowSearchResults(true);
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

  function dismissSearchResults() {
    setShowSearchResults(false);
    setSearchResults([]);
    setSelectedSearchTitle(null);
    setTitleCopies([]);
    focusScanInput();
  }

  async function handleSelectSearchTitle(title: any) {
    try {
      const titleData = await api.titles.get(title.id);
      const copies = (titleData.copies ?? []).filter((c: any) => c.status === 'in');
      if (copies.length === 1) {
        // Only one available copy — go straight to pricing picker
        setPendingScan({
          copyId: copies[0].id,
          titleId: title.id,
          titleName: title.name,
          format: copies[0].format,
        });
        setShowSearchResults(false);
        setSearchResults([]);
        setSelectedSearchTitle(null);
      } else if (copies.length === 0) {
        setError(`No available copies for "${title.name}"`);
        dismissSearchResults();
      } else {
        setSelectedSearchTitle(title);
        setTitleCopies(copies);
      }
    } catch {
      setError('Failed to load copies');
    }
  }

  function handleSelectCopy(copy: any) {
    setPendingScan({
      copyId: copy.id,
      titleId: selectedSearchTitle.id,
      titleName: selectedSearchTitle.name,
      format: copy.format,
    });
    setShowSearchResults(false);
    setSearchResults([]);
    setSelectedSearchTitle(null);
    setTitleCopies([]);
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

  async function handleConfirmCheckout() {
    setProcessing(true);
    setError(null);
    try {
      // Checkout rental copies first (creates rental records with due dates)
      const rentalItems = lineItems.filter((item) => item.type === 'rental' && item.copyId && item.pricingRuleId);
      for (const item of rentalItems) {
        const result = await api.rentals.checkout({
          customerId: customer!.id,
          copyId: item.copyId!,
          pricingRuleId: item.pricingRuleId!,
          parentApproved,
          familyMemberId: selectedFamilyMember?.id,
        });

        // If age restriction warning returned, show dialog and stop
        if (result.ageRestriction) {
          setAgeWarning(result.ageRestriction);
          setProcessing(false);
          return;
        }
      }

      // Determine transaction type from items
      const hasRentals = lineItems.some((i) => i.type === 'rental');
      const hasProducts = lineItems.some((i) => i.type === 'product');
      const txnType = hasRentals && hasProducts ? 'mixed' : hasRentals ? 'rental' : hasProducts ? 'sale' : 'fee';

      const transaction = await api.transactions.create({
        customerId: customer?.id ?? null,
        type: txnType,
        items: lineItems.map((item) => ({
          type: item.type,
          description: item.description,
          amount: item.amount,
          copyId: item.copyId ?? null,
          productId: item.productId ?? null,
        })),
      });

      setReferenceCode(transaction.referenceCode);
      setCompletedTotal(total);
      setShowConfirmation(false);
      setAgeWarning(null);
      setParentApproved(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Checkout failed');
    } finally {
      setProcessing(false);
    }
  }

  function handleReferenceCodeDone() {
    setReferenceCode(null);
    setCompletedTotal(null);
    resetTransaction();
  }

  function resetTransaction() {
    setCustomer(null);
    setLineItems([]);
    setScanValue('');
    setError(null);
    setFamilyMembers([]);
    setSelectedFamilyMember(null);
    setShowFamilyPicker(false);
    setSearchResults([]);
    setShowSearchResults(false);
    setSelectedSearchTitle(null);
    setTitleCopies([]);
    focusScanInput();
  }

  return (
    <div style={styles.container}>
      {/* Customer Bar */}
      <CustomerBar
        customer={customer}
        onCustomerSelect={handleCustomerSelected}
        onClear={() => {
          setCustomer(null);
          setFamilyMembers([]);
          setSelectedFamilyMember(null);
          setShowFamilyPicker(false);
        }}
        selectedFamilyMember={selectedFamilyMember}
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
            placeholder="Scan barcode or search by title..."
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
          onClick={() => setShowConfirmation(true)}
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

      {/* Family Member Picker */}
      {showFamilyPicker && customer && (
        <div style={styles.pricingOverlay} onClick={() => handleFamilyMemberSelect(null)}>
          <div style={styles.pricingPanel} onClick={(e) => e.stopPropagation()}>
            <FamilyMemberPicker
              customerName={`${customer.firstName} ${customer.lastName}`}
              familyMembers={familyMembers}
              onSelect={handleFamilyMemberSelect}
            />
          </div>
        </div>
      )}

      {/* Title Search Results Modal */}
      {showSearchResults && (
        <div style={styles.pricingOverlay} onClick={dismissSearchResults}>
          <div style={styles.searchPanel} onClick={(e) => e.stopPropagation()}>
            {!selectedSearchTitle ? (
              <>
                <div style={styles.pricingHeader}>
                  Search Results
                </div>
                <div style={styles.searchList}>
                  {searchResults.map((title) => (
                    <button
                      key={title.id}
                      style={styles.searchRow}
                      onClick={() => handleSelectSearchTitle(title)}
                      onMouseOver={(e) => {
                        (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-hover)';
                      }}
                      onMouseOut={(e) => {
                        (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                      }}
                    >
                      <div style={styles.searchTitleRow}>
                        <span style={styles.searchTitleName}>{title.name}</span>
                        {title.year && (
                          <span style={styles.searchTitleYear}>({title.year})</span>
                        )}
                        {title.rating && (
                          <span style={styles.ratingBadge}>{title.rating}</span>
                        )}
                      </div>
                      <div style={styles.searchTitleMeta}>
                        <span>{title.availableCopies} available</span>
                        {title.formats?.length > 0 && (
                          <span>{title.formats.join(', ')}</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
                <div style={{ textAlign: 'right', marginTop: 'var(--space-sm)' }}>
                  <Button variant="ghost" onClick={dismissSearchResults}>Cancel</Button>
                </div>
              </>
            ) : (
              <>
                <div style={styles.pricingHeader}>
                  {selectedSearchTitle.name} ({selectedSearchTitle.year}) — Available Copies
                </div>
                <div style={styles.searchList}>
                  {titleCopies.map((copy) => (
                    <button
                      key={copy.id}
                      style={styles.searchRow}
                      onClick={() => handleSelectCopy(copy)}
                      onMouseOver={(e) => {
                        (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-hover)';
                      }}
                      onMouseOut={(e) => {
                        (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                      }}
                    >
                      <div style={styles.searchTitleRow}>
                        <span style={styles.searchTitleName}>{copy.barcode}</span>
                        <span style={styles.ratingBadge}>{copy.format}</span>
                      </div>
                      <div style={styles.searchTitleMeta}>
                        <span>Condition: {copy.condition ?? 'Unknown'}</span>
                      </div>
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--space-sm)' }}>
                  <Button variant="ghost" onClick={() => {
                    setSelectedSearchTitle(null);
                    setTitleCopies([]);
                  }}>Back</Button>
                  <Button variant="ghost" onClick={dismissSearchResults}>Cancel</Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmation && (
        <ConfirmationModal
          lineItems={lineItems}
          total={total}
          tax={tax}
          onConfirm={handleConfirmCheckout}
          onCancel={() => {
            setShowConfirmation(false);
            setAgeWarning(null);
            setParentApproved(false);
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

      {/* Reference Code Screen */}
      {referenceCode && completedTotal !== null && (
        <ReferenceCodeScreen
          referenceCode={referenceCode}
          total={completedTotal}
          onDone={handleReferenceCodeDone}
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
  searchPanel: {
    backgroundColor: 'var(--bg-panel)',
    border: '1px solid var(--crt-green)',
    borderRadius: 'var(--border-radius)',
    padding: 'var(--space-md)',
    minWidth: '400px',
    maxWidth: '550px',
    maxHeight: '70vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 0 20px var(--accent-15)',
  },
  searchList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    overflowY: 'auto',
    flex: 1,
    minHeight: 0,
  },
  searchRow: {
    display: 'block',
    width: '100%',
    padding: '8px 10px',
    backgroundColor: 'transparent',
    border: '1px solid transparent',
    borderRadius: 'var(--border-radius)',
    cursor: 'pointer',
    textAlign: 'left',
    fontFamily: 'inherit',
    transition: 'background-color 0.1s ease',
  },
  searchTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-sm)',
    marginBottom: '2px',
  },
  searchTitleName: {
    color: 'var(--crt-green)',
    fontSize: 'var(--font-size-md)',
    textShadow: '0 0 5px var(--accent-30)',
  },
  searchTitleYear: {
    color: 'var(--text-secondary)',
    fontSize: 'var(--font-size-sm)',
  },
  ratingBadge: {
    color: 'var(--crt-amber, var(--crt-green))',
    fontSize: 'var(--font-size-xs)',
    border: '1px solid var(--crt-amber, var(--crt-green))',
    borderRadius: '3px',
    padding: '1px 5px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    whiteSpace: 'nowrap',
  },
  searchTitleMeta: {
    display: 'flex',
    gap: 'var(--space-md)',
    color: 'var(--text-secondary)',
    fontSize: 'var(--font-size-sm)',
  },
};
