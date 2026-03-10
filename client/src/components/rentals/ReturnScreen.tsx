// ABOUTME: Main returns screen for processing video rental returns with barcode scanning
// ABOUTME: Handles return queue, late fee calculation, fee action selection, and reservation alerts

import { type CSSProperties, useCallback, useEffect, useState } from 'react';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';
import { Input } from '../common/Input';
import { Select } from '../common/Select';
import { Badge } from '../common/Badge';
import { Alert } from '../common/Alert';
import { api } from '../../api/client';
import { calculateOverdue } from '../../utils/rental';

// ─── Types ──────────────────────────────────────────────────────────

type LateFeeAction = 'pay' | 'balance' | 'forgive';

interface CopyLookup {
  id: string;
  titleId: string;
  barcode: string;
  format: string;
  condition: string;
  status: string;
  title: {
    id: string;
    name: string;
    year: number;
    genre: string | null;
    rating: string | null;
  };
}

interface ActiveRental {
  id: string;
  customerId: string;
  copyId: string;
  checkedOutAt: string;
  dueAt: string;
  status: string;
  customerFirstName?: string;
  customerLastName?: string;
  familyMemberFirstName?: string | null;
  familyMemberLastName?: string | null;
  familyMemberRelationship?: string | null;
}

interface ReturnQueueItem {
  copy: CopyLookup;
  rental: ActiveRental;
  customerName: string;
  daysOverdue: number;
  lateFee: number;
  lateFeeAction: LateFeeAction | null;
}

interface ReturnResult {
  copyBarcode: string;
  titleName: string;
  success: boolean;
  error?: string;
  reservationAlert?: string;
}

// ─── Helpers ────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

// ─── Late fee action options ────────────────────────────────────────

const LATE_FEE_OPTIONS = [
  { value: 'pay', label: 'Pay Now' },
  { value: 'balance', label: 'Add to Balance' },
  { value: 'forgive', label: 'Forgive' },
];

// ─── Component ──────────────────────────────────────────────────────

export function ReturnScreen() {
  const [barcodeInput, setBarcodeInput] = useState('');
  const [returnQueue, setReturnQueue] = useState<ReturnQueueItem[]>([]);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState<ReturnResult[] | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmProcess, setConfirmProcess] = useState(false);
  const [searchResults, setSearchResults] = useState<any[] | null>(null);
  const [selectedTitleCopies, setSelectedTitleCopies] = useState<any[] | null>(null);
  const [selectedTitleName, setSelectedTitleName] = useState<string>('');
  const [searchLoading, setSearchLoading] = useState(false);

  // Re-focus the scan input after processing results are dismissed
  const focusScanInput = useCallback(() => {
    const input = document.querySelector<HTMLInputElement>('[data-scan-input]');
    input?.focus();
  }, []);

  useEffect(() => {
    focusScanInput();
  }, [results, focusScanInput]);

  const handleScan = useCallback(async () => {
    if (scanning) return;
    const barcode = barcodeInput.trim();
    if (!barcode) return;

    setScanning(true);
    setScanError(null);
    setBarcodeInput('');

    try {
      // Check if already in queue
      if (returnQueue.some((item) => item.copy.barcode === barcode)) {
        setScanError(`Barcode ${barcode} is already in the return queue`);
        return;
      }

      // Look up the copy by barcode
      const copyData: CopyLookup = await api.copies.lookupBarcode(barcode);

      if (copyData.status !== 'out') {
        setScanError(`Copy "${copyData.title.name}" (${barcode}) is not currently rented out`);
        return;
      }

      // Find the active rental for this copy
      const activeData = await api.rentals.active();
      const activeList: ActiveRental[] = activeData.data ?? activeData ?? [];
      const rental = activeList.find((r: ActiveRental) => r.copyId === copyData.id && r.status === 'out');

      if (!rental) {
        setScanError(`No active rental found for copy ${barcode}`);
        return;
      }

      // Get customer name
      let customerName = 'Unknown Customer';
      if (rental.customerFirstName) {
        customerName = `${rental.customerFirstName} ${rental.customerLastName ?? ''}`.trim();
      } else {
        try {
          const customer = await api.customers.get(rental.customerId);
          customerName = `${customer.first_name ?? customer.firstName} ${customer.last_name ?? customer.lastName}`.trim();
        } catch {
          // Use fallback name
        }
      }
      if (rental.familyMemberFirstName) {
        const fmName = `${rental.familyMemberFirstName} ${rental.familyMemberLastName ?? ''}`.trim();
        const fmLabel = rental.familyMemberRelationship
          ? `${fmName} (${rental.familyMemberRelationship})`
          : fmName;
        customerName = `${customerName} — ${fmLabel}`;
      }

      const { daysOverdue } = calculateOverdue(rental.dueAt);

      // Estimate late fee: we don't know the per-day rate client-side,
      // so we show "overdue" status and let the server calculate the actual fee.
      // For display, we use a placeholder of $1/day (100 cents) if overdue.
      // The real fee is calculated server-side on return.
      const estimatedFeePerDay = 100;
      const lateFee = daysOverdue > 0 ? daysOverdue * estimatedFeePerDay : 0;

      const queueItem: ReturnQueueItem = {
        copy: copyData,
        rental,
        customerName,
        daysOverdue,
        lateFee,
        lateFeeAction: daysOverdue > 0 ? 'pay' : null,
      };

      setReturnQueue((prev) => [...prev, queueItem]);
    } catch (err: any) {
      // Barcode lookup failed — try as title search
      try {
        const searchData = await api.search.query({ q: barcode });
        const titleResults = searchData.titles ?? [];
        if (titleResults.length === 0) {
          setScanError(`No results found for "${barcode}"`);
        } else {
          setSearchResults(titleResults);
        }
      } catch {
        setScanError('Copy not found and search failed');
      }
    } finally {
      setScanning(false);
    }
  }, [barcodeInput, returnQueue, scanning]);

  const handleTitleSelect = useCallback(async (titleId: string, titleName: string) => {
    setSearchLoading(true);
    try {
      const data = await api.rentals.rentedCopiesForTitle(titleId);
      const copies = data.data ?? [];
      if (copies.length === 0) {
        setScanError(`No rented copies found for "${titleName}"`);
        setSearchResults(null);
      } else {
        setSelectedTitleName(titleName);
        setSelectedTitleCopies(copies);
      }
    } catch {
      setScanError('Failed to load rented copies');
      setSearchResults(null);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  const handleCopySelect = useCallback(async (copy: any) => {
    if (returnQueue.some((item) => item.copy.barcode === copy.barcode)) {
      setScanError(`${copy.barcode} is already in the return queue`);
      setSelectedTitleCopies(null);
      setSearchResults(null);
      return;
    }

    let customerName = `${copy.customerFirstName ?? ''} ${copy.customerLastName ?? ''}`.trim() || 'Unknown Customer';
    if (copy.familyMemberFirstName) {
      const fmName = `${copy.familyMemberFirstName} ${copy.familyMemberLastName ?? ''}`.trim();
      const fmLabel = copy.familyMemberRelationship
        ? `${fmName} (${copy.familyMemberRelationship})`
        : fmName;
      customerName = `${customerName} — ${fmLabel}`;
    }

    const { daysOverdue } = calculateOverdue(copy.dueAt);
    const estimatedFeePerDay = 100;
    const lateFee = daysOverdue > 0 ? daysOverdue * estimatedFeePerDay : 0;

    const queueItem: ReturnQueueItem = {
      copy: {
        id: copy.copyId,
        titleId: '',
        barcode: copy.barcode,
        format: copy.format,
        condition: '',
        status: 'out',
        title: { id: '', name: selectedTitleName, year: 0, genre: null, rating: null },
      },
      rental: {
        id: copy.rentalId,
        customerId: '',
        copyId: copy.copyId,
        checkedOutAt: copy.checkedOutAt,
        dueAt: copy.dueAt,
        status: 'out',
      },
      customerName,
      daysOverdue,
      lateFee,
      lateFeeAction: daysOverdue > 0 ? 'pay' : null,
    };

    setReturnQueue((prev) => [...prev, queueItem]);
    setSelectedTitleCopies(null);
    setSearchResults(null);
  }, [returnQueue, selectedTitleName]);

  const handleBarcodeKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleScan();
    }
  };

  const removeFromQueue = (barcode: string) => {
    setReturnQueue((prev) => prev.filter((item) => item.copy.barcode !== barcode));
  };

  const updateLateFeeAction = (barcode: string, action: LateFeeAction) => {
    setReturnQueue((prev) =>
      prev.map((item) =>
        item.copy.barcode === barcode ? { ...item, lateFeeAction: action } : item
      )
    );
  };

  const processAllReturns = async () => {
    if (returnQueue.length === 0) return;
    setProcessing(true);
    setScanError(null);

    const returnResults: ReturnResult[] = [];

    for (const item of returnQueue) {
      try {
        await api.rentals.return({
          copyId: item.copy.id,
          lateFeeAction: item.lateFeeAction ?? 'pay',
        });

        // Check for pending reservations on the returned title
        let reservationAlert: string | undefined;
        try {
          const resData = await api.reservations.list();
          const reservationList = resData.data ?? resData ?? [];
          const match = reservationList.find(
            (r: any) => r.titleId === item.copy.titleId && !r.fulfilled
          );
          if (match) {
            reservationAlert = `RESERVATION: "${item.copy.title.name}" is reserved for ${match.customerName ?? 'a customer'}`;
          }
        } catch {
          // Reservation check is non-critical
        }

        returnResults.push({
          copyBarcode: item.copy.barcode,
          titleName: item.copy.title.name,
          success: true,
          reservationAlert,
        });
      } catch (err: any) {
        returnResults.push({
          copyBarcode: item.copy.barcode,
          titleName: item.copy.title.name,
          success: false,
          error: err.message || 'Return failed',
        });
      }
    }

    setResults(returnResults);
    setReturnQueue([]);
    setProcessing(false);
  };

  const clearQueue = () => {
    setReturnQueue([]);
    setScanError(null);
  };

  const dismissResults = () => {
    setResults(null);
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.heading}>Returns</h2>

      {/* Scan input */}
      <div style={styles.scanBar}>
        <div style={styles.scanInputWrapper}>
          <Input
            placeholder="Scan barcode or search by title..."
            value={barcodeInput}
            onChange={(e) => setBarcodeInput(e.target.value)}
            onKeyDown={handleBarcodeKeyDown}
            disabled={scanning}
            autoFocus
            data-scan-input
            aria-label="Scan copy barcode to return"
          />
        </div>
        <Button variant="primary" onClick={handleScan} disabled={scanning || !barcodeInput.trim()}>
          Look Up
        </Button>
      </div>

      {/* Scan error */}
      {scanError && (
        <Alert variant="error" onDismiss={() => setScanError(null)}>
          {scanError}
        </Alert>
      )}

      {/* Results summary after processing */}
      {results && (
        <div style={styles.resultsSection}>
          <Alert variant="success" onDismiss={dismissResults}>
            <div>Processed {results.length} return{results.length !== 1 ? 's' : ''}</div>
            {results.map((r) => (
              <div key={r.copyBarcode} style={styles.resultLine}>
                {r.success ? (
                  <span style={{ color: 'var(--crt-green)' }}>
                    {r.titleName} ({r.copyBarcode}) — returned
                  </span>
                ) : (
                  <span style={{ color: 'var(--crt-red)' }}>
                    {r.titleName} ({r.copyBarcode}) — FAILED: {r.error}
                  </span>
                )}
              </div>
            ))}
          </Alert>

          {/* Reservation alerts */}
          {results
            .filter((r) => r.reservationAlert)
            .map((r) => (
              <Alert key={r.copyBarcode} variant="success">
                {r.reservationAlert}
              </Alert>
            ))}
        </div>
      )}

      {/* Return queue */}
      {returnQueue.length > 0 && (
        <div style={styles.queueSection}>
          <div style={styles.queueHeader}>
            <span style={styles.queueLabel}>
              Return Queue — {returnQueue.length} item{returnQueue.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div style={styles.queueList}>
            {returnQueue.map((item, index) => (
              <div
                key={item.copy.barcode}
                style={{
                  ...styles.queueRow,
                  backgroundColor: index % 2 === 1 ? 'var(--accent-02)' : 'transparent',
                }}
              >
                <div style={styles.queueRowMain}>
                  <div style={styles.titleInfo}>
                    <span style={styles.titleName}>{item.copy.title.name}</span>
                    <div style={styles.copyMeta}>
                      <Badge variant="info">{item.copy.format}</Badge>
                      <span style={styles.barcode}>{item.copy.barcode}</span>
                    </div>
                  </div>

                  <div style={styles.rentalInfo}>
                    <span style={styles.customerName}>{item.customerName}</span>
                    <span style={styles.dueDate}>
                      Due: {formatDate(item.rental.dueAt)}
                    </span>
                  </div>

                  <div style={styles.overdueInfo}>
                    {item.daysOverdue > 0 ? (
                      <>
                        <span style={styles.overdueDays}>
                          {item.daysOverdue} day{item.daysOverdue !== 1 ? 's' : ''} overdue
                        </span>
                        <span style={styles.lateFeeAmount}>
                          ~{formatCents(item.lateFee)}
                        </span>
                      </>
                    ) : (
                      <Badge variant="success">On Time</Badge>
                    )}
                  </div>

                  <div style={styles.actionCol}>
                    {item.daysOverdue > 0 ? (
                      <Select
                        options={LATE_FEE_OPTIONS}
                        value={item.lateFeeAction ?? 'pay'}
                        onChange={(e) =>
                          updateLateFeeAction(item.copy.barcode, e.target.value as LateFeeAction)
                        }
                        aria-label="Late fee action"
                      />
                    ) : (
                      <span style={styles.noFee}>—</span>
                    )}
                  </div>

                  <div style={styles.removeCol}>
                    <Button
                      variant="ghost"
                      onClick={() => removeFromQueue(item.copy.barcode)}
                      aria-label="Remove from queue"
                    >
                      X
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Batch actions */}
          <div style={styles.batchActions}>
            <Button variant="secondary" onClick={() => setConfirmClear(true)}>
              Clear
            </Button>
            <Button
              variant="primary"
              onClick={() => setConfirmProcess(true)}
              disabled={processing}
            >
              {processing ? 'Processing...' : 'Process All Returns'}
            </Button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {returnQueue.length === 0 && !results && (
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>[&lt;&lt;]</div>
          <div>Scan a barcode or search by title to start processing returns</div>
        </div>
      )}

      {/* Clear Queue Confirmation */}
      <Modal isOpen={confirmClear} onClose={() => setConfirmClear(false)} title="Confirm Action">
        <p style={{ color: 'var(--text-primary)', margin: 0 }}>
          Clear all items from the return queue?
        </p>
        <div style={{ display: 'flex', gap: 'var(--space-sm)', justifyContent: 'flex-end', marginTop: 'var(--space-md)' }}>
          <Button variant="secondary" onClick={() => setConfirmClear(false)}>Cancel</Button>
          <Button variant="danger" onClick={() => { clearQueue(); setConfirmClear(false); }}>Clear</Button>
        </div>
      </Modal>

      {/* Process All Returns Confirmation */}
      <Modal isOpen={confirmProcess} onClose={() => setConfirmProcess(false)} title="Confirm Action">
        <p style={{ color: 'var(--text-primary)', margin: 0 }}>
          Process all returns? This will finalize them.
        </p>
        <div style={{ display: 'flex', gap: 'var(--space-sm)', justifyContent: 'flex-end', marginTop: 'var(--space-md)' }}>
          <Button variant="secondary" onClick={() => setConfirmProcess(false)}>Cancel</Button>
          <Button variant="danger" onClick={() => { processAllReturns(); setConfirmProcess(false); }}>Process Returns</Button>
        </div>
      </Modal>

      {/* Title Search Results Modal */}
      <Modal
        isOpen={searchResults !== null && selectedTitleCopies === null}
        onClose={() => setSearchResults(null)}
        title="Search Results"
      >
        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
          {searchResults?.map((title: any) => (
            <div
              key={title.id}
              onClick={() => handleTitleSelect(title.id, title.name)}
              style={{
                padding: '8px 12px',
                borderBottom: '1px solid var(--border-color)',
                cursor: 'pointer',
                color: 'var(--text-primary)',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = 'var(--accent-02)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = 'transparent'; }}
            >
              <div style={{ fontSize: 'var(--font-size-md)', fontWeight: 'bold' }}>
                {title.name} ({title.year})
              </div>
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
                {title.genre ?? 'No genre'} · {title.formats?.join(', ') ?? ''}
              </div>
            </div>
          ))}
          {searchLoading && (
            <div style={{ padding: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>
              Loading...
            </div>
          )}
        </div>
      </Modal>

      {/* Copy Selection Modal */}
      <Modal
        isOpen={selectedTitleCopies !== null}
        onClose={() => { setSelectedTitleCopies(null); setSearchResults(null); }}
        title={`Return: ${selectedTitleName}`}
      >
        <div style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-sm)', fontSize: 'var(--font-size-sm)' }}>
          Select which copy to return:
        </div>
        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
          {selectedTitleCopies?.map((copy: any, index: number) => {
            let custName = `${copy.customerFirstName ?? ''} ${copy.customerLastName ?? ''}`.trim();
            if (copy.familyMemberFirstName) {
              const fmName = `${copy.familyMemberFirstName} ${copy.familyMemberLastName ?? ''}`.trim();
              custName += ` — ${fmName}`;
            }
            const { daysOverdue } = calculateOverdue(copy.dueAt);

            return (
              <div
                key={copy.copyId}
                onClick={() => handleCopySelect(copy)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-md)',
                  padding: '10px 12px',
                  borderBottom: '1px solid var(--border-color)',
                  cursor: 'pointer',
                  color: 'var(--text-primary)',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = 'var(--accent-02)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = 'transparent'; }}
              >
                {/* Numbered indicator */}
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--crt-green)',
                  color: 'var(--bg-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold',
                  fontSize: 'var(--font-size-lg)',
                  flexShrink: 0,
                }}>
                  {index + 1}
                </div>

                {/* Copy details */}
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center' }}>
                    <span style={{ fontFamily: 'monospace', fontSize: 'var(--font-size-sm)' }}>{copy.barcode}</span>
                    <Badge variant="info">{copy.format}</Badge>
                  </div>
                  <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    {custName} · Due: {formatDate(copy.dueAt)}
                    {daysOverdue > 0 && (
                      <span style={{ color: 'var(--crt-red)', marginLeft: 'var(--space-sm)' }}>
                        {daysOverdue} day{daysOverdue !== 1 ? 's' : ''} overdue
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Modal>
    </div>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────

const styles: Record<string, CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    gap: 'var(--space-sm)',
    padding: 'var(--space-md)',
  },
  heading: {
    color: 'var(--crt-green)',
    fontSize: 'var(--font-size-xl)',
    textTransform: 'uppercase',
    letterSpacing: '2px',
    textShadow: '0 0 10px var(--accent-50)',
    margin: 0,
  },
  scanBar: {
    display: 'flex',
    gap: 'var(--space-sm)',
    alignItems: 'flex-end',
  },
  scanInputWrapper: {
    flex: 1,
    maxWidth: '500px',
  },
  resultsSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-sm)',
  },
  resultLine: {
    marginTop: '4px',
    fontSize: 'var(--font-size-sm)',
  },
  queueSection: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--border-radius)',
    overflow: 'hidden',
    minHeight: 0,
  },
  queueHeader: {
    padding: '6px 12px',
    borderBottom: '1px solid var(--crt-green-dim)',
    backgroundColor: 'var(--bg-secondary)',
  },
  queueLabel: {
    color: 'var(--crt-green)',
    fontSize: 'var(--font-size-sm)',
    textTransform: 'uppercase',
    letterSpacing: '1px',
  },
  queueList: {
    flex: 1,
    overflowY: 'auto',
  },
  queueRow: {
    padding: '8px 12px',
    borderBottom: '1px solid var(--border-color)',
  },
  queueRowMain: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-md)',
  },
  titleInfo: {
    flex: 2,
    minWidth: 0,
  },
  titleName: {
    color: 'var(--text-primary)',
    fontSize: 'var(--font-size-md)',
    display: 'block',
  },
  copyMeta: {
    display: 'flex',
    gap: 'var(--space-sm)',
    alignItems: 'center',
    marginTop: '2px',
  },
  barcode: {
    color: 'var(--text-secondary)',
    fontSize: 'var(--font-size-sm)',
    fontFamily: 'monospace',
  },
  rentalInfo: {
    flex: 1.5,
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  customerName: {
    color: 'var(--text-primary)',
    fontSize: 'var(--font-size-md)',
  },
  dueDate: {
    color: 'var(--text-secondary)',
    fontSize: 'var(--font-size-sm)',
  },
  overdueInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: '2px',
  },
  overdueDays: {
    color: 'var(--crt-red)',
    fontSize: 'var(--font-size-md)',
    textShadow: '0 0 8px var(--error-40)',
    fontWeight: 'bold',
  },
  lateFeeAmount: {
    color: 'var(--crt-amber)',
    fontSize: 'var(--font-size-sm)',
  },
  actionCol: {
    width: '160px',
    flexShrink: 0,
  },
  removeCol: {
    flexShrink: 0,
  },
  noFee: {
    color: 'var(--text-muted)',
    textAlign: 'center',
    display: 'block',
  },
  batchActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 'var(--space-sm)',
    padding: 'var(--space-sm) var(--space-md)',
    borderTop: '1px solid var(--border-color)',
    backgroundColor: 'var(--bg-secondary)',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    color: 'var(--text-muted)',
    fontSize: 'var(--font-size-md)',
    gap: 'var(--space-sm)',
  },
  emptyIcon: {
    fontSize: 'var(--font-size-xxl)',
    color: 'var(--crt-green-dim)',
  },
};
