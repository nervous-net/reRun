// ABOUTME: Modal shown during app updates with polling status feedback
// ABOUTME: Displays progress, detects success/failure/timeout, auto-reloads on success

import { useState, useEffect, useRef, useCallback } from 'react';
import { Modal } from './Modal';
import { api } from '../../api/client';

interface UpdateModalProps {
  isOpen: boolean;
  version: string;
  previousVersion: string;
}

type UpdatePhase = 'installing' | 'restarting' | 'success' | 'failed' | 'timeout';

const POLL_INTERVAL_MS = 2000;
const TIMEOUT_MS = 3 * 60 * 1000; // 3 minutes

export function UpdateModal({ isOpen, version, previousVersion }: UpdateModalProps) {
  const [phase, setPhase] = useState<UpdatePhase>('installing');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cleanup = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    setPhase('installing');
    setErrorMessage(null);

    // Start timeout
    timeoutRef.current = setTimeout(() => {
      cleanup();
      setPhase('timeout');
    }, TIMEOUT_MS);

    // Start polling
    intervalRef.current = setInterval(async () => {
      try {
        const status = await api.update.status();

        // Check for error
        if (status.lastError) {
          cleanup();
          setErrorMessage(status.lastError);
          setPhase('failed');
          return;
        }

        // Check for version change (success)
        if (status.currentVersion && status.currentVersion !== previousVersion) {
          cleanup();
          setPhase('success');
          setTimeout(() => window.location.reload(), 2000);
          return;
        }
      } catch {
        // Connection refused — server is restarting, keep polling
        setPhase('restarting');
      }
    }, POLL_INTERVAL_MS);

    return cleanup;
  }, [isOpen, previousVersion, cleanup]);

  const phaseText: Record<UpdatePhase, string> = {
    installing: `Updating to v${version}...`,
    restarting: 'Restarting server...',
    success: 'Update complete! Reloading...',
    failed: errorMessage ?? 'Update failed. Check data/update.log for details.',
    timeout: 'Update may have failed. Check data/update.log for details.',
  };

  const isTerminal = phase === 'success' || phase === 'failed' || phase === 'timeout';
  const isError = phase === 'failed' || phase === 'timeout';

  const iconStyle = {
    fontSize: 'var(--font-size-xl)',
    marginBottom: 'var(--space-md)',
    textShadow: 'var(--glow-green)',
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {}}
      title="System Update"
      maxWidth="450px"
    >
      <div style={{
        textAlign: 'center',
        padding: 'var(--space-md)',
        color: isError ? 'var(--crt-red, #ff4444)' : 'var(--crt-green)',
        fontFamily: 'var(--font-mono)',
      }}>
        {!isTerminal && (
          <div style={iconStyle}>[ ◉ ]</div>
        )}
        {phase === 'success' && (
          <div style={iconStyle}>[ ✓ ]</div>
        )}
        {isError && (
          <div style={{ ...iconStyle, textShadow: 'none', color: 'var(--crt-red, #ff4444)' }}>
            [ ✗ ]
          </div>
        )}
        <div style={{ fontSize: 'var(--font-size-md)' }}>
          {phaseText[phase]}
        </div>
      </div>
    </Modal>
  );
}
