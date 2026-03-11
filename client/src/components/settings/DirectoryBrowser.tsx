// ABOUTME: Modal component for browsing server-side directories
// ABOUTME: Used in Settings to select a custom backup location via the filesystem browse API

import { type CSSProperties, useCallback, useEffect, useState } from 'react';
import { Modal } from '../common/Modal';
import { api } from '../../api/client';

interface DirectoryBrowserProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (path: string) => void;
  initialPath?: string;
}

interface DirectoryEntry {
  name: string;
  path: string;
}

const listStyle: CSSProperties = {
  maxHeight: '400px',
  overflowY: 'auto',
  border: '1px solid var(--border-color)',
  borderRadius: 'var(--border-radius)',
};

const entryStyle: CSSProperties = {
  padding: 'var(--space-xs) var(--space-sm)',
  cursor: 'pointer',
  color: 'var(--text-primary)',
  borderBottom: '1px solid var(--border-color)',
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-xs)',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--font-size-sm)',
};

const pathBarStyle: CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--font-size-sm)',
  color: 'var(--crt-green)',
  padding: 'var(--space-xs) var(--space-sm)',
  backgroundColor: 'var(--bg-input)',
  border: '1px solid var(--border-color)',
  borderRadius: 'var(--border-radius)',
  marginBottom: 'var(--space-sm)',
  wordBreak: 'break-all',
};

const buttonRowStyle: CSSProperties = {
  display: 'flex',
  gap: 'var(--space-sm)',
  justifyContent: 'flex-end',
  marginTop: 'var(--space-md)',
};

const btnStyle: CSSProperties = {
  padding: 'var(--space-xs) var(--space-sm)',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--font-size-sm)',
  cursor: 'pointer',
  border: '1px solid var(--crt-green)',
  borderRadius: 'var(--border-radius)',
  background: 'transparent',
  color: 'var(--crt-green)',
};

export function DirectoryBrowser({ isOpen, onClose, onSelect, initialPath }: DirectoryBrowserProps) {
  const [currentPath, setCurrentPath] = useState<string>('');
  const [parentPath, setParentPath] = useState<string | null>(null);
  const [directories, setDirectories] = useState<DirectoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const browse = useCallback(async (dirPath?: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.filesystem.browse(dirPath);
      setCurrentPath(response.current);
      setParentPath(response.parent);
      setDirectories(response.directories);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to browse directory');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      browse(initialPath || undefined);
    }
  }, [isOpen, initialPath, browse]);

  const handleNavigate = (dirPath: string) => {
    browse(dirPath);
  };

  const handleUp = () => {
    if (parentPath) browse(parentPath);
  };

  const handleSelect = () => {
    onSelect(currentPath);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Select Backup Folder" maxWidth="700px">
      <div style={pathBarStyle}>{currentPath || '/'}</div>

      {parentPath && (
        <button
          type="button"
          style={{ ...btnStyle, marginBottom: 'var(--space-sm)' }}
          onClick={handleUp}
          disabled={loading}
        >
          .. (Up)
        </button>
      )}

      {loading && <div style={{ color: 'var(--text-secondary)', padding: 'var(--space-sm)' }}>Loading...</div>}

      {error && <div style={{ color: 'var(--crt-red)', padding: 'var(--space-sm)' }}>{error}</div>}

      {!loading && !error && (
        <div style={listStyle}>
          {directories.length === 0 && (
            <div style={{ ...entryStyle, color: 'var(--text-secondary)', cursor: 'default' }}>
              No subdirectories
            </div>
          )}
          {directories.map((dir) => (
            <div
              key={dir.path}
              style={entryStyle}
              onClick={() => handleNavigate(dir.path)}
              onKeyDown={(e) => e.key === 'Enter' && handleNavigate(dir.path)}
              role="button"
              tabIndex={0}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              [{dir.name}]
            </div>
          ))}
        </div>
      )}

      <div style={buttonRowStyle}>
        <button type="button" style={btnStyle} onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          style={{ ...btnStyle, borderColor: 'var(--crt-green-bright)', color: 'var(--crt-green-bright)' }}
          onClick={handleSelect}
          disabled={loading}
        >
          Select This Folder
        </button>
      </div>
    </Modal>
  );
}
