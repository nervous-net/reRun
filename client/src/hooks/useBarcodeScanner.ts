// ABOUTME: Hook that detects USB barcode scanner input vs manual typing
// ABOUTME: Scanners send characters faster than 50ms apart, ending with Enter

import { useEffect, useRef, useCallback } from 'react';

interface UseBarcodeProps {
  onScan: (barcode: string) => void;
  minLength?: number;
  maxDelay?: number;
}

export function useBarcodeScanner({ onScan, minLength = 3, maxDelay = 50 }: UseBarcodeProps) {
  const buffer = useRef('');
  const lastKeyTime = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const now = Date.now();
    const timeSinceLastKey = now - lastKeyTime.current;

    // If too much time has passed, start a new buffer
    if (timeSinceLastKey > maxDelay) {
      buffer.current = '';
    }

    lastKeyTime.current = now;

    if (e.key === 'Enter') {
      if (buffer.current.length >= minLength) {
        e.preventDefault();
        e.stopPropagation();
        onScan(buffer.current);
      }
      buffer.current = '';
      return;
    }

    // Only capture printable single characters
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      buffer.current += e.key;

      // Clear buffer after delay (in case Enter never comes)
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        buffer.current = '';
      }, maxDelay * 2);
    }
  }, [onScan, minLength, maxDelay]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown, true); // capture phase
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [handleKeyDown]);
}
