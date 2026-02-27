// ABOUTME: Customer detail panel showing profile, balance, rentals, and family members
// ABOUTME: Fetches customer data by ID and provides quick actions for common operations

import { type CSSProperties, useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';
import { Input } from '../common/Input';
import { Table } from '../common/Table';
import { api } from '../../api/client';
import { CustomerForm } from './CustomerForm';

interface CustomerCardProps {
  customerId: string;
}

interface Customer {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  birthday: string | null;
  notes: string | null;
  balance: number;
  active: number;
  member_barcode: string;
  created_at: string;
  familyMembers?: FamilyMember[];
}

interface FamilyMember {
  id: string;
  first_name: string;
  last_name: string;
  relationship: string | null;
}

interface ActiveRental {
  id: string;
  title: string;
  due_at: string;
  copy_barcode?: string;
}

export function CustomerCard({ customerId }: CustomerCardProps) {
  const navigate = useNavigate();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [rentals, setRentals] = useState<ActiveRental[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [showBalanceAdjust, setShowBalanceAdjust] = useState(false);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [adjusting, setAdjusting] = useState(false);
  const [showAddFamily, setShowAddFamily] = useState(false);
  const [familyFirst, setFamilyFirst] = useState('');
  const [familyLast, setFamilyLast] = useState('');
  const [familyRelation, setFamilyRelation] = useState('');

  const loadCustomer = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [data, rentalData] = await Promise.all([
        api.customers.get(customerId),
        api.rentals.customer(customerId).catch(() => []),
      ]);
      setCustomer(data);
      const rentalList = Array.isArray(rentalData) ? rentalData : rentalData.rentals ?? [];
      setRentals(rentalList.filter((r: any) => r.status === 'out' || r.status === 'active'));
    } catch {
      setError('Failed to load customer');
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    loadCustomer();
  }, [loadCustomer]);

  function formatBalance(cents: number): string {
    const dollars = Math.abs(cents) / 100;
    const sign = cents < 0 ? '-' : '';
    return `${sign}$${dollars.toFixed(2)}`;
  }

  function daysRemaining(dueAt: string): number {
    const due = new Date(dueAt);
    const now = new Date();
    const diff = due.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  async function handleBalanceAdjust() {
    const cents = Math.round(parseFloat(adjustAmount) * 100);
    if (isNaN(cents) || cents === 0) return;
    setAdjusting(true);
    try {
      await api.customers.adjustBalance(customerId, {
        amount: cents,
        reason: adjustReason || undefined,
      });
      setShowBalanceAdjust(false);
      setAdjustAmount('');
      setAdjustReason('');
      loadCustomer();
    } catch {
      // error is visible from the failed state
    } finally {
      setAdjusting(false);
    }
  }

  async function handleAddFamily() {
    if (!familyFirst.trim() || !familyLast.trim()) return;
    try {
      await api.customers.addFamily(customerId, {
        first_name: familyFirst.trim(),
        last_name: familyLast.trim(),
        relationship: familyRelation.trim() || undefined,
      });
      setShowAddFamily(false);
      setFamilyFirst('');
      setFamilyLast('');
      setFamilyRelation('');
      loadCustomer();
    } catch {
      // silent fail for now
    }
  }

  if (loading) {
    return <div style={styles.loading}>Loading customer...</div>;
  }

  if (error || !customer) {
    return <div style={styles.error}>{error ?? 'Customer not found'}</div>;
  }

  const rentalTableData = rentals.map((r) => {
    const days = daysRemaining(r.due_at);
    return {
      title: r.title ?? r.copy_barcode ?? 'Unknown',
      due: new Date(r.due_at).toLocaleDateString(),
      remaining: (
        <span style={{ color: days < 0 ? 'var(--crt-red)' : 'var(--text-primary)' }}>
          {days < 0 ? `${Math.abs(days)}d overdue` : `${days}d`}
        </span>
      ),
    };
  });

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h2 style={styles.name}>
            {customer.first_name} {customer.last_name}
          </h2>
          <div style={styles.barcode}>{customer.member_barcode}</div>
        </div>
        <Badge variant={customer.active ? 'success' : 'danger'}>
          {customer.active ? 'Active' : 'Inactive'}
        </Badge>
      </div>

      {/* Contact info */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Contact</h3>
        <div style={styles.fieldGrid}>
          {customer.phone && (
            <div style={styles.field}>
              <span style={styles.fieldLabel}>Phone</span>
              <span style={styles.fieldValue}>{customer.phone}</span>
            </div>
          )}
          {customer.email && (
            <div style={styles.field}>
              <span style={styles.fieldLabel}>Email</span>
              <span style={styles.fieldValue}>{customer.email}</span>
            </div>
          )}
          {customer.address && (
            <div style={styles.field}>
              <span style={styles.fieldLabel}>Address</span>
              <span style={styles.fieldValue}>{customer.address}</span>
            </div>
          )}
          {customer.birthday && (
            <div style={styles.field}>
              <span style={styles.fieldLabel}>Birthday</span>
              <span style={styles.fieldValue}>{customer.birthday}</span>
            </div>
          )}
        </div>
      </div>

      {/* Balance */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Balance</h3>
        <div style={styles.balanceRow}>
          <span
            style={{
              ...styles.balanceAmount,
              color: customer.balance < 0 ? 'var(--crt-red)' : 'var(--crt-green)',
              textShadow: customer.balance < 0
                ? '0 0 10px var(--error-50)'
                : 'var(--glow-green)',
            }}
          >
            {formatBalance(customer.balance)}
          </span>
          <Button variant="secondary" onClick={() => setShowBalanceAdjust(true)}>
            Adjust
          </Button>
        </div>
      </div>

      {/* Active rentals */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>
          Active Rentals
          {rentals.length > 0 && (
            <Badge variant="info">{rentals.length}</Badge>
          )}
        </h3>
        <Table
          columns={[
            { key: 'title', label: 'Title' },
            { key: 'due', label: 'Due Date', width: '100px' },
            { key: 'remaining', label: 'Remaining', width: '100px' },
          ]}
          data={rentalTableData}
          emptyMessage="No active rentals"
        />
      </div>

      {/* Family members */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <h3 style={styles.sectionTitle}>Family Members</h3>
          <Button variant="ghost" onClick={() => setShowAddFamily(true)}>
            + Add
          </Button>
        </div>
        {customer.familyMembers && customer.familyMembers.length > 0 ? (
          <div style={styles.familyList}>
            {customer.familyMembers.map((fm) => (
              <div key={fm.id} style={styles.familyItem}>
                <span style={styles.fieldValue}>{fm.first_name} {fm.last_name}</span>
                {fm.relationship && (
                  <span style={styles.fieldLabel}>{fm.relationship}</span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div style={styles.emptyState}>No family members</div>
        )}
      </div>

      {/* Notes */}
      {customer.notes && (
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Notes</h3>
          <div style={styles.notes}>{customer.notes}</div>
        </div>
      )}

      {/* Quick actions */}
      <div style={styles.actions}>
        <Button variant="primary" onClick={() => navigate('/pos')}>
          New Rental
        </Button>
        <Button variant="secondary" onClick={() => setShowEdit(true)}>
          Edit
        </Button>
        <Button variant="secondary" onClick={() => setShowBalanceAdjust(true)}>
          Adjust Balance
        </Button>
      </div>

      {/* Edit modal */}
      {showEdit && (
        <CustomerForm
          customerId={customerId}
          onClose={() => setShowEdit(false)}
          onSaved={() => {
            setShowEdit(false);
            loadCustomer();
          }}
        />
      )}

      {/* Balance adjustment modal */}
      <Modal
        isOpen={showBalanceAdjust}
        onClose={() => setShowBalanceAdjust(false)}
        title="Adjust Balance"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowBalanceAdjust(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleBalanceAdjust}
              disabled={adjusting || !adjustAmount}
            >
              {adjusting ? 'Saving...' : 'Apply'}
            </Button>
          </>
        }
      >
        <div style={styles.formFields}>
          <Input
            label="Amount (positive = credit, negative = debit)"
            type="number"
            step="0.01"
            value={adjustAmount}
            onChange={(e) => setAdjustAmount(e.target.value)}
            placeholder="e.g. 5.00 or -2.50"
          />
          <Input
            label="Reason"
            value={adjustReason}
            onChange={(e) => setAdjustReason(e.target.value)}
            placeholder="Reason for adjustment"
          />
        </div>
      </Modal>

      {/* Add family member modal */}
      <Modal
        isOpen={showAddFamily}
        onClose={() => setShowAddFamily(false)}
        title="Add Family Member"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowAddFamily(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleAddFamily}
              disabled={!familyFirst.trim() || !familyLast.trim()}
            >
              Add
            </Button>
          </>
        }
      >
        <div style={styles.formFields}>
          <Input
            label="First Name"
            value={familyFirst}
            onChange={(e) => setFamilyFirst(e.target.value)}
            required
          />
          <Input
            label="Last Name"
            value={familyLast}
            onChange={(e) => setFamilyLast(e.target.value)}
            required
          />
          <Input
            label="Relationship"
            value={familyRelation}
            onChange={(e) => setFamilyRelation(e.target.value)}
            placeholder="e.g. Spouse, Child"
          />
        </div>
      </Modal>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-md)',
    padding: 'var(--space-sm)',
  },
  loading: {
    color: 'var(--text-secondary)',
    padding: 'var(--space-lg)',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  error: {
    color: 'var(--crt-red)',
    padding: 'var(--space-lg)',
    textAlign: 'center',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  name: {
    color: 'var(--crt-green)',
    textShadow: 'var(--glow-green)',
    fontSize: 'var(--font-size-xl)',
    margin: 0,
  },
  barcode: {
    color: 'var(--text-secondary)',
    fontSize: 'var(--font-size-sm)',
    fontFamily: 'monospace',
    marginTop: '2px',
  },
  section: {
    borderTop: '1px solid var(--border-color)',
    paddingTop: 'var(--space-sm)',
  },
  sectionTitle: {
    color: 'var(--crt-green-dim)',
    fontSize: 'var(--font-size-sm)',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    margin: '0 0 var(--space-sm) 0',
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-sm)',
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fieldGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 'var(--space-sm)',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  fieldLabel: {
    color: 'var(--text-muted)',
    fontSize: 'var(--font-size-sm)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  fieldValue: {
    color: 'var(--text-primary)',
    fontSize: 'var(--font-size-md)',
  },
  balanceRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-md)',
  },
  balanceAmount: {
    fontSize: 'var(--font-size-xxl)',
    fontFamily: 'monospace',
    fontWeight: 'bold',
  },
  familyList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-xs)',
  },
  familyItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '4px 8px',
    borderBottom: '1px solid var(--border-color)',
  },
  emptyState: {
    color: 'var(--text-muted)',
    fontStyle: 'italic',
    fontSize: 'var(--font-size-sm)',
    padding: '4px 0',
  },
  notes: {
    color: 'var(--text-secondary)',
    fontSize: 'var(--font-size-md)',
    whiteSpace: 'pre-wrap',
    padding: '4px 8px',
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: 'var(--border-radius)',
  },
  actions: {
    display: 'flex',
    gap: 'var(--space-sm)',
    borderTop: '1px solid var(--border-color)',
    paddingTop: 'var(--space-md)',
  },
  formFields: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-md)',
  },
};
