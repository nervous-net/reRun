// ABOUTME: Tests for barcode scanner detection hook
// ABOUTME: Validates fast input detection distinguishes scanner input from typing

import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useBarcodeScanner } from '../../../client/src/hooks/useBarcodeScanner';

describe('useBarcodeScanner', () => {
  it('calls onScan when fast characters followed by Enter', () => {
    const onScan = vi.fn();
    renderHook(() => useBarcodeScanner({ onScan }));

    // Simulate fast barcode scan (all events dispatched synchronously = 0ms apart)
    const chars = 'DVD-00042-001'.split('');
    for (const char of chars) {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: char, bubbles: true }));
    }
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(onScan).toHaveBeenCalledWith('DVD-00042-001');
  });

  it('does not trigger for input shorter than minLength', () => {
    const onScan = vi.fn();
    renderHook(() => useBarcodeScanner({ onScan }));

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(onScan).not.toHaveBeenCalled();
  });

  it('ignores modifier key combos', () => {
    const onScan = vi.fn();
    renderHook(() => useBarcodeScanner({ onScan }));

    // Ctrl+C type sequences should not accumulate in buffer
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', ctrlKey: true, bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', ctrlKey: true, bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', ctrlKey: true, bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(onScan).not.toHaveBeenCalled();
  });

  it('respects custom minLength', () => {
    const onScan = vi.fn();
    renderHook(() => useBarcodeScanner({ onScan, minLength: 5 }));

    // Send 4 chars (below minLength of 5)
    'abcd'.split('').forEach(key => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(onScan).not.toHaveBeenCalled();
  });

  it('handles numeric barcodes', () => {
    const onScan = vi.fn();
    renderHook(() => useBarcodeScanner({ onScan }));

    '1234567890'.split('').forEach(key => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(onScan).toHaveBeenCalledWith('1234567890');
  });
});
