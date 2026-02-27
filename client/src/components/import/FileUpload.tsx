// ABOUTME: CSV file upload with drag-and-drop zone for the import wizard
// ABOUTME: Reads CSV files as text via FileReader and reports content to parent

import { type CSSProperties, useRef, useState } from 'react';

interface FileUploadProps {
  onFileLoaded: (csvContent: string) => void;
}

export function FileUpload({ onFileLoaded }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [fileInfo, setFileInfo] = useState<{ name: string; size: number; rows: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File) {
    setError(null);

    if (!file.name.endsWith('.csv')) {
      setError('Only .csv files are accepted');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n').filter((line) => line.trim().length > 0);
      setFileInfo({
        name: file.name,
        size: file.size,
        rows: Math.max(0, lines.length - 1), // subtract header row
      });
      onFileLoaded(text);
    };
    reader.onerror = () => {
      setError('Failed to read file');
    };
    reader.readAsText(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  const dropZoneStyle: CSSProperties = {
    ...styles.dropZone,
    ...(isDragging ? styles.dropZoneDragging : {}),
  };

  return (
    <div style={styles.container}>
      <h3 style={styles.heading}>Upload CSV File</h3>
      <p style={styles.hint}>
        Expected columns: Title, VHS/DVD/Bluray, Principal Actors, Director(s), Rating
      </p>

      <div
        style={dropZoneStyle}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          onChange={handleInputChange}
          style={{ display: 'none' }}
        />
        {fileInfo ? (
          <div style={styles.fileInfo}>
            <div style={styles.fileName}>{fileInfo.name}</div>
            <div style={styles.fileMeta}>
              {formatSize(fileInfo.size)} / {fileInfo.rows.toLocaleString()} rows
            </div>
          </div>
        ) : (
          <div style={styles.placeholder}>
            <div style={styles.uploadIcon}>[+]</div>
            <div>Drag & drop a .csv file here</div>
            <div style={styles.subtext}>or click to browse</div>
          </div>
        )}
      </div>

      {error && <div style={styles.error}>{error}</div>}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-md)',
    padding: 'var(--space-md)',
    maxWidth: '600px',
  },
  heading: {
    color: 'var(--crt-green)',
    textShadow: 'var(--glow-green)',
    fontSize: 'var(--font-size-lg)',
    margin: 0,
  },
  hint: {
    color: 'var(--text-secondary)',
    fontSize: 'var(--font-size-sm)',
    margin: 0,
  },
  dropZone: {
    border: '2px dashed var(--crt-green-dim)',
    borderRadius: 'var(--border-radius)',
    padding: 'var(--space-xl)',
    textAlign: 'center',
    cursor: 'pointer',
    background: 'var(--bg-panel)',
    transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
  },
  dropZoneDragging: {
    borderColor: 'var(--crt-green)',
    boxShadow: 'var(--glow-green)',
  },
  placeholder: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 'var(--space-sm)',
    color: 'var(--text-secondary)',
    fontSize: 'var(--font-size-md)',
  },
  uploadIcon: {
    fontSize: 'var(--font-size-xxl)',
    color: 'var(--crt-green-dim)',
  },
  subtext: {
    fontSize: 'var(--font-size-sm)',
    color: 'var(--text-muted)',
  },
  fileInfo: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 'var(--space-sm)',
  },
  fileName: {
    color: 'var(--crt-green)',
    fontSize: 'var(--font-size-lg)',
    textShadow: 'var(--glow-green)',
  },
  fileMeta: {
    color: 'var(--text-secondary)',
    fontSize: 'var(--font-size-md)',
  },
  error: {
    color: 'var(--text-error)',
    fontSize: 'var(--font-size-sm)',
  },
};
