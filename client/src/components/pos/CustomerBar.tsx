// ABOUTME: Customer selector bar for the POS screen with search and display
// ABOUTME: Shows customer info when selected, search input when not, with balance and birthday alerts

import { type CSSProperties, useCallback, useEffect, useRef, useState } from 'react';
import { Input } from '../common/Input';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';
import { Alert } from '../common/Alert';
import { api } from '../../api/client';

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

interface CustomerBarProps {
  customer: Customer | null;
  onCustomerSelect: (customer: Customer) => void;
  onClear: () => void;
}

function formatBalance(cents: number): string {
  const dollars = Math.abs(cents) / 100;
  const sign = cents < 0 ? '-' : '';
  return `${sign}$${dollars.toFixed(2)}`;
}

function isBirthday(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const today = new Date();
  const dob = new Date(dateStr);
  return today.getMonth() === dob.getMonth() && today.getDate() === dob.getDate();
}

export function CustomerBar({ customer, onCustomerSelect, onClear }: CustomerBarProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Customer[]>([]);
  const [showResults, setShowResults] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const performSearch = useCallback(async (q: string) => {
    if (q.trim().length === 0) {
      setResults([]);
      return;
    }
    try {
      const data = await api.customers.search(q.trim());
      setResults(Array.isArray(data) ? data : data.data ?? []);
    } catch {
      setResults([]);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      performSearch(query);
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, performSearch]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleSelect(c: Customer) {
    onCustomerSelect(c);
    setQuery('');
    setResults([]);
    setShowResults(false);
  }

  if (customer) {
    return (
      <div style={styles.bar}>
        <div style={styles.customerInfo}>
          <span style={styles.customerName}>
            {customer.firstName} {customer.lastName}
          </span>
          <Badge variant="info">{customer.memberBarcode}</Badge>
          <span
            style={{
              ...styles.balance,
              color: customer.balance < 0 ? 'var(--crt-red)' : 'var(--crt-green)',
            }}
          >
            BAL: {formatBalance(customer.balance)}
          </span>
          {customer.balance < 0 && (
            <Badge variant="danger">OWES {formatBalance(customer.balance)}</Badge>
          )}
          {isBirthday(customer.birthday) && (
            <Badge variant="warning">BIRTHDAY</Badge>
          )}
        </div>
        <Button variant="ghost" onClick={onClear}>
          Clear
        </Button>
        {customer.balance < 0 && (
          <div style={styles.alertRow}>
            <Alert variant="warning">
              Customer has a negative balance of {formatBalance(customer.balance)}
            </Alert>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={styles.bar} ref={containerRef}>
      <div style={styles.searchRow}>
        <span style={styles.label}>CUSTOMER:</span>
        <div style={styles.searchInput}>
          <Input
            placeholder="Search or scan member barcode..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShowResults(true);
            }}
            onFocus={() => setShowResults(true)}
          />
        </div>
      </div>
      {showResults && results.length > 0 && (
        <div style={styles.dropdown}>
          {results.map((c) => (
            <div
              key={c.id}
              style={styles.dropdownItem}
              onClick={() => handleSelect(c)}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--accent-10)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <span style={styles.dropdownName}>
                {c.firstName} {c.lastName}
              </span>
              <span style={styles.dropdownMeta}>
                {c.memberBarcode} | {formatBalance(c.balance)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  bar: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 'var(--space-sm)',
    padding: '8px 12px',
    backgroundColor: 'var(--bg-secondary)',
    borderBottom: '1px solid var(--border-color)',
    position: 'relative',
  },
  customerInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-sm)',
    flex: 1,
  },
  customerName: {
    color: 'var(--crt-green)',
    fontSize: 'var(--font-size-lg)',
    textShadow: '0 0 8px var(--accent-30)',
    textTransform: 'uppercase',
    letterSpacing: '1px',
  },
  balance: {
    fontSize: 'var(--font-size-md)',
    fontFamily: 'inherit',
    letterSpacing: '0.5px',
  },
  alertRow: {
    width: '100%',
    marginTop: '4px',
  },
  searchRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-sm)',
    flex: 1,
  },
  label: {
    color: 'var(--text-secondary)',
    fontSize: 'var(--font-size-sm)',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    whiteSpace: 'nowrap',
  },
  searchInput: {
    flex: 1,
    maxWidth: '400px',
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: '100px',
    right: '12px',
    maxWidth: '400px',
    backgroundColor: 'var(--bg-panel)',
    border: '1px solid var(--crt-green)',
    borderRadius: 'var(--border-radius)',
    zIndex: 100,
    maxHeight: '200px',
    overflowY: 'auto',
    boxShadow: '0 4px 12px var(--overlay-50)',
  },
  dropdownItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 12px',
    cursor: 'pointer',
    borderBottom: '1px solid var(--border-color)',
    transition: 'background-color 0.1s ease',
  },
  dropdownName: {
    color: 'var(--text-primary)',
    fontSize: 'var(--font-size-md)',
  },
  dropdownMeta: {
    color: 'var(--text-secondary)',
    fontSize: 'var(--font-size-sm)',
  },
};
