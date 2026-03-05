// ABOUTME: Main customer management screen with search, results list, and detail panel
// ABOUTME: Split-view layout with debounced search input and inline customer card display

import { type CSSProperties, useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Badge } from '../common/Badge';
import { api } from '../../api/client';
import { CustomerCard } from './CustomerCard';
import { CustomerForm } from './CustomerForm';

interface CustomerResult {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
  balance: number;
  active: number;
  memberBarcode: string;
  activeRentalCount?: number;
}

export function CustomerSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CustomerResult[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const performSearch = useCallback(async (q: string) => {
    setLoading(true);
    try {
      if (q.trim().length === 0) {
        const data = await api.customers.list();
        setResults(Array.isArray(data) ? data : data.data ?? []);
      } else {
        const data = await api.customers.search(q.trim());
        setResults(Array.isArray(data) ? data : data.data ?? []);
      }
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      performSearch(query);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, performSearch]);

  function handleCustomerSaved() {
    setShowForm(false);
    performSearch(query);
  }

  function formatBalance(cents: number): string {
    const dollars = Math.abs(cents) / 100;
    const sign = cents < 0 ? '-' : '';
    return `${sign}$${dollars.toFixed(2)}`;
  }

  return (
    <div style={styles.container}>
      {/* Search bar */}
      <div style={styles.toolbar}>
        <div style={styles.searchWrapper}>
          <Input
            placeholder="Search customers by name, phone, or barcode..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Button variant="primary" onClick={() => setShowForm(true)}>
          + New Customer
        </Button>
      </div>

      {/* Split view */}
      <div style={styles.splitView}>
        {/* Results list */}
        <div style={styles.resultsList}>
          <div style={styles.resultsHeader}>
            <span style={styles.resultsLabel}>
              {loading ? 'Searching...' : `${results.length} result${results.length !== 1 ? 's' : ''}`}
            </span>
          </div>
          {results.length === 0 && !loading && query.trim().length > 0 && (
            <div style={styles.emptyState}>No customers found</div>
          )}
          {results.length === 0 && !loading && query.trim().length === 0 && (
            <div style={styles.emptyState}>No customers yet</div>
          )}
          {results.map((customer) => (
            <div
              key={customer.id}
              style={{
                ...styles.resultRow,
                ...(selectedId === customer.id ? styles.resultRowSelected : {}),
              }}
              role="button"
              tabIndex={0}
              onClick={() => setSelectedId(customer.id)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedId(customer.id); } }}
              onMouseEnter={(e) => {
                if (selectedId !== customer.id) {
                  e.currentTarget.style.backgroundColor = 'var(--accent-06)';
                }
              }}
              onMouseLeave={(e) => {
                if (selectedId !== customer.id) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
              onFocus={(e) => {
                if (selectedId !== customer.id) {
                  e.currentTarget.style.backgroundColor = 'var(--accent-06)';
                }
              }}
              onBlur={(e) => {
                if (selectedId !== customer.id) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              <div style={styles.resultName}>
                {customer.firstName} {customer.lastName}
              </div>
              <div style={styles.resultMeta}>
                {customer.phone && (
                  <span style={styles.resultPhone}>{customer.phone}</span>
                )}
                <span
                  style={{
                    ...styles.resultBalance,
                    color: customer.balance < 0 ? 'var(--crt-red)' : 'var(--crt-green)',
                  }}
                >
                  {formatBalance(customer.balance)}
                </span>
                {typeof customer.activeRentalCount === 'number' && customer.activeRentalCount > 0 && (
                  <Badge variant="info">{customer.activeRentalCount} rental{customer.activeRentalCount !== 1 ? 's' : ''}</Badge>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Detail panel */}
        <div style={styles.detailPanel}>
          {selectedId ? (
            <CustomerCard customerId={selectedId} />
          ) : (
            <div style={styles.detailEmpty}>
              <div style={styles.detailEmptyIcon}>[?]</div>
              <div>Select a customer to view details</div>
            </div>
          )}
        </div>
      </div>

      {/* New customer modal */}
      {showForm && (
        <CustomerForm
          onClose={() => setShowForm(false)}
          onSaved={handleCustomerSaved}
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
    gap: 'var(--space-sm)',
    padding: 'var(--space-md)',
  },
  toolbar: {
    display: 'flex',
    gap: 'var(--space-sm)',
    alignItems: 'flex-end',
  },
  searchWrapper: {
    flex: 1,
  },
  splitView: {
    display: 'flex',
    gap: 'var(--space-md)',
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
  resultsList: {
    width: '300px',
    minWidth: '300px',
    borderRight: '1px solid var(--border-color)',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
  },
  resultsHeader: {
    padding: '4px 8px',
    borderBottom: '1px solid var(--crt-green)',
  },
  resultsLabel: {
    color: 'var(--text-secondary)',
    fontSize: 'var(--font-size-sm)',
    textTransform: 'uppercase',
    letterSpacing: '1px',
  },
  resultRow: {
    padding: '8px',
    cursor: 'pointer',
    borderBottom: '1px solid var(--border-color)',
    transition: 'background-color 0.1s ease',
  },
  resultRowSelected: {
    backgroundColor: 'var(--accent-10)',
    borderLeft: '2px solid var(--crt-green)',
  },
  resultName: {
    color: 'var(--text-primary)',
    fontSize: 'var(--font-size-md)',
    marginBottom: '2px',
  },
  resultMeta: {
    display: 'flex',
    gap: 'var(--space-sm)',
    alignItems: 'center',
    fontSize: 'var(--font-size-sm)',
  },
  resultPhone: {
    color: 'var(--text-secondary)',
  },
  resultBalance: {
    fontFamily: 'inherit',
  },
  emptyState: {
    color: 'var(--text-muted)',
    fontStyle: 'italic',
    padding: 'var(--space-lg) var(--space-md)',
    textAlign: 'center',
  },
  detailPanel: {
    flex: 1,
    overflowY: 'auto',
    minHeight: 0,
  },
  detailEmpty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: 'var(--text-muted)',
    fontSize: 'var(--font-size-md)',
    gap: 'var(--space-sm)',
  },
  detailEmptyIcon: {
    fontSize: 'var(--font-size-xxl)',
    color: 'var(--crt-green-dim)',
  },
};
