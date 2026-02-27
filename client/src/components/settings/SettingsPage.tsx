// ABOUTME: Settings page for configuring store info, financial rules, and integrations
// ABOUTME: Fetches key-value pairs from store_settings table and saves changes via API

import { type CSSProperties, useEffect, useState, useCallback } from 'react';
import { api } from '../../api/client';

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
    backgroundColor: 'rgba(85, 255, 255, 0.05)',
    border: '1px solid var(--crt-green-dim)',
  },
  feedbackError: {
    color: 'var(--crt-red)',
    backgroundColor: 'rgba(255, 51, 51, 0.05)',
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
    borderBottom: '1px solid rgba(85, 255, 255, 0.05)',
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

function handleInputFocus(e: React.FocusEvent<HTMLInputElement>) {
  e.currentTarget.style.borderColor = 'var(--crt-green)';
  e.currentTarget.style.boxShadow = '0 0 10px rgba(85, 255, 255, 0.3), 0 0 20px rgba(85, 255, 255, 0.1)';
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
  'tmdb_api_key',
] as const;

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

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Clear feedback after 4 seconds
  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => setFeedback(null), 4000);
    return () => clearTimeout(timer);
  }, [feedback]);

  function updateSetting(key: SettingsKey, value: string) {
    setSettings(prev => ({ ...prev, [key]: value }));
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
        <span style={styles.systemValue}>v0.1.0</span>
      </div>
      <div style={styles.systemRow}>
        <span style={styles.systemLabel}>Database</span>
        <span style={styles.systemValue}>SQLite (local)</span>
      </div>

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
            e.currentTarget.style.boxShadow = '0 0 10px rgba(85, 255, 255, 0.3), 0 0 20px rgba(85, 255, 255, 0.1)';
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
