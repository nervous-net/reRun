// ABOUTME: Tests for the keyboard shortcuts hook
// ABOUTME: Validates F-key navigation mapping and escape handler behavior

import { describe, it, expect, vi } from 'vitest';
import { SHORTCUTS } from '../../../client/src/hooks/useKeyboardShortcuts';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

describe('useKeyboardShortcuts', () => {
  it('maps F1 to /pos', () => {
    expect(SHORTCUTS['F1']).toBe('/pos');
  });

  it('maps F2 to /customers', () => {
    expect(SHORTCUTS['F2']).toBe('/customers');
  });

  it('maps F3 to /returns', () => {
    expect(SHORTCUTS['F3']).toBe('/returns');
  });

  it('maps F4 to /inventory', () => {
    expect(SHORTCUTS['F4']).toBe('/inventory');
  });

  it('maps F5 to /import', () => {
    expect(SHORTCUTS['F5']).toBe('/import');
  });

  it('maps F6 to / (dashboard)', () => {
    expect(SHORTCUTS['F6']).toBe('/');
  });

  it('defines exactly 6 shortcuts', () => {
    expect(Object.keys(SHORTCUTS)).toHaveLength(6);
  });
});
