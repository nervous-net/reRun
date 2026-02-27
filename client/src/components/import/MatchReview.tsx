// ABOUTME: Review and edit matched titles before committing the import
// ABOUTME: Shows a table of all rows with match status and inline editing

import { type CSSProperties, useState } from 'react';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { Input } from '../common/Input';

export interface ImportTitle {
  title: string;
  year: string;
  format: string;
  quantity: string;
  genre: string;
  barcode: string;
  director: string;
  cast: string;
  rating: string;
  matched: boolean;
}

interface MatchReviewProps {
  titles: ImportTitle[];
  onConfirm: (finalTitles: ImportTitle[]) => void;
}

export function MatchReview({ titles: initialTitles, onConfirm }: MatchReviewProps) {
  const [titles, setTitles] = useState<ImportTitle[]>(initialTitles);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<ImportTitle | null>(null);

  const matchedCount = titles.filter((t) => t.matched).length;
  const unmatchedCount = titles.length - matchedCount;

  function startEditing(index: number) {
    setEditingIndex(index);
    setEditDraft({ ...titles[index] });
  }

  function cancelEditing() {
    setEditingIndex(null);
    setEditDraft(null);
  }

  function saveEditing() {
    if (editingIndex === null || !editDraft) return;
    setTitles((prev) => {
      const updated = [...prev];
      updated[editingIndex] = editDraft;
      return updated;
    });
    setEditingIndex(null);
    setEditDraft(null);
  }

  function updateDraft(field: keyof ImportTitle, value: string) {
    if (!editDraft) return;
    setEditDraft({ ...editDraft, [field]: value });
  }

  return (
    <div style={styles.container}>
      <h3 style={styles.heading}>Review Titles</h3>
      <div style={styles.summary}>
        <span style={styles.totalCount}>{titles.length.toLocaleString()} titles</span>
        <Badge variant="success">{matchedCount} matched</Badge>
        {unmatchedCount > 0 && (
          <Badge variant="warning">{unmatchedCount} unmatched</Badge>
        )}
      </div>

      <p style={styles.hint}>
        Click a row to edit. Review and confirm before importing.
      </p>

      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>#</th>
              <th style={styles.th}>Title</th>
              <th style={styles.th}>Year</th>
              <th style={styles.th}>Format</th>
              <th style={styles.th}>Qty</th>
              <th style={styles.th}>Rating</th>
              <th style={styles.th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {titles.map((title, index) => (
              editingIndex === index ? (
                <tr key={index} style={styles.editRow}>
                  <td style={styles.td} colSpan={7}>
                    <div style={styles.editForm}>
                      <div style={styles.editGrid}>
                        <Input
                          label="Title"
                          value={editDraft?.title ?? ''}
                          onChange={(e) => updateDraft('title', e.target.value)}
                        />
                        <Input
                          label="Year"
                          value={editDraft?.year ?? ''}
                          onChange={(e) => updateDraft('year', e.target.value)}
                        />
                        <Input
                          label="Format"
                          value={editDraft?.format ?? ''}
                          onChange={(e) => updateDraft('format', e.target.value)}
                        />
                        <Input
                          label="Quantity"
                          value={editDraft?.quantity ?? ''}
                          onChange={(e) => updateDraft('quantity', e.target.value)}
                        />
                        <Input
                          label="Director"
                          value={editDraft?.director ?? ''}
                          onChange={(e) => updateDraft('director', e.target.value)}
                        />
                        <Input
                          label="Cast"
                          value={editDraft?.cast ?? ''}
                          onChange={(e) => updateDraft('cast', e.target.value)}
                        />
                        <Input
                          label="Genre"
                          value={editDraft?.genre ?? ''}
                          onChange={(e) => updateDraft('genre', e.target.value)}
                        />
                        <Input
                          label="Rating"
                          value={editDraft?.rating ?? ''}
                          onChange={(e) => updateDraft('rating', e.target.value)}
                        />
                      </div>
                      <div style={styles.editActions}>
                        <Button variant="primary" onClick={saveEditing}>Save</Button>
                        <Button variant="ghost" onClick={cancelEditing}>Cancel</Button>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr
                  key={index}
                  style={index % 2 === 1 ? styles.altRow : styles.row}
                  onClick={() => startEditing(index)}
                >
                  <td style={styles.td}>{index + 1}</td>
                  <td style={styles.td}>{title.title}</td>
                  <td style={styles.td}>{title.year}</td>
                  <td style={styles.td}>{title.format}</td>
                  <td style={styles.td}>{title.quantity || '1'}</td>
                  <td style={styles.td}>{title.rating}</td>
                  <td style={styles.td}>
                    <Badge variant={title.matched ? 'success' : 'warning'}>
                      {title.matched ? 'matched' : 'unmatched'}
                    </Badge>
                  </td>
                </tr>
              )
            ))}
          </tbody>
        </table>
      </div>

      <div style={styles.actions}>
        <Button variant="primary" onClick={() => onConfirm(titles)}>
          Confirm All & Import
        </Button>
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-md)',
    padding: 'var(--space-md)',
  },
  heading: {
    color: 'var(--crt-green)',
    textShadow: 'var(--glow-green)',
    fontSize: 'var(--font-size-lg)',
    margin: 0,
  },
  summary: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-md)',
  },
  totalCount: {
    color: 'var(--crt-amber)',
    fontSize: 'var(--font-size-md)',
    textShadow: 'var(--glow-amber)',
  },
  hint: {
    color: 'var(--text-secondary)',
    fontSize: 'var(--font-size-sm)',
    margin: 0,
  },
  tableWrapper: {
    overflowX: 'auto',
    overflowY: 'auto',
    maxHeight: '60vh',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--border-radius)',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 'var(--font-size-md)',
  },
  th: {
    color: 'var(--crt-green)',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    fontSize: 'var(--font-size-sm)',
    textAlign: 'left',
    padding: '4px 8px',
    borderBottom: '1px solid var(--crt-green-dim)',
    whiteSpace: 'nowrap',
    position: 'sticky',
    top: 0,
    background: 'var(--bg-secondary)',
    zIndex: 1,
  },
  td: {
    color: 'var(--text-primary)',
    padding: '4px 8px',
    borderBottom: '1px solid var(--border-color)',
  },
  row: {
    cursor: 'pointer',
    transition: 'background-color 0.1s ease',
  },
  altRow: {
    cursor: 'pointer',
    backgroundColor: 'var(--accent-02)',
    transition: 'background-color 0.1s ease',
  },
  editRow: {
    backgroundColor: 'var(--bg-panel)',
  },
  editForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-md)',
    padding: 'var(--space-sm)',
  },
  editGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr 1fr',
    gap: 'var(--space-sm)',
  },
  editActions: {
    display: 'flex',
    gap: 'var(--space-sm)',
    justifyContent: 'flex-end',
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    paddingTop: 'var(--space-sm)',
  },
};
