// ABOUTME: Tests for theme selection in the Settings page
// ABOUTME: Validates dropdown rendering, live preview via documentElement class, and save payload

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SettingsPage } from '../../../../client/src/components/settings/SettingsPage';

function mockSettingsResponse(data: Record<string, string> = {}) {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve({ data }),
  };
}

describe('Settings Theme', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    document.documentElement.className = '';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.documentElement.className = '';
  });

  it('renders the Appearance section with theme dropdown', async () => {
    fetchSpy.mockResolvedValue(mockSettingsResponse({}));

    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Appearance')).toBeDefined();
    });

    const select = screen.getByTestId('theme-select') as HTMLSelectElement;
    expect(select).toBeDefined();
    expect(select.value).toBe('f');
  });

  it('shows all six theme options', async () => {
    fetchSpy.mockResolvedValue(mockSettingsResponse({}));

    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Appearance')).toBeDefined();
    });

    expect(screen.getByText('A \u2014 Borland Turbo Vision')).toBeDefined();
    expect(screen.getByText('B \u2014 Norton Commander')).toBeDefined();
    expect(screen.getByText('C \u2014 WordPerfect 5.1')).toBeDefined();
    expect(screen.getByText('D \u2014 Lotus 1-2-3')).toBeDefined();
    expect(screen.getByText('E \u2014 Classic POS Terminal')).toBeDefined();
    expect(screen.getByText('F \u2014 Hybrid CRT (Default)')).toBeDefined();
  });

  it('applies theme class to documentElement on dropdown change', async () => {
    fetchSpy.mockResolvedValue(mockSettingsResponse({}));

    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('theme-select')).toBeDefined();
    });

    const select = screen.getByTestId('theme-select');
    fireEvent.change(select, { target: { value: 'a' } });
    expect(document.documentElement.className).toBe('theme-a');
  });

  it('removes theme class when selecting theme F', async () => {
    fetchSpy.mockResolvedValue(mockSettingsResponse({ theme: 'b' }));
    document.documentElement.className = 'theme-b';

    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('theme-select')).toBeDefined();
    });

    const select = screen.getByTestId('theme-select');
    fireEvent.change(select, { target: { value: 'f' } });
    expect(document.documentElement.className).toBe('');
  });

  it('defaults to theme F when no theme is stored', async () => {
    fetchSpy.mockResolvedValue(mockSettingsResponse({}));

    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('theme-select')).toBeDefined();
    });

    const select = screen.getByTestId('theme-select') as HTMLSelectElement;
    expect(select.value).toBe('f');
    expect(document.documentElement.className).toBe('');
  });

  it('shows stored theme as selected on load', async () => {
    fetchSpy.mockResolvedValue(mockSettingsResponse({ theme: 'c' }));

    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('theme-select')).toBeDefined();
    });

    const select = screen.getByTestId('theme-select') as HTMLSelectElement;
    expect(select.value).toBe('c');
  });

  it('includes theme in save request when changed', async () => {
    fetchSpy.mockResolvedValue(mockSettingsResponse({}));

    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('theme-select')).toBeDefined();
    });

    // Change theme to 'b'
    const select = screen.getByTestId('theme-select');
    fireEvent.change(select, { target: { value: 'b' } });

    // Mock the PUT response for save
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ ok: true }),
    });

    // Click save
    fireEvent.click(screen.getByText('Save Settings'));

    await waitFor(() => {
      // Should have called PUT /api/settings/theme with value 'b'
      const putCalls = fetchSpy.mock.calls.filter(
        (call: any[]) => call[1]?.method === 'PUT'
      );
      const themeCall = putCalls.find(
        (call: any[]) => call[0] === '/api/settings/theme'
      );
      expect(themeCall).toBeDefined();
      const body = JSON.parse(themeCall![1].body);
      expect(body.value).toBe('b');
    });
  });
});
