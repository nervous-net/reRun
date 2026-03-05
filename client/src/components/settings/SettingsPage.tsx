// ABOUTME: Settings page for configuring store info, financial rules, and integrations
// ABOUTME: Fetches key-value pairs from store_settings table and saves changes via API

import { type CSSProperties, useEffect, useState, useCallback } from 'react';
import { api } from '../../api/client';
import { PricingRulesManager } from './PricingRulesManager';
import { PromotionsManager } from './PromotionsManager';

// --- Types ---

interface SettingsMap {
  [key: string]: string;
}

// --- Styles ---

const styles: Record<string, CSSProperties> = {
  container: {
    padding: 'var(--space-md)',
    maxWidth: '600px',
    height: '100%',
    overflowY: 'auto',
  },
  pageTitle: {
    color: 'var(--crt-green)',
    textShadow: 'var(--glow-green)',
    fontSize: 'var(--font-size-xl)',
    fontFamily: 'var(--font-mono)',
    letterSpacing: '2px',
    marginBottom: 'var(--space-lg)',
  },
  sectionHeader: {
    color: 'var(--crt-amber)',
    textShadow: 'var(--glow-amber)',
    fontSize: 'var(--font-size-lg)',
    fontFamily: 'var(--font-mono)',
    letterSpacing: '1px',
    marginTop: 'var(--space-lg)',
    marginBottom: 'var(--space-md)',
    borderBottom: '1px solid var(--border-color)',
    paddingBottom: 'var(--space-xs)',
  },
  fieldRow: {
    marginBottom: 'var(--space-md)',
  },
  label: {
    display: 'block',
    color: 'var(--text-secondary)',
    fontSize: 'var(--font-size-sm)',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    marginBottom: 'var(--space-xs)',
  },
  input: {
    fontFamily: 'inherit',
    fontSize: 'var(--font-size-md)',
    padding: '6px 8px',
    backgroundColor: 'var(--bg-input)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--border-radius)',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box' as const,
    transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
  },
  passwordRow: {
    display: 'flex',
    gap: 'var(--space-xs)',
    alignItems: 'stretch',
  },
  toggleButton: {
    fontFamily: 'inherit',
    fontSize: 'var(--font-size-sm)',
    padding: '4px 8px',
    backgroundColor: 'transparent',
    color: 'var(--crt-green-dim)',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--border-radius)',
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
    transition: 'border-color 0.15s ease, color 0.15s ease',
  },
  saveButton: {
    fontFamily: 'inherit',
    fontSize: 'var(--font-size-md)',
    padding: '8px 24px',
    backgroundColor: 'transparent',
    color: 'var(--crt-green)',
    border: '1px solid var(--crt-green)',
    borderRadius: 'var(--border-radius)',
    cursor: 'pointer',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    marginTop: 'var(--space-lg)',
    transition: 'box-shadow 0.15s ease, border-color 0.15s ease, color 0.15s ease',
  },
  saveButtonDisabled: {
    opacity: 0.4,
    cursor: 'not-allowed',
  },
  feedback: {
    fontSize: 'var(--font-size-sm)',
    marginTop: 'var(--space-sm)',
    padding: 'var(--space-xs) var(--space-sm)',
    borderRadius: 'var(--border-radius)',
    transition: 'opacity 0.3s ease',
  },
  feedbackSuccess: {
    color: 'var(--crt-green)',
    backgroundColor: 'var(--accent-05)',
    border: '1px solid var(--crt-green-dim)',
  },
  feedbackError: {
    color: 'var(--crt-red)',
    backgroundColor: 'var(--error-05)',
    border: '1px solid var(--crt-red)',
  },
  loading: {
    color: 'var(--crt-green)',
    textShadow: 'var(--glow-green)',
    fontSize: 'var(--font-size-md)',
    padding: 'var(--space-lg)',
    textAlign: 'center' as const,
    fontFamily: 'var(--font-mono)',
  },
  error: {
    color: 'var(--crt-red)',
    fontSize: 'var(--font-size-md)',
    padding: 'var(--space-lg)',
    textAlign: 'center' as const,
  },
  systemRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '4px 0',
    borderBottom: '1px solid var(--accent-05)',
    fontSize: 'var(--font-size-md)',
  },
  systemLabel: {
    color: 'var(--text-secondary)',
  },
  systemValue: {
    color: 'var(--crt-green)',
    textShadow: 'var(--glow-green)',
  },
  hint: {
    color: 'var(--text-muted)',
    fontSize: 'var(--font-size-sm)',
    marginTop: '2px',
  },
};

// --- Helpers ---

function basisPointsToPercent(bp: string): string {
  const num = parseInt(bp, 10);
  if (isNaN(num)) return '';
  return (num / 100).toFixed(2);
}

function percentToBasisPoints(pct: string): string {
  const num = parseFloat(pct);
  if (isNaN(num)) return '0';
  return Math.round(num * 100).toString();
}

interface BackupEntry {
  filename: string;
  size: number;
  createdAt: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function handleInputFocus(e: React.FocusEvent<HTMLInputElement>) {
  e.currentTarget.style.borderColor = 'var(--crt-green)';
  e.currentTarget.style.boxShadow = '0 0 10px var(--accent-30), 0 0 20px var(--accent-10)';
}

function handleInputBlur(e: React.FocusEvent<HTMLInputElement>) {
  e.currentTarget.style.borderColor = 'var(--border-color)';
  e.currentTarget.style.boxShadow = 'none';
}

// --- Settings keys ---

const SETTINGS_KEYS = [
  'store_name',
  'store_phone',
  'store_address',
  'tax_rate',
  'late_fee_grace_period',
  'max_active_rentals',
  'max_family_members',
  'age_check_enabled',
  'return_by_hour',
  'tmdb_api_key',
  'theme',
] as const;

const THEME_OPTIONS = [
  { value: 'a', label: 'A \u2014 Borland Turbo Vision' },
  { value: 'b', label: 'B \u2014 Norton Commander' },
  { value: 'c', label: 'C \u2014 WordPerfect 5.1' },
  { value: 'd', label: 'D \u2014 Lotus 1-2-3' },
  { value: 'e', label: 'E \u2014 Classic POS Terminal' },
  { value: 'f', label: 'F \u2014 Hybrid CRT (Default)' },
];

type SettingsKey = typeof SETTINGS_KEYS[number];

// --- Component ---

export function SettingsPage() {
  const [settings, setSettings] = useState<SettingsMap>({});
  const [original, setOriginal] = useState<SettingsMap>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [backups, setBackups] = useState<BackupEntry[]>([]);
  const [backupsLoading, setBackupsLoading] = useState(false);
  const [backupAction, setBackupAction] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<any>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [installingUpdate, setInstallingUpdate] = useState(false);

  // Tax rate is displayed as percentage but stored as basis points
  const [taxDisplay, setTaxDisplay] = useState('');

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const response = await api.settings.list();
      const data: SettingsMap = response?.data ?? {};
      setSettings(data);
      setOriginal(data);
      setTaxDisplay(data.tax_rate ? basisPointsToPercent(data.tax_rate) : '');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load settings';
      setLoadError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadBackups = useCallback(async () => {
    setBackupsLoading(true);
    try {
      const response = await api.backup.list();
      setBackups(response?.backups ?? []);
    } catch {
      // Silently fail — backup list is non-critical
    } finally {
      setBackupsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    loadBackups();
  }, [loadBackups]);

  useEffect(() => {
    api.update.status().then(setUpdateStatus).catch(() => {});
  }, []);

  // Clear feedback after 4 seconds
  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => setFeedback(null), 4000);
    return () => clearTimeout(timer);
  }, [feedback]);

  function updateSetting(key: SettingsKey, value: string) {
    setSettings(prev => ({ ...prev, [key]: value }));
  }

  function handleThemeChange(value: string) {
    updateSetting('theme', value);
    // Live preview: apply theme class immediately
    if (value && value !== 'f') {
      document.documentElement.className = `theme-${value}`;
    } else {
      document.documentElement.className = '';
    }
  }

  function handleTaxChange(value: string) {
    setTaxDisplay(value);
    updateSetting('tax_rate', percentToBasisPoints(value));
  }

  async function handleSave() {
    setSaving(true);
    setFeedback(null);

    try {
      // Find changed keys
      const changedKeys = SETTINGS_KEYS.filter(
        key => (settings[key] ?? '') !== (original[key] ?? '')
      );

      if (changedKeys.length === 0) {
        setFeedback({ type: 'success', message: 'No changes to save.' });
        setSaving(false);
        return;
      }

      // Save all changed settings
      await Promise.all(
        changedKeys.map(key => api.settings.update(key, settings[key] ?? ''))
      );

      setOriginal({ ...settings });
      setFeedback({ type: 'success', message: `Saved ${changedKeys.length} setting${changedKeys.length > 1 ? 's' : ''}.` });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save settings';
      setFeedback({ type: 'error', message });
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateBackup() {
    setBackupAction(true);
    setFeedback(null);
    try {
      await api.backup.create();
      await loadBackups();
      setFeedback({ type: 'success', message: 'Backup created successfully.' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create backup';
      setFeedback({ type: 'error', message });
    } finally {
      setBackupAction(false);
    }
  }

  async function handleRestore(filename: string) {
    const confirmed = window.confirm(
      'This will replace the current database and require a restart. Are you sure?'
    );
    if (!confirmed) return;

    setBackupAction(true);
    setFeedback(null);
    try {
      await api.backup.restore(filename);
      setFeedback({ type: 'success', message: 'Backup restored. A restart is required for changes to take effect.' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to restore backup';
      setFeedback({ type: 'error', message });
    } finally {
      setBackupAction(false);
    }
  }

  async function handleCheckUpdate() {
    setCheckingUpdate(true);
    try {
      const status = await api.update.status();
      setUpdateStatus(status);
    } catch {}
    setCheckingUpdate(false);
  }

  async function handleInstallUpdate() {
    setInstallingUpdate(true);
    try {
      await api.update.install();
      // Poll health endpoint until server comes back
      const poll = setInterval(async () => {
        try {
          const res = await fetch('/api/health');
          if (res.ok) {
            clearInterval(poll);
            window.location.reload();
          }
        } catch {}
      }, 3000);
    } catch {
      setInstallingUpdate(false);
    }
  }

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading} data-testid="settings-loading">Loading settings...</div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div style={styles.container}>
        <div style={styles.error}>Error: {loadError}</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.pageTitle}>SETTINGS</div>

      {/* Appearance */}
      <div style={styles.sectionHeader}>Appearance</div>

      <div style={styles.fieldRow}>
        <label style={styles.label}>Theme</label>
        <select
          style={styles.input}
          value={settings.theme || 'f'}
          onChange={e => handleThemeChange(e.target.value)}
          data-testid="theme-select"
        >
          {THEME_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <div style={styles.hint}>
          Preview each theme at /option-a through /option-f
        </div>
      </div>

      {/* Store Information */}
      <div style={styles.sectionHeader}>Store Information</div>

      <div style={styles.fieldRow}>
        <label style={styles.label}>Store Name</label>
        <input
          style={styles.input}
          type="text"
          value={settings.store_name ?? ''}
          placeholder="reRun Video"
          onChange={e => updateSetting('store_name', e.target.value)}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
        />
      </div>

      <div style={styles.fieldRow}>
        <label style={styles.label}>Phone Number</label>
        <input
          style={styles.input}
          type="text"
          value={settings.store_phone ?? ''}
          placeholder="(555) 555-1234"
          onChange={e => updateSetting('store_phone', e.target.value)}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
        />
      </div>

      <div style={styles.fieldRow}>
        <label style={styles.label}>Address</label>
        <input
          style={styles.input}
          type="text"
          value={settings.store_address ?? ''}
          placeholder="123 Main St"
          onChange={e => updateSetting('store_address', e.target.value)}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
        />
      </div>

      {/* Financial */}
      <div style={styles.sectionHeader}>Financial</div>

      <div style={styles.fieldRow}>
        <label style={styles.label}>Tax Rate (%)</label>
        <input
          style={styles.input}
          type="number"
          step="0.01"
          min="0"
          max="100"
          value={taxDisplay}
          placeholder="8.00"
          onChange={e => handleTaxChange(e.target.value)}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
        />
        <div style={styles.hint}>
          Stored as {settings.tax_rate || '0'} basis points
        </div>
      </div>

      <div style={styles.fieldRow}>
        <label style={styles.label}>Late Fee Grace Period (days)</label>
        <input
          style={styles.input}
          type="number"
          min="0"
          value={settings.late_fee_grace_period ?? ''}
          placeholder="1"
          onChange={e => updateSetting('late_fee_grace_period', e.target.value)}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
        />
      </div>

      {/* Pricing Rules / Rental Types */}
      <div style={styles.sectionHeader}>Rental Types &amp; Pricing</div>
      <PricingRulesManager />

      {/* Promotions */}
      <div style={styles.sectionHeader}>Promotions &amp; Deals</div>
      <PromotionsManager />

      {/* Rental Policies */}
      <div style={styles.sectionHeader}>Rental Policies</div>

      <div style={styles.fieldRow}>
        <label style={styles.label}>Max Active Rentals (per family)</label>
        <input
          style={styles.input}
          type="number"
          min="1"
          max="50"
          value={settings.max_active_rentals ?? ''}
          placeholder="6"
          onChange={e => updateSetting('max_active_rentals', e.target.value)}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
        />
        <div style={styles.hint}>
          Maximum movies a customer can have checked out at once
        </div>
      </div>

      <div style={styles.fieldRow}>
        <label style={styles.label}>Return By Hour (24h format)</label>
        <input
          style={styles.input}
          type="number"
          min="0"
          max="23"
          value={settings.return_by_hour ?? ''}
          placeholder="12"
          onChange={e => updateSetting('return_by_hour', e.target.value)}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
        />
        <div style={styles.hint}>
          12 = noon. Late fees start after this hour on the due date.
        </div>
      </div>

      <div style={styles.fieldRow}>
        <label style={styles.label}>Max Family Members</label>
        <input
          style={styles.input}
          type="number"
          min="1"
          max="20"
          value={settings.max_family_members ?? ''}
          placeholder="6"
          onChange={e => updateSetting('max_family_members', e.target.value)}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
        />
      </div>

      <div style={styles.fieldRow}>
        <label style={styles.label}>Age Check for Rated Content</label>
        <select
          style={styles.input}
          value={settings.age_check_enabled ?? '1'}
          onChange={e => updateSetting('age_check_enabled', e.target.value)}
        >
          <option value="1">Enabled — Warn on R/NC-17 for minors</option>
          <option value="0">Disabled</option>
        </select>
        <div style={styles.hint}>
          Shows warning when renting R or NC-17 rated content to customers under 17
        </div>
      </div>

      {/* Integration */}
      <div style={styles.sectionHeader}>Integration</div>

      <div style={styles.fieldRow}>
        <label style={styles.label}>TMDb API Key</label>
        <div style={styles.passwordRow}>
          <input
            style={{ ...styles.input, flex: 1 }}
            type={showApiKey ? 'text' : 'password'}
            value={settings.tmdb_api_key ?? ''}
            placeholder="Enter TMDb API key"
            onChange={e => updateSetting('tmdb_api_key', e.target.value)}
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
          />
          <button
            type="button"
            style={styles.toggleButton}
            onClick={() => setShowApiKey(prev => !prev)}
          >
            {showApiKey ? 'HIDE' : 'SHOW'}
          </button>
        </div>
      </div>

      {/* System */}
      <div style={styles.sectionHeader}>System</div>

      <div style={styles.systemRow}>
        <span style={styles.systemLabel}>Version</span>
        <span style={styles.systemValue}>v{updateStatus?.currentVersion ?? '...'}</span>
      </div>
      <div style={styles.systemRow}>
        <span style={styles.systemLabel}>Database</span>
        <span style={styles.systemValue}>SQLite (local)</span>
      </div>
      <div style={styles.systemRow}>
        <span style={styles.systemLabel}>Update Status</span>
        <span style={styles.systemValue}>
          {updateStatus?.availableUpdate
            ? `v${updateStatus.availableUpdate.version} available`
            : 'Up to date'}
        </span>
      </div>
      {updateStatus?.lastChecked && (
        <div style={styles.systemRow}>
          <span style={styles.systemLabel}>Last Checked</span>
          <span style={{ ...styles.systemValue, fontSize: 'var(--font-size-sm)' }}>
            {new Date(updateStatus.lastChecked).toLocaleString()}
          </span>
        </div>
      )}
      <div style={{ display: 'flex', gap: 'var(--space-sm)', marginTop: 'var(--space-sm)' }}>
        <button onClick={handleCheckUpdate} disabled={checkingUpdate} style={styles.toggleButton}>
          {checkingUpdate ? 'Checking...' : 'Check for Updates'}
        </button>
        {updateStatus?.availableUpdate && (
          <button onClick={handleInstallUpdate} disabled={installingUpdate} style={{
            ...styles.toggleButton,
            color: 'var(--crt-amber)',
            borderColor: 'var(--crt-amber)',
          }}>
            {installingUpdate ? 'Installing...' : 'Install Update'}
          </button>
        )}
      </div>

      {/* Backup */}
      <div style={styles.sectionHeader}>Backup &amp; Restore</div>

      <div style={{ marginBottom: 'var(--space-md)' }}>
        <button
          type="button"
          style={{
            ...styles.saveButton,
            marginTop: 0,
            ...(backupAction ? styles.saveButtonDisabled : {}),
          }}
          disabled={backupAction}
          onClick={handleCreateBackup}
          onMouseEnter={e => {
            if (!backupAction) {
              e.currentTarget.style.boxShadow = '0 0 10px var(--accent-30), 0 0 20px var(--accent-10)';
              e.currentTarget.style.borderColor = 'var(--crt-green-bright)';
              e.currentTarget.style.color = 'var(--crt-green-bright)';
            }
          }}
          onMouseLeave={e => {
            e.currentTarget.style.boxShadow = '';
            e.currentTarget.style.borderColor = '';
            e.currentTarget.style.color = '';
          }}
        >
          {backupAction ? 'Working...' : 'Create Backup'}
        </button>
      </div>

      {backupsLoading && (
        <div style={styles.hint}>Loading backups...</div>
      )}

      {!backupsLoading && backups.length === 0 && (
        <div style={styles.hint}>No backups found.</div>
      )}

      {!backupsLoading && backups.map(backup => (
        <div key={backup.filename} style={styles.systemRow}>
          <div>
            <span style={styles.systemLabel}>{backup.filename}</span>
            <span style={{ ...styles.hint, marginLeft: 'var(--space-sm)' }}>
              {formatFileSize(backup.size)} &mdash; {new Date(backup.createdAt).toLocaleString()}
            </span>
          </div>
          <button
            type="button"
            style={{
              ...styles.toggleButton,
              color: 'var(--crt-amber)',
              borderColor: 'var(--crt-amber)',
            }}
            disabled={backupAction}
            onClick={() => handleRestore(backup.filename)}
          >
            Restore
          </button>
        </div>
      ))}

      {/* Save Button */}
      <button
        type="button"
        style={{
          ...styles.saveButton,
          ...(saving ? styles.saveButtonDisabled : {}),
        }}
        disabled={saving}
        onClick={handleSave}
        onMouseEnter={e => {
          if (!saving) {
            e.currentTarget.style.boxShadow = '0 0 10px var(--accent-30), 0 0 20px var(--accent-10)';
            e.currentTarget.style.borderColor = 'var(--crt-green-bright)';
            e.currentTarget.style.color = 'var(--crt-green-bright)';
          }
        }}
        onMouseLeave={e => {
          e.currentTarget.style.boxShadow = '';
          e.currentTarget.style.borderColor = '';
          e.currentTarget.style.color = '';
        }}
      >
        {saving ? 'Saving...' : 'Save Settings'}
      </button>

      {/* Feedback */}
      {feedback && (
        <div
          style={{
            ...styles.feedback,
            ...(feedback.type === 'success' ? styles.feedbackSuccess : styles.feedbackError),
          }}
          data-testid="settings-feedback"
        >
          {feedback.message}
        </div>
      )}
    </div>
  );
}
