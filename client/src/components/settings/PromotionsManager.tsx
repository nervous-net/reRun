// ABOUTME: Promotions management UI for creating and editing store deals
// ABOUTME: Supports bundle deals like "2 for $5" with date ranges and active toggling

import { type CSSProperties, useCallback, useEffect, useState } from 'react';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';
import { Input } from '../common/Input';
import { Badge } from '../common/Badge';
import { api } from '../../api/client';

interface Promotion {
  id: string;
  name: string;
  type: string;
  rules: string | null;
  startDate: string | null;
  endDate: string | null;
  active: number;
}

interface PromotionDraft {
  name: string;
  type: string;
  bundleQty: string;
  bundlePrice: string;
  startDate: string;
  endDate: string;
}

const emptyDraft: PromotionDraft = {
  name: '',
  type: 'bundle',
  bundleQty: '2',
  bundlePrice: '5.00',
  startDate: '',
  endDate: '',
};

function parseRules(rulesStr: string | null): { qty?: number; price?: number } {
  if (!rulesStr) return {};
  try { return JSON.parse(rulesStr); } catch { return {}; }
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function PromotionsManager() {
  const [promos, setPromos] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<PromotionDraft>({ ...emptyDraft });
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState<string | null>(null);

  const loadPromos = useCallback(async () => {
    try {
      const data = await api.promotions.list();
      setPromos(Array.isArray(data) ? data : data.data ?? []);
    } catch {
      setError('Failed to load promotions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPromos();
  }, [loadPromos]);

  function startEditing(promo: Promotion) {
    const rules = parseRules(promo.rules);
    setEditingId(promo.id);
    setDraft({
      name: promo.name,
      type: promo.type,
      bundleQty: String(rules.qty ?? 2),
      bundlePrice: rules.price ? (rules.price / 100).toFixed(2) : '',
      startDate: promo.startDate ?? '',
      endDate: promo.endDate ?? '',
    });
    setShowAdd(false);
  }

  function startAdding() {
    setEditingId(null);
    setDraft({ ...emptyDraft });
    setShowAdd(true);
  }

  function cancelEdit() {
    setEditingId(null);
    setShowAdd(false);
    setDraft({ ...emptyDraft });
  }

  async function handleSave() {
    if (!draft.name.trim()) { setError('Name is required'); return; }
    setSaving(true);
    setError(null);
    try {
      const rules = JSON.stringify({
        qty: parseInt(draft.bundleQty, 10) || 2,
        price: Math.round(parseFloat(draft.bundlePrice || '0') * 100),
      });
      const payload = {
        name: draft.name.trim(),
        type: draft.type,
        rules,
        startDate: draft.startDate || null,
        endDate: draft.endDate || null,
        active: 1,
      };
      if (editingId) {
        await api.promotions.update(editingId, payload);
      } else {
        await api.promotions.create(payload);
      }
      await loadPromos();
      cancelEdit();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(promo: Promotion) {
    try {
      await api.promotions.update(promo.id, { active: promo.active ? 0 : 1 });
      await loadPromos();
    } catch {
      setError('Failed to update');
    }
  }

  if (loading) return <div style={styles.loading}>Loading promotions...</div>;

  return (
    <div style={styles.container}>
      {error && <div style={styles.error}>{error}</div>}

      {promos.map((promo) => {
        const rules = parseRules(promo.rules);
        if (editingId === promo.id) {
          return (
            <div key={promo.id} style={styles.editForm}>
              <div style={styles.editGrid}>
                <Input label="Name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. 2 for $5 Special" />
                <Input label="Bundle Qty" type="number" min="2" value={draft.bundleQty} onChange={(e) => setDraft({ ...draft, bundleQty: e.target.value })} />
                <Input label="Bundle Price ($)" type="number" step="0.01" value={draft.bundlePrice} onChange={(e) => setDraft({ ...draft, bundlePrice: e.target.value })} />
                <Input label="Start Date" type="date" value={draft.startDate} onChange={(e) => setDraft({ ...draft, startDate: e.target.value })} />
                <Input label="End Date" type="date" value={draft.endDate} onChange={(e) => setDraft({ ...draft, endDate: e.target.value })} />
              </div>
              <div style={styles.editActions}>
                <Button variant="primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
                <Button variant="ghost" onClick={cancelEdit}>Cancel</Button>
              </div>
            </div>
          );
        }
        return (
          <div key={promo.id} style={{ ...styles.ruleRow, opacity: promo.active ? 1 : 0.5 }}>
            <div style={styles.ruleInfo}>
              <span style={styles.ruleName}>{promo.name}</span>
              <span style={styles.ruleDetails}>
                {rules.qty ?? '?'} for {rules.price ? formatCents(rules.price) : '?'}
                {promo.startDate && ` | ${promo.startDate}`}
                {promo.endDate && ` — ${promo.endDate}`}
              </span>
            </div>
            <div style={styles.ruleActions}>
              {!promo.active && <Badge variant="danger">Inactive</Badge>}
              <Button variant="secondary" onClick={() => startEditing(promo)}>Edit</Button>
              <Button variant="ghost" onClick={() => {
                if (promo.active) {
                  setDeactivateTarget(promo.id);
                  setConfirmDeactivate(true);
                } else {
                  toggleActive(promo);
                }
              }}>
                {promo.active ? 'Deactivate' : 'Reactivate'}
              </Button>
            </div>
          </div>
        );
      })}

      {promos.length === 0 && !showAdd && (
        <div style={styles.empty}>No promotions yet</div>
      )}

      {showAdd ? (
        <div style={styles.editForm}>
          <div style={styles.editGrid}>
            <Input label="Name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. 2 for $5 Special" autoFocus />
            <Input label="Bundle Qty" type="number" min="2" value={draft.bundleQty} onChange={(e) => setDraft({ ...draft, bundleQty: e.target.value })} />
            <Input label="Bundle Price ($)" type="number" step="0.01" value={draft.bundlePrice} onChange={(e) => setDraft({ ...draft, bundlePrice: e.target.value })} placeholder="5.00" />
            <Input label="Start Date" type="date" value={draft.startDate} onChange={(e) => setDraft({ ...draft, startDate: e.target.value })} />
            <Input label="End Date" type="date" value={draft.endDate} onChange={(e) => setDraft({ ...draft, endDate: e.target.value })} />
          </div>
          <div style={styles.editActions}>
            <Button variant="primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Create'}</Button>
            <Button variant="ghost" onClick={cancelEdit}>Cancel</Button>
          </div>
        </div>
      ) : (
        <Button variant="secondary" onClick={startAdding}>+ Add Promotion</Button>
      )}

      {/* Deactivate Confirmation */}
      <Modal isOpen={confirmDeactivate} onClose={() => setConfirmDeactivate(false)} title="Confirm Action">
        <p style={{ color: 'var(--text-primary)', margin: 0 }}>
          Deactivate this promotion?
        </p>
        <div style={{ display: 'flex', gap: 'var(--space-sm)', justifyContent: 'flex-end', marginTop: 'var(--space-md)' }}>
          <Button variant="secondary" onClick={() => setConfirmDeactivate(false)}>Cancel</Button>
          <Button variant="danger" onClick={() => {
            if (deactivateTarget) {
              const promo = promos.find((p) => p.id === deactivateTarget);
              if (promo) toggleActive(promo);
            }
            setConfirmDeactivate(false);
            setDeactivateTarget(null);
          }}>Deactivate</Button>
        </div>
      </Modal>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  container: { display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' },
  loading: { color: 'var(--text-muted)', fontStyle: 'italic', padding: 'var(--space-sm)' },
  error: { color: 'var(--crt-red)', fontSize: 'var(--font-size-sm)', padding: 'var(--space-xs)' },
  empty: { color: 'var(--text-muted)', fontStyle: 'italic', padding: 'var(--space-sm)', textAlign: 'center' },
  ruleRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '8px 12px', border: '1px solid var(--border-color)',
    borderRadius: 'var(--border-radius)', backgroundColor: 'var(--bg-panel)',
  },
  ruleInfo: { display: 'flex', flexDirection: 'column', gap: '2px' },
  ruleName: { color: 'var(--crt-amber)', fontSize: 'var(--font-size-md)', fontWeight: 'bold' },
  ruleDetails: { color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' },
  ruleActions: { display: 'flex', gap: 'var(--space-xs)', alignItems: 'center' },
  editForm: {
    display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)',
    padding: 'var(--space-sm)', border: '1px solid var(--crt-amber)',
    borderRadius: 'var(--border-radius)', backgroundColor: 'var(--bg-panel)',
  },
  editGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-sm)' },
  editActions: { display: 'flex', gap: 'var(--space-sm)', justifyContent: 'flex-end' },
};
