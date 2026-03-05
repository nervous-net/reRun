// ABOUTME: Standalone reservations panel showing pending title reservations
// ABOUTME: Fetches active reservations with fulfill and cancel actions per row

import { type CSSProperties, useCallback, useEffect, useState } from 'react';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';
import { Badge } from '../common/Badge';
import { Table } from '../common/Table';
import { Alert } from '../common/Alert';
import { api } from '../../api/client';

// ─── Types ──────────────────────────────────────────────────────────

interface Reservation {
  id: string;
  customerId: string;
  titleId: string;
  reservedAt: string;
  expiresAt: string;
  fulfilled: number;
  notified: number;
  customerName?: string;
  titleName?: string;
}

// ─── Helpers ────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function isExpired(expiresAt: string): boolean {
  return new Date() > new Date(expiresAt);
}

// ─── Table columns ──────────────────────────────────────────────────

const columns = [
  { key: 'customerName', label: 'Customer' },
  { key: 'titleName', label: 'Title' },
  { key: 'reservedAt', label: 'Reserved', width: '110px' },
  { key: 'expiresAt', label: 'Expires', width: '110px' },
  { key: 'status', label: 'Status', width: '100px' },
  { key: 'actions', label: 'Actions', width: '180px' },
];

// ─── Component ──────────────────────────────────────────────────────

export function ReservationList() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);

  const fetchReservations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.reservations.list();
      const data: Reservation[] = res.data ?? res ?? [];
      setReservations(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load reservations');
      setReservations([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReservations();
  }, [fetchReservations]);

  const handleFulfill = async (id: string) => {
    setActionError(null);
    try {
      await api.reservations.fulfill(id);
      await fetchReservations();
    } catch (err: any) {
      setActionError(err.message || 'Failed to fulfill reservation');
    }
  };

  const handleCancel = async (id: string) => {
    setActionError(null);
    try {
      await api.reservations.cancel(id);
      await fetchReservations();
    } catch (err: any) {
      setActionError(err.message || 'Failed to cancel reservation');
    }
  };

  const tableData = reservations.map((r) => ({
    customerName: r.customerName ?? r.customerId,
    titleName: r.titleName ?? r.titleId,
    reservedAt: formatDate(r.reservedAt),
    expiresAt: (
      <span style={isExpired(r.expiresAt) ? { color: 'var(--crt-red)' } : {}}>
        {formatDate(r.expiresAt)}
      </span>
    ),
    status: isExpired(r.expiresAt) ? (
      <Badge variant="danger">Expired</Badge>
    ) : (
      <Badge variant="warning">Waiting</Badge>
    ),
    actions: (
      <div style={styles.actionButtons}>
        <Button variant="primary" onClick={() => handleFulfill(r.id)}>
          Fulfill
        </Button>
        <Button variant="danger" onClick={() => { setCancelTarget(r.id); setConfirmCancel(true); }}>
          Cancel
        </Button>
      </div>
    ),
  }));

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.heading}>Reservations</h3>
        <Button variant="secondary" onClick={fetchReservations} disabled={loading}>
          Refresh
        </Button>
      </div>

      {error && (
        <Alert variant="error" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      {actionError && (
        <Alert variant="error" onDismiss={() => setActionError(null)}>
          {actionError}
        </Alert>
      )}

      {loading && reservations.length === 0 ? (
        <div style={styles.loadingState}>Loading reservations...</div>
      ) : (
        <Table
          columns={columns}
          data={tableData}
          emptyMessage="No pending reservations"
        />
      )}

      {/* Cancel Reservation Confirmation */}
      <Modal isOpen={confirmCancel} onClose={() => setConfirmCancel(false)} title="Confirm Action">
        <p style={{ color: 'var(--text-primary)', margin: 0 }}>
          Cancel this reservation? This cannot be undone.
        </p>
        <div style={{ display: 'flex', gap: 'var(--space-sm)', justifyContent: 'flex-end', marginTop: 'var(--space-md)' }}>
          <Button variant="secondary" onClick={() => setConfirmCancel(false)}>Cancel</Button>
          <Button variant="danger" onClick={() => { if (cancelTarget) handleCancel(cancelTarget); setConfirmCancel(false); setCancelTarget(null); }}>Cancel Reservation</Button>
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
    gap: 'var(--space-sm)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heading: {
    color: 'var(--crt-green)',
    fontSize: 'var(--font-size-lg)',
    textTransform: 'uppercase',
    letterSpacing: '2px',
    textShadow: '0 0 10px var(--accent-50)',
    margin: 0,
  },
  actionButtons: {
    display: 'flex',
    gap: 'var(--space-xs)',
  },
  loadingState: {
    color: 'var(--crt-green)',
    textAlign: 'center',
    padding: 'var(--space-xl)',
    fontSize: 'var(--font-size-md)',
  },
};
