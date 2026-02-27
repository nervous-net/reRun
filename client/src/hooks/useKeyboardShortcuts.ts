// ABOUTME: Global keyboard shortcut hook for F-key navigation and escape handling
// ABOUTME: Maps F1-F6 to screen navigation, Esc to close modals

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export const SHORTCUTS: Record<string, string> = {
  F1: '/pos',
  F2: '/customers',
  F3: '/returns',
  F4: '/inventory',
  F5: '/import',
  F6: '/',
};

export function useKeyboardShortcuts(onEscape?: () => void) {
  const navigate = useNavigate();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Don't intercept if user is typing in an input (except F-keys)
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';

      if (e.key === 'Escape' && onEscape) {
        e.preventDefault();
        onEscape();
        return;
      }

      // F-keys should work even in inputs (they're not typeable)
      if (SHORTCUTS[e.key]) {
        e.preventDefault();
        navigate(SHORTCUTS[e.key]);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate, onEscape]);
}
