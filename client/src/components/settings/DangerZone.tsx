// ABOUTME: Danger Zone section for Settings page with destructive inventory operations
// ABOUTME: Provides "Clear All Inventory" with backup, type-to-confirm, and count display

import { type CSSProperties, useState, useCallback } from 'react';
import { api } from '../../api/client';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';

const dangerZoneStyle: CSSProperties = {
  border: '1px solid var(--crt-red, #ff4444)',
  borderRadius: 'var(--radius-md, 4px)',
  padding: 'var(--space-md)',
  marginTop: 'var(--space-lg)',
};

const dangerHeaderStyle: CSSProperties = {
  color: 'var(--crt-red, #ff4444)',
  fontSize: 'var(--font-size-lg)',
  fontFamily: 'inherit',
  marginBottom: 'var(--space-md)',
  textTransform: 'uppercase',
  letterSpacing: '2px',
};

const dangerDescStyle: CSSProperties = {
  color: 'var(--text-secondary)',
  fontSize: 'var(--font-size-sm)',
  marginBottom: 'var(--space-md)',
};

const confirmInputStyle: CSSProperties = {
  backgroundColor: 'var(--bg-primary)',
  border: '1px solid var(--border-color)',
  color: 'var(--text-primary)',
  padding: 'var(--space-xs) var(--space-sm)',
  fontFamily: 'inherit',
  fontSize: 'var(--font-size-sm)',
  width: '100%',
  marginTop: 'var(--space-sm)',
  marginBottom: 'var(--space-sm)',
};

interface InventoryCounts {
  titles: number;
}

interface NukeResult {
  titlesDeleted: number;
  copiesDeleted: number;
  rentalsDeleted: number;
  reservationsDeleted: number;
  transactionItemsDeleted: number;
  backupFile: string;
}

export function DangerZone() {
  const [showNukeModal, setShowNukeModal] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [counts, setCounts] = useState<InventoryCounts | null>(null);
  const [nuking, setNuking] = useState(false);
  const [result, setResult] = useState<NukeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchCounts = useCallback(async () => {
    try {
      const data = await api.titles.list({ limit: '1' });
      setCounts({ titles: data.total ?? 0 });
    } catch {
      // Non-critical, continue without counts
    }
  }, []);

  function openNukeModal() {
    setConfirmText('');
    setResult(null);
    setError(null);
    fetchCounts();
    setShowNukeModal(true);
  }

  async function handleNuke() {
    setNuking(true);
    setError(null);
    try {
      const data = await api.titles.nuke('DELETE ALL');
      setResult(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Nuke failed');
    } finally {
      setNuking(false);
    }
  }

  return (
    <div style={dangerZoneStyle}>
      <div style={dangerHeaderStyle}>Danger Zone</div>
      <div style={dangerDescStyle}>
        Irreversible actions. A backup is created automatically before any destructive operation.
      </div>
      <Button variant="danger" onClick={openNukeModal}>
        Clear All Inventory
      </Button>

      <Modal
        isOpen={showNukeModal}
        onClose={() => setShowNukeModal(false)}
        title="Clear All Inventory"
      >
        {!result ? (
          <>
            <p style={{ color: 'var(--text-primary)', margin: '0 0 var(--space-md) 0' }}>
              This will permanently delete
              {counts ? ` ${counts.titles} titles and` : ''} all copies, rentals,
              reservations, and transaction line items. Financial transaction records are preserved.
            </p>
            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', margin: '0 0 var(--space-md) 0' }}>
              A backup will be created automatically before deletion.
            </p>
            <label style={{ color: 'var(--text-primary)', fontSize: 'var(--font-size-sm)' }}>
              Type <strong>DELETE ALL</strong> to confirm:
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                style={confirmInputStyle}
                autoFocus
                placeholder="DELETE ALL"
              />
            </label>
            {error && (
              <p style={{ color: 'var(--crt-red, #ff4444)', fontSize: 'var(--font-size-sm)', margin: 'var(--space-sm) 0' }}>
                {error}
              </p>
            )}
            <div style={{ display: 'flex', gap: 'var(--space-sm)', justifyContent: 'flex-end', marginTop: 'var(--space-md)' }}>
              <Button variant="secondary" onClick={() => setShowNukeModal(false)}>Cancel</Button>
              <Button
                variant="danger"
                onClick={handleNuke}
                disabled={confirmText !== 'DELETE ALL' || nuking}
              >
                {nuking ? 'Deleting...' : 'Confirm Delete'}
              </Button>
            </div>
          </>
        ) : (
          <>
            <p style={{ color: 'var(--crt-green)', margin: '0 0 var(--space-md) 0' }}>
              Inventory cleared.
            </p>
            <ul style={{ color: 'var(--text-primary)', fontSize: 'var(--font-size-sm)', margin: '0 0 var(--space-md) 0', paddingLeft: 'var(--space-md)' }}>
              <li>{result.titlesDeleted} titles deleted</li>
              <li>{result.copiesDeleted} copies deleted</li>
              <li>{result.rentalsDeleted} rentals deleted</li>
              <li>{result.reservationsDeleted} reservations deleted</li>
              <li>{result.transactionItemsDeleted} transaction items deleted</li>
            </ul>
            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', margin: 0 }}>
              Backup saved as: {result.backupFile}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-md)' }}>
              <Button variant="secondary" onClick={() => setShowNukeModal(false)}>Close</Button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
