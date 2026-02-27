// ABOUTME: Final import step that commits titles to the database with a progress bar
// ABOUTME: Shows animated CRT-styled progress and completion summary

import { type CSSProperties, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { Button } from '../common/Button';
import type { ImportTitle } from './MatchReview';

interface ImportProgressProps {
  titles: ImportTitle[];
  onComplete: (results: ImportResults) => void;
}

interface ImportResults {
  titlesCreated: number;
  copiesCreated: number;
  errors: string[];
}

export function ImportProgress({ titles, onComplete }: ImportProgressProps) {
  const navigate = useNavigate();
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'importing' | 'done' | 'error'>('importing');
  const [results, setResults] = useState<ImportResults | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function runImport() {
      // Animate progress while waiting for the API
      const progressInterval = setInterval(() => {
        if (cancelled) return;
        setProgress((prev) => {
          // Slow down as we approach 90% to simulate realistic progress
          if (prev >= 90) return prev;
          return prev + Math.random() * 5;
        });
      }, 200);

      try {
        const response = await api.import.commit({ titles });
        clearInterval(progressInterval);

        if (cancelled) return;

        setProgress(100);
        setStatus('done');
        const importResults: ImportResults = {
          titlesCreated: response.titlesCreated ?? titles.length,
          copiesCreated: response.copiesCreated ?? titles.length,
          errors: response.errors ?? [],
        };
        setResults(importResults);
        onComplete(importResults);
      } catch (err) {
        clearInterval(progressInterval);
        if (cancelled) return;

        setStatus('error');
        setErrorMessage(err instanceof Error ? err.message : 'Import failed');
      }
    }

    runImport();

    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={styles.container}>
      <h3 style={styles.heading}>
        {status === 'importing' && 'Importing...'}
        {status === 'done' && 'Import Complete'}
        {status === 'error' && 'Import Failed'}
      </h3>

      {/* Progress bar */}
      <div style={styles.progressWrapper}>
        <div style={styles.progressTrack}>
          <div
            style={{
              ...styles.progressBar,
              width: `${Math.min(progress, 100)}%`,
              ...(status === 'error' ? styles.progressBarError : {}),
            }}
          />
        </div>
        <div style={styles.progressLabel}>
          {status === 'importing' && `${Math.round(progress)}%`}
          {status === 'done' && '100%'}
          {status === 'error' && 'ERROR'}
        </div>
      </div>

      {status === 'importing' && (
        <p style={styles.statusText}>
          Processing {titles.length.toLocaleString()} titles...
        </p>
      )}

      {status === 'done' && results && (
        <div style={styles.summary}>
          <div style={styles.summaryRow}>
            <span style={styles.summaryLabel}>Titles created:</span>
            <span style={styles.summaryValue}>{results.titlesCreated.toLocaleString()}</span>
          </div>
          <div style={styles.summaryRow}>
            <span style={styles.summaryLabel}>Copies created:</span>
            <span style={styles.summaryValue}>{results.copiesCreated.toLocaleString()}</span>
          </div>
          {results.errors.length > 0 && (
            <div style={styles.summaryRow}>
              <span style={styles.summaryLabel}>Errors:</span>
              <span style={styles.errorCount}>{results.errors.length}</span>
            </div>
          )}
          <div style={styles.actions}>
            <Button variant="primary" onClick={() => navigate('/inventory')}>
              Go to Inventory
            </Button>
          </div>
        </div>
      )}

      {status === 'error' && (
        <div style={styles.errorBox}>
          <p style={styles.errorText}>{errorMessage}</p>
          <Button variant="danger" onClick={() => window.location.reload()}>
            Start Over
          </Button>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-lg)',
    padding: 'var(--space-md)',
    maxWidth: '600px',
  },
  heading: {
    color: 'var(--crt-green)',
    textShadow: 'var(--glow-green)',
    fontSize: 'var(--font-size-lg)',
    margin: 0,
  },
  progressWrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-xs)',
  },
  progressTrack: {
    height: '24px',
    background: 'var(--bg-primary)',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--border-radius)',
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    background: 'var(--crt-green)',
    boxShadow: 'var(--glow-green)',
    transition: 'width 0.3s ease',
  },
  progressBarError: {
    background: 'var(--crt-red)',
    boxShadow: '0 0 10px rgba(255, 51, 51, 0.3)',
  },
  progressLabel: {
    color: 'var(--text-secondary)',
    fontSize: 'var(--font-size-sm)',
    textAlign: 'right',
  },
  statusText: {
    color: 'var(--text-secondary)',
    fontSize: 'var(--font-size-md)',
    margin: 0,
  },
  summary: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-md)',
    padding: 'var(--space-md)',
    background: 'var(--bg-panel)',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--border-radius)',
  },
  summaryRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    color: 'var(--text-secondary)',
    fontSize: 'var(--font-size-md)',
  },
  summaryValue: {
    color: 'var(--crt-green)',
    fontSize: 'var(--font-size-lg)',
    textShadow: 'var(--glow-green)',
  },
  errorCount: {
    color: 'var(--crt-red)',
    fontSize: 'var(--font-size-lg)',
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    paddingTop: 'var(--space-sm)',
  },
  errorBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-md)',
    padding: 'var(--space-md)',
    border: '1px solid var(--crt-red)',
    borderRadius: 'var(--border-radius)',
    background: 'rgba(255, 51, 51, 0.05)',
  },
  errorText: {
    color: 'var(--text-error)',
    fontSize: 'var(--font-size-md)',
    margin: 0,
  },
};
