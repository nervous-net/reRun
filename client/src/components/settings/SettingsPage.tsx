// ABOUTME: Settings page for configuring store info, financial rules, and integrations
// ABOUTME: Fetches key-value pairs from store_settings table and saves changes via API

import { type CSSProperties, useEffect, useState, useCallback } from 'react';
import { api } from '../../api/client';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';
import { UpdateModal } from '../common/UpdateModal';
import { PricingRulesManager } from './PricingRulesManager';
import { PromotionsManager } from './PromotionsManager';
import { HelpModal } from '../help/HelpModal';
import { DirectoryBrowser } from './DirectoryBrowser';
import { DangerZone } from './DangerZone';

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
  location?: string;
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
  'products_enabled',
  'return_by_hour',
  'tmdb_api_key',
  'theme',
  'dev_mode',
  'dev_date_offset',
  'setup_complete',
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
  const [confirmUpdate, setConfirmUpdate] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<string | null>(null);
  const [showAllBackups, setShowAllBackups] = useState(false);
  const [simulatedDate, setSimulatedDate] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [backupDirInput, setBackupDirInput] = useState('');
  const [backupDirSaving, setBackupDirSaving] = useState(false);
  const [backupDirError, setBackupDirError] = useState<string | null>(null);
  const [showDirBrowser, setShowDirBrowser] = useState(false);

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
      setBackupDirInput(data.backup_dir ?? '');
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

  const fetchDevTime = useCallback(async () => {
    try {
      const data = await api.settings.devTime();
      setSimulatedDate(data.effectiveDate);
    } catch {
      setSimulatedDate(null);
    }
  }, []);

  // Fetch dev time when settings load and dev_mode is on
  useEffect(() => {
    if (settings.dev_mode === '1') {
      fetchDevTime();
    } else {
      setSimulatedDate(null);
    }
  }, [settings.dev_mode, settings.dev_date_offset, fetchDevTime]);

  const handleSaveBackupDir = useCallback(async () => {
    setBackupDirSaving(true);
    setBackupDirError(null);
    try {
      let successMsg = 'Backup location reset to default';
      if (backupDirInput.trim()) {
        const verifyResult = await api.backup.verify(backupDirInput.trim());
        if (!verifyResult.valid) {
          setBackupDirError(verifyResult.error || 'Directory is not usable for backups');
          return;
        }
        successMsg = verifyResult.created ? 'Folder created and saved' : 'Backup location saved';
        if (verifyResult.warning) {
          successMsg += ` (${verifyResult.warning})`;
        }
      }
      await api.settings.update('backup_dir', backupDirInput.trim());
      setSettings((prev) => ({ ...prev, backup_dir: backupDirInput.trim() }));
      setOriginal((prev) => ({ ...prev, backup_dir: backupDirInput.trim() }));
      setFeedback({ type: 'success', message: successMsg });
      loadBackups();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save backup location';
      setBackupDirError(message);
      setFeedback({ type: 'error', message });
    } finally {
      setBackupDirSaving(false);
    }
  }, [backupDirInput, loadBackups]);

  const handleClearBackupDir = useCallback(async () => {
    setBackupDirInput('');
    setBackupDirError(null);
    try {
      await api.settings.update('backup_dir', '');
      setSettings((prev) => ({ ...prev, backup_dir: '' }));
      setOriginal((prev) => ({ ...prev, backup_dir: '' }));
      setFeedback({ type: 'success', message: 'Backup location reset to default' });
      loadBackups();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to reset backup location';
      setFeedback({ type: 'error', message });
    }
  }, [loadBackups]);

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
    setBackupAction(true);
    setFeedback(null);
    try {
      const targetBackup = backups.find(b => b.filename === filename);
      await api.backup.restore(filename, targetBackup?.location);
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
      const status = await api.update.check();
      setUpdateStatus(status);
    } catch {}
    setCheckingUpdate(false);
  }

  async function handleInstallUpdate() {
    setConfirmUpdate(false);
    setInstallingUpdate(true);
    try {
      await api.update.install();
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-lg)' }}>
        <div style={{ ...styles.pageTitle, marginBottom: 0 }}>SETTINGS</div>
        <Button variant="secondary" onClick={() => setShowHelp(true)}>Help &amp; Guide</Button>
      </div>

      <HelpModal isOpen={showHelp} onClose={() => setShowHelp(false)} />

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

      <div style={styles.fieldRow}>
        <label style={styles.label}>Product Sales</label>
        <select
          style={styles.input}
          value={settings.products_enabled ?? '1'}
          onChange={e => updateSetting('products_enabled', e.target.value)}
        >
          <option value="1">Enabled — Show inventory &amp; product sales</option>
          <option value="0">Disabled — Rentals only</option>
        </select>
        <div style={styles.hint}>
          Hides the Inventory section and product features when disabled
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
            aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
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
          <button onClick={() => setConfirmUpdate(true)} disabled={installingUpdate} style={{
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

      {/* Backup Location */}
      {settings.backup_fallback_warning === 'true' && (
        <div style={{
          border: '1px solid var(--crt-amber)',
          borderRadius: 'var(--border-radius)',
          padding: 'var(--space-xs) var(--space-sm)',
          marginBottom: 'var(--space-sm)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          color: 'var(--crt-amber)',
          fontSize: 'var(--font-size-sm)',
          fontFamily: 'var(--font-mono)',
        }}>
          <span>Backup location unavailable — using default location.</span>
          <button
            type="button"
            onClick={async () => {
              await api.settings.update('backup_fallback_warning', 'false');
              setSettings((prev) => ({ ...prev, backup_fallback_warning: 'false' }));
            }}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--crt-amber)',
              cursor: 'pointer',
              fontFamily: 'var(--font-mono)',
              padding: '0 4px',
            }}
            aria-label="Dismiss"
          >
            X
          </button>
        </div>
      )}

      <div style={{ marginBottom: 'var(--space-md)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', marginBottom: 'var(--space-xs)' }}>
          <input
            type="text"
            value={backupDirInput}
            onChange={(e) => { setBackupDirInput(e.target.value); setBackupDirError(null); }}
            placeholder="Default (./data/backups)"
            disabled={backupDirSaving}
            style={{
              ...styles.input,
              flex: 1,
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--font-size-sm)',
            }}
          />
          <button
            type="button"
            style={{ ...styles.toggleButton, whiteSpace: 'nowrap' }}
            onClick={() => setShowDirBrowser(true)}
            disabled={backupDirSaving}
          >
            Browse
          </button>
          <button
            type="button"
            style={{
              ...styles.toggleButton,
              whiteSpace: 'nowrap',
              ...(backupDirSaving ? { opacity: 0.4, cursor: 'not-allowed' } : {}),
            }}
            onClick={handleSaveBackupDir}
            disabled={backupDirSaving}
          >
            {backupDirSaving ? 'Saving...' : 'Save'}
          </button>
          {backupDirInput && (
            <button
              type="button"
              style={{ ...styles.toggleButton, whiteSpace: 'nowrap', color: 'var(--text-secondary)', borderColor: 'var(--text-secondary)' }}
              onClick={handleClearBackupDir}
              disabled={backupDirSaving}
            >
              Clear
            </button>
          )}
        </div>
        {backupDirError && (
          <div style={{ color: 'var(--crt-red)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-xs)' }}>
            {backupDirError}
          </div>
        )}
        <div style={styles.hint}>
          Choose a folder for backups. Leave empty to use the default location.
        </div>
      </div>

      <DirectoryBrowser
        isOpen={showDirBrowser}
        onClose={() => setShowDirBrowser(false)}
        onSelect={(p) => setBackupDirInput(p)}
        initialPath={backupDirInput || undefined}
      />

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
            e.currentTarget.style.boxShadow = 'none';
            e.currentTarget.style.borderColor = 'var(--crt-green)';
            e.currentTarget.style.color = 'var(--crt-green)';
          }}
        >
          {backupAction ? 'Working...' : 'Create Backup'}
        </button>
      </div>

      {backupsLoading && (
        <div style={styles.hint}>Loading backups...</div>
      )}

      {!backupsLoading && backups.length === 0 && (
        <div style={styles.hint}>No backups found. Auto-backup creates one daily (keeps last 30).</div>
      )}

      {/* Most recent backup */}
      {!backupsLoading && backups.length > 0 && (
        <>
          <div style={styles.systemRow}>
            <div>
              <span style={styles.systemLabel}>{backups[0].filename}</span>
              <span style={{ ...styles.hint, marginLeft: 'var(--space-sm)' }}>
                {formatFileSize(backups[0].size)} &mdash; {new Date(backups[0].createdAt).toLocaleString()}
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
              onClick={() => { setRestoreTarget(backups[0].filename); setConfirmRestore(true); }}
            >
              Restore
            </button>
          </div>

          {/* Expanded list of older backups */}
          {showAllBackups && backups.slice(1).map(backup => (
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
                onClick={() => { setRestoreTarget(backup.filename); setConfirmRestore(true); }}
              >
                Restore
              </button>
            </div>
          ))}

          {/* Show All / Hide toggle */}
          {backups.length > 1 && (
            <button
              type="button"
              style={{
                ...styles.toggleButton,
                marginTop: 'var(--space-xs)',
                color: 'var(--text-secondary)',
                borderColor: 'var(--border-color)',
              }}
              onClick={() => setShowAllBackups(!showAllBackups)}
            >
              {showAllBackups ? 'Hide Older Backups' : `Show All Backups (${backups.length})`}
            </button>
          )}
        </>
      )}

      {/* Developer Tools */}
      <div style={styles.sectionHeader}>Developer Tools</div>

      <div style={styles.fieldRow}>
        <label style={styles.label}>Dev Mode</label>
        <select
          style={styles.input}
          value={settings.dev_mode ?? '0'}
          onChange={e => updateSetting('dev_mode', e.target.value)}
        >
          <option value="0">Off</option>
          <option value="1">On — Enable date override for testing</option>
        </select>
        <div style={styles.hint}>
          When enabled, business logic uses simulated date instead of real time
        </div>
      </div>

      {settings.dev_mode === '1' && (
        <>
          <div style={styles.fieldRow}>
            <label style={styles.label}>Date Offset (days)</label>
            <div style={{ display: 'flex', gap: 'var(--space-xs)', alignItems: 'center' }}>
              <button
                type="button"
                style={styles.toggleButton}
                onClick={() => updateSetting('dev_date_offset', String(Number(settings.dev_date_offset || '0') - 1))}
              >
                -1
              </button>
              <input
                style={{ ...styles.input, flex: 1, textAlign: 'center' as const }}
                type="number"
                value={settings.dev_date_offset ?? '0'}
                onChange={e => updateSetting('dev_date_offset', e.target.value)}
                onFocus={handleInputFocus}
                onBlur={handleInputBlur}
              />
              <button
                type="button"
                style={styles.toggleButton}
                onClick={() => updateSetting('dev_date_offset', String(Number(settings.dev_date_offset || '0') + 1))}
              >
                +1
              </button>
            </div>
            <div style={styles.hint}>
              Positive = future, negative = past. Shifts system date for rentals, alerts, etc.
            </div>
          </div>
          {simulatedDate && (
            <div style={styles.systemRow}>
              <span style={styles.systemLabel}>Simulated Date</span>
              <span style={styles.systemValue}>
                {new Date(simulatedDate).toLocaleDateString()} {new Date(simulatedDate).toLocaleTimeString()}
              </span>
            </div>
          )}
        </>
      )}

      <DangerZone />

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
          e.currentTarget.style.boxShadow = 'none';
          e.currentTarget.style.borderColor = 'var(--crt-green)';
          e.currentTarget.style.color = 'var(--crt-green)';
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

      {/* Install Update Confirmation */}
      <Modal isOpen={confirmUpdate} onClose={() => setConfirmUpdate(false)} title="Confirm Action">
        <p style={{ color: 'var(--text-primary)', margin: 0 }}>
          Install update and restart the system? The app will reload.
        </p>
        <div style={{ display: 'flex', gap: 'var(--space-sm)', justifyContent: 'flex-end', marginTop: 'var(--space-md)' }}>
          <Button variant="secondary" onClick={() => setConfirmUpdate(false)}>Cancel</Button>
          <Button variant="danger" onClick={handleInstallUpdate}>Install Update</Button>
        </div>
      </Modal>

      <UpdateModal
        isOpen={installingUpdate}
        version={updateStatus?.availableUpdate?.version ?? ''}
        previousVersion={updateStatus?.currentVersion ?? ''}
      />

      {/* Restore Backup Confirmation */}
      <Modal isOpen={confirmRestore} onClose={() => setConfirmRestore(false)} title="Confirm Action">
        <p style={{ color: 'var(--text-primary)', margin: 0 }}>
          Restore from this backup? Current data will be replaced.
        </p>
        <div style={{ display: 'flex', gap: 'var(--space-sm)', justifyContent: 'flex-end', marginTop: 'var(--space-md)' }}>
          <Button variant="secondary" onClick={() => setConfirmRestore(false)}>Cancel</Button>
          <Button variant="danger" onClick={() => { if (restoreTarget) handleRestore(restoreTarget); setConfirmRestore(false); setRestoreTarget(null); }}>Restore</Button>
        </div>
      </Modal>
    </div>
  );
}
