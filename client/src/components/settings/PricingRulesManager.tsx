// ABOUTME: Pricing rules management UI for creating, editing, and deactivating rental types
// ABOUTME: Used in Settings page to configure rates, rental duration, and late fees per rule

import { type CSSProperties, useCallback, useEffect, useState } from 'react';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Badge } from '../common/Badge';
import { api } from '../../api/client';

interface PricingRule {
  id: string;
  name: string;
  type: string;
  rate: number;
  durationDays: number;
  lateFeePerDay: number;
  active: number;
}

interface EditingRule {
  name: string;
  type: string;
  rate: string;
  durationDays: string;
  lateFeePerDay: string;
}

const emptyRule: EditingRule = {
  name: '',
  type: 'rental',
  rate: '',
  durationDays: '4',
  lateFeePerDay: '25',
};

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function PricingRulesManager() {
  const [rules, setRules] = useState<PricingRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EditingRule>(emptyRule);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRules = useCallback(async () => {
    try {
      const data = await api.pricing.list();
      const list = Array.isArray(data) ? data : data.data ?? [];
      setRules(list);
    } catch {
      setError('Failed to load pricing rules');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  function startEditing(rule: PricingRule) {
    setEditingId(rule.id);
    setDraft({
      name: rule.name,
      type: rule.type,
      rate: (rule.rate / 100).toFixed(2),
      durationDays: String(rule.durationDays),
      lateFeePerDay: String(rule.lateFeePerDay),
    });
    setShowAdd(false);
  }

  function startAdding() {
    setEditingId(null);
    setDraft({ ...emptyRule });
    setShowAdd(true);
  }

  function cancelEdit() {
    setEditingId(null);
    setShowAdd(false);
    setDraft({ ...emptyRule });
  }

  async function handleSave() {
    if (!draft.name.trim()) {
      setError('Name is required');
      return;
    }
    const rateCents = Math.round(parseFloat(draft.rate || '0') * 100);
    if (rateCents <= 0) {
      setError('Rate must be greater than $0');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: draft.name.trim(),
        type: draft.type,
        rate: rateCents,
        durationDays: parseInt(draft.durationDays, 10) || 4,
        lateFeePerDay: parseInt(draft.lateFeePerDay, 10) || 0,
        active: 1,
      };

      if (editingId) {
        await api.pricing.update(editingId, payload);
      } else {
        await api.pricing.create(payload);
      }

      await loadRules();
      cancelEdit();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(rule: PricingRule) {
    try {
      await api.pricing.update(rule.id, { active: rule.active ? 0 : 1 });
      await loadRules();
    } catch {
      setError('Failed to update rule');
    }
  }

  if (loading) {
    return <div style={styles.loading}>Loading pricing rules...</div>;
  }

  const activeRules = rules.filter((r) => r.active);
  const inactiveRules = rules.filter((r) => !r.active);

  return (
    <div style={styles.container}>
      {error && (
        <div style={styles.error}>{error}</div>
      )}

      {/* Active rules list */}
      {activeRules.map((rule) => (
        editingId === rule.id ? (
          <div key={rule.id} style={styles.editForm}>
            <div style={styles.editGrid}>
              <Input label="Name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. Standard 4-Night" />
              <Input label="Rate ($)" type="number" step="0.01" min="0" value={draft.rate} onChange={(e) => setDraft({ ...draft, rate: e.target.value })} placeholder="3.00" />
              <Input label="Duration (nights)" type="number" min="1" value={draft.durationDays} onChange={(e) => setDraft({ ...draft, durationDays: e.target.value })} />
              <Input label="Late Fee/Day (cents)" type="number" min="0" value={draft.lateFeePerDay} onChange={(e) => setDraft({ ...draft, lateFeePerDay: e.target.value })} placeholder="25" />
            </div>
            <div style={styles.editActions}>
              <Button variant="primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
              <Button variant="ghost" onClick={cancelEdit}>Cancel</Button>
            </div>
          </div>
        ) : (
          <div key={rule.id} style={styles.ruleRow}>
            <div style={styles.ruleInfo}>
              <span style={styles.ruleName}>{rule.name}</span>
              <span style={styles.ruleDetails}>
                {formatCents(rule.rate)} / {rule.durationDays} nights | Late: {formatCents(rule.lateFeePerDay)}/day
              </span>
            </div>
            <div style={styles.ruleActions}>
              <Button variant="secondary" onClick={() => startEditing(rule)}>Edit</Button>
              <Button variant="ghost" onClick={() => toggleActive(rule)}>Deactivate</Button>
            </div>
          </div>
        )
      ))}

      {/* Inactive rules */}
      {inactiveRules.length > 0 && (
        <div style={styles.inactiveSection}>
          <div style={styles.inactiveLabel}>Inactive</div>
          {inactiveRules.map((rule) => (
            <div key={rule.id} style={{ ...styles.ruleRow, opacity: 0.5 }}>
              <div style={styles.ruleInfo}>
                <span style={styles.ruleName}>{rule.name}</span>
                <Badge variant="danger">Inactive</Badge>
              </div>
              <Button variant="ghost" onClick={() => toggleActive(rule)}>Reactivate</Button>
            </div>
          ))}
        </div>
      )}

      {/* Add new rule form */}
      {showAdd ? (
        <div style={styles.editForm}>
          <div style={styles.editGrid}>
            <Input label="Name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. Kids Special" autoFocus />
            <Input label="Rate ($)" type="number" step="0.01" min="0" value={draft.rate} onChange={(e) => setDraft({ ...draft, rate: e.target.value })} placeholder="2.00" />
            <Input label="Duration (nights)" type="number" min="1" value={draft.durationDays} onChange={(e) => setDraft({ ...draft, durationDays: e.target.value })} />
            <Input label="Late Fee/Day (cents)" type="number" min="0" value={draft.lateFeePerDay} onChange={(e) => setDraft({ ...draft, lateFeePerDay: e.target.value })} placeholder="25" />
          </div>
          <div style={styles.editActions}>
            <Button variant="primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Create'}</Button>
            <Button variant="ghost" onClick={cancelEdit}>Cancel</Button>
          </div>
        </div>
      ) : (
        <Button variant="secondary" onClick={startAdding}>+ Add Pricing Rule</Button>
      )}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-sm)',
  },
  loading: {
    color: 'var(--text-muted)',
    fontStyle: 'italic',
    padding: 'var(--space-sm)',
  },
  error: {
    color: 'var(--crt-red)',
    fontSize: 'var(--font-size-sm)',
    padding: 'var(--space-xs)',
  },
  ruleRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 12px',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--border-radius)',
    backgroundColor: 'var(--bg-panel)',
  },
  ruleInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  ruleName: {
    color: 'var(--crt-green)',
    fontSize: 'var(--font-size-md)',
    fontWeight: 'bold',
  },
  ruleDetails: {
    color: 'var(--text-secondary)',
    fontSize: 'var(--font-size-sm)',
  },
  ruleActions: {
    display: 'flex',
    gap: 'var(--space-xs)',
  },
  editForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-sm)',
    padding: 'var(--space-sm)',
    border: '1px solid var(--crt-green)',
    borderRadius: 'var(--border-radius)',
    backgroundColor: 'var(--bg-panel)',
  },
  editGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 'var(--space-sm)',
  },
  editActions: {
    display: 'flex',
    gap: 'var(--space-sm)',
    justifyContent: 'flex-end',
  },
  inactiveSection: {
    marginTop: 'var(--space-sm)',
  },
  inactiveLabel: {
    color: 'var(--text-muted)',
    fontSize: 'var(--font-size-sm)',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    marginBottom: 'var(--space-xs)',
  },
};
