// ABOUTME: Tests for the Settings page component
// ABOUTME: Validates section rendering, loading state, and display of fetched settings

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SettingsPage } from '../../../../client/src/components/settings/SettingsPage';

function mockFetch(settingsData: Record<string, string> = {}) {
  return (url: string) => {
    if (url.includes('/api/pricing')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: [] }),
      });
    }
    if (url.includes('/api/promotions')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: [] }),
      });
    }
    if (url.includes('/api/update/status')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          currentVersion: '0.1.0',
          availableUpdate: null,
          lastChecked: null,
          updating: false,
        }),
      });
    }
    if (url.includes('/api/backup/list')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ backups: [] }),
      });
    }
    // Default: settings endpoint
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: settingsData }),
    });
  };
}

describe('SettingsPage', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows loading state initially', () => {
    // Never resolve the fetch so we stay in loading
    fetchSpy.mockReturnValue(new Promise(() => {}));

    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    );

    expect(screen.getByTestId('settings-loading')).toBeDefined();
    expect(screen.getByText('Loading settings...')).toBeDefined();
  });

  it('renders all settings sections after loading', async () => {
    fetchSpy.mockImplementation(mockFetch({}));

    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Store Information')).toBeDefined();
    });

    expect(screen.getByText('Financial')).toBeDefined();
    expect(screen.getByText('Integration')).toBeDefined();
    expect(screen.getByText('System')).toBeDefined();
  });

  it('displays fetched settings values in form fields', async () => {
    fetchSpy.mockImplementation(
      mockFetch({
        store_name: 'Mondo Video',
        store_phone: '555-0199',
        store_address: '42 Tape Lane',
        tax_rate: '925',
        late_fee_grace_period: '3',
        tmdb_api_key: 'abc123secret',
      })
    );

    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Store Information')).toBeDefined();
    });

    // Check store name field
    const storeNameInput = screen.getByDisplayValue('Mondo Video') as HTMLInputElement;
    expect(storeNameInput).toBeDefined();
    expect(storeNameInput.value).toBe('Mondo Video');

    // Check phone
    const phoneInput = screen.getByDisplayValue('555-0199') as HTMLInputElement;
    expect(phoneInput).toBeDefined();

    // Check address
    const addressInput = screen.getByDisplayValue('42 Tape Lane') as HTMLInputElement;
    expect(addressInput).toBeDefined();

    // Check tax rate displays as percentage (925 basis points = 9.25%)
    const taxInput = screen.getByDisplayValue('9.25') as HTMLInputElement;
    expect(taxInput).toBeDefined();

    // Check grace period
    const graceInput = screen.getByDisplayValue('3') as HTMLInputElement;
    expect(graceInput).toBeDefined();
  });

  it('displays system information', async () => {
    fetchSpy.mockImplementation(mockFetch({}));

    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('System')).toBeDefined();
    });

    expect(screen.getByText('v0.1.0')).toBeDefined();
    expect(screen.getByText('SQLite (local)')).toBeDefined();
  });

  it('renders the save button', async () => {
    fetchSpy.mockImplementation(mockFetch({}));

    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Save Settings')).toBeDefined();
    });
  });

  it('renders the TMDb API key field as password by default', async () => {
    fetchSpy.mockImplementation(
      mockFetch({ tmdb_api_key: 'secret-key-123' })
    );

    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Integration')).toBeDefined();
    });

    // The SHOW button should be visible (meaning field is hidden)
    expect(screen.getByText('SHOW')).toBeDefined();
  });

  it('shows error state when fetch fails', async () => {
    fetchSpy.mockRejectedValue(new Error('Network failure'));

    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Network failure/)).toBeDefined();
    });
  });
});
