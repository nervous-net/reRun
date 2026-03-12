// ABOUTME: Tests for UpdateModal component phase transitions
// ABOUTME: Verifies polling, success/failure/timeout detection, and cleanup

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { UpdateModal } from '../../../client/src/components/common/UpdateModal';

// Mock the API client
vi.mock('../../../client/src/api/client', () => ({
  api: {
    update: {
      status: vi.fn(),
    },
  },
}));

import { api } from '../../../client/src/api/client';
const mockStatus = vi.mocked(api.update.status);

describe('UpdateModal', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockStatus.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders installing phase when open', () => {
    mockStatus.mockResolvedValue({ currentVersion: '0.3.5', updating: true, lastError: null });
    render(<UpdateModal isOpen={true} version="0.3.9" previousVersion="0.3.5" />);
    expect(screen.getByText('Updating to v0.3.9...')).toBeTruthy();
  });

  it('does not render when closed', () => {
    render(<UpdateModal isOpen={false} version="0.3.9" previousVersion="0.3.5" />);
    expect(screen.queryByText('System Update')).toBeNull();
  });

  it('transitions to success when version changes', async () => {
    mockStatus.mockResolvedValue({ currentVersion: '0.3.9', updating: false, lastError: null });
    render(<UpdateModal isOpen={true} version="0.3.9" previousVersion="0.3.5" />);

    // Advance past first poll interval
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.getByText('Update complete! Reloading...')).toBeTruthy();
  });

  it('transitions to failed when lastError is set', async () => {
    mockStatus.mockResolvedValue({
      currentVersion: '0.3.5',
      updating: false,
      lastError: 'UPDATE FAILED: Download failed: 404',
    });
    render(<UpdateModal isOpen={true} version="0.3.9" previousVersion="0.3.5" />);

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.getByText('UPDATE FAILED: Download failed: 404')).toBeTruthy();
  });

  it('transitions to restarting on fetch failure', async () => {
    mockStatus.mockRejectedValue(new Error('Connection refused'));
    render(<UpdateModal isOpen={true} version="0.3.9" previousVersion="0.3.5" />);

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.getByText('Restarting server...')).toBeTruthy();
  });

  it('transitions to timeout after 3 minutes', async () => {
    mockStatus.mockResolvedValue({ currentVersion: '0.3.5', updating: true, lastError: null });
    render(<UpdateModal isOpen={true} version="0.3.9" previousVersion="0.3.5" />);

    await act(async () => {
      vi.advanceTimersByTime(3 * 60 * 1000);
    });

    expect(screen.getByText(/Update may have failed/)).toBeTruthy();
  });

  it('stops polling after success', async () => {
    mockStatus.mockResolvedValue({ currentVersion: '0.3.9', updating: false, lastError: null });
    render(<UpdateModal isOpen={true} version="0.3.9" previousVersion="0.3.5" />);

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    mockStatus.mockClear();

    await act(async () => {
      vi.advanceTimersByTime(4000);
    });

    // No additional calls after success
    expect(mockStatus).not.toHaveBeenCalled();
  });
});
