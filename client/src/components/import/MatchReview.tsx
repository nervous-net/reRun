// ABOUTME: Review and edit matched titles before committing the import
// ABOUTME: Shows table with match status, filter toggles, TMDb re-match, and import options

import { type CSSProperties, useState } from 'react';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { Input } from '../common/Input';
import { api } from '../../api/client';

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
  tmdbId?: string;
  coverUrl?: string;
  synopsis?: string;
  runtimeMinutes?: string;
  mediaType?: string;
  numberOfSeasons?: string;
}

interface MatchReviewProps {
  titles: ImportTitle[];
  onConfirm: (finalTitles: ImportTitle[]) => void;
}

type FilterMode = 'all' | 'matched' | 'unmatched';

export function MatchReview({ titles: initialTitles, onConfirm }: MatchReviewProps) {
  const [titles, setTitles] = useState<ImportTitle[]>(initialTitles);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<ImportTitle | null>(null);
  const [filter, setFilter] = useState<FilterMode>('all');
  const [tmdbSuggestions, setTmdbSuggestions] = useState<any[]>([]);
  const [tmdbSearching, setTmdbSearching] = useState(false);

  const matchedCount = titles.filter((t) => t.matched).length;
  const unmatchedCount = titles.length - matchedCount;

  const filteredTitles = titles.map((t, i) => ({ ...t, originalIndex: i })).filter((t) => {
    if (filter === 'matched') return t.matched;
    if (filter === 'unmatched') return !t.matched;
    return true;
  });

  function startEditing(originalIndex: number) {
    setEditingIndex(originalIndex);
    setEditDraft({ ...titles[originalIndex] });
    setTmdbSuggestions([]);
  }

  function cancelEditing() {
    setEditingIndex(null);
    setEditDraft(null);
    setTmdbSuggestions([]);
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
    setTmdbSuggestions([]);
  }

  function updateDraft(field: keyof ImportTitle, value: string) {
    if (!editDraft) return;
    setEditDraft({ ...editDraft, [field]: value });
  }

  async function handleTmdbSearch() {
    if (!editDraft?.title?.trim()) return;
    setTmdbSearching(true);
    setTmdbSuggestions([]);
    try {
      const yearNum = editDraft.year ? parseInt(editDraft.year, 10) : undefined;
      const data = await api.tmdb.search(editDraft.title.trim(), yearNum);
      setTmdbSuggestions(Array.isArray(data) ? data : data.data ?? []);
    } catch {
      // silent
    } finally {
      setTmdbSearching(false);
    }
  }

  async function handleTmdbSelect(result: any) {
    if (!editDraft) return;
    try {
      const details = await api.tmdb.details(result.tmdbId, result.mediaType);
      setEditDraft({
        ...editDraft,
        title: details.title ?? editDraft.title,
        year: String(details.year ?? editDraft.year),
        genre: details.genre ?? editDraft.genre,
        rating: details.rating ?? editDraft.rating,
        cast: details.cast ?? editDraft.cast,
        synopsis: details.synopsis ?? editDraft.synopsis,
        coverUrl: details.coverUrl ?? result.posterUrl ?? editDraft.coverUrl,
        runtimeMinutes: details.runtimeMinutes ? String(details.runtimeMinutes) : editDraft.runtimeMinutes,
        tmdbId: String(details.tmdbId),
        mediaType: details.mediaType ?? result.mediaType ?? 'movie',
        numberOfSeasons: details.numberOfSeasons ? String(details.numberOfSeasons) : '',
        matched: true,
      });
      setTmdbSuggestions([]);
    } catch {
      // silent
    }
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

      {/* Filter toggles */}
      <div style={styles.filterBar}>
        {(['all', 'matched', 'unmatched'] as FilterMode[]).map((mode) => (
          <Button
            key={mode}
            variant={filter === mode ? 'primary' : 'secondary'}
            onClick={() => setFilter(mode)}
          >
            {mode === 'all' ? `All (${titles.length})` : mode === 'matched' ? `Matched (${matchedCount})` : `Unmatched (${unmatchedCount})`}
          </Button>
        ))}
      </div>

      <p style={styles.hint}>
        Click a row to edit. Use "TMDb Lookup" on unmatched rows to find the right match.
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
            {filteredTitles.map((title) => (
              editingIndex === title.originalIndex ? (
                <tr key={title.originalIndex} style={styles.editRow}>
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

                      {/* TMDb lookup for re-matching */}
                      <div style={styles.tmdbSection}>
                        <Button variant="secondary" onClick={handleTmdbSearch} disabled={tmdbSearching}>
                          {tmdbSearching ? 'Searching TMDb...' : 'TMDb Lookup'}
                        </Button>
                        {tmdbSuggestions.length > 0 && (
                          <div style={styles.tmdbResults}>
                            {tmdbSuggestions.map((r: any) => (
                              <div
                                key={`${r.tmdbId}-${r.mediaType}`}
                                style={styles.tmdbResult}
                                onClick={() => handleTmdbSelect(r)}
                                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--accent-10)'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                              >
                                {r.posterUrl && (
                                  <img src={r.posterUrl} alt="" style={{ width: '28px', height: '42px', objectFit: 'cover', borderRadius: '2px' }} />
                                )}
                                <div style={{ flex: 1 }}>
                                  <div style={{ color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    {r.title}
                                    {r.mediaType === 'tv' && (
                                      <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--crt-amber)', border: '1px solid var(--crt-amber)', borderRadius: '3px', padding: '0 4px' }}>TV</span>
                                    )}
                                  </div>
                                  <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                                    {r.year ?? '—'} | {r.voteAverage?.toFixed(1) ?? '—'}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
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
                  key={title.originalIndex}
                  style={title.originalIndex % 2 === 1 ? styles.altRow : styles.row}
                  onClick={() => startEditing(title.originalIndex)}
                >
                  <td style={styles.td}>{title.originalIndex + 1}</td>
                  <td style={styles.td}>
                    <div style={styles.titleCell}>
                      {title.coverUrl && (
                        <img
                          src={title.coverUrl}
                          alt=""
                          style={styles.poster}
                        />
                      )}
                      <span>{title.title}</span>
                    </div>
                  </td>
                  <td style={styles.td}>{title.year}</td>
                  <td style={styles.td}>{title.format}</td>
                  <td style={styles.td}>{title.quantity || '1'}</td>
                  <td style={styles.td}>{title.rating}</td>
                  <td style={styles.td}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Badge variant={title.matched ? 'success' : 'warning'}>
                        {title.matched ? 'matched' : 'unmatched'}
                      </Badge>
                      {title.mediaType === 'tv' && (
                        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--crt-amber)', border: '1px solid var(--crt-amber)', borderRadius: '3px', padding: '0 4px' }}>TV</span>
                      )}
                    </div>
                  </td>
                </tr>
              )
            ))}
          </tbody>
        </table>
      </div>

      <div style={styles.actions}>
        {unmatchedCount > 0 && matchedCount > 0 && (
          <Button
            variant="secondary"
            onClick={() => onConfirm(titles.filter((t) => t.matched))}
          >
            Import Matched Only ({matchedCount})
          </Button>
        )}
        <Button variant="primary" onClick={() => onConfirm(titles)}>
          Import All ({titles.length})
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
  filterBar: {
    display: 'flex',
    gap: 'var(--space-sm)',
  },
  hint: {
    color: 'var(--text-secondary)',
    fontSize: 'var(--font-size-sm)',
    margin: 0,
  },
  tableWrapper: {
    overflowX: 'auto',
    overflowY: 'auto',
    maxHeight: '55vh',
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
  titleCell: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-sm)',
  },
  poster: {
    width: '24px',
    height: '36px',
    objectFit: 'cover' as const,
    borderRadius: '2px',
    border: '1px solid var(--border-color)',
    flexShrink: 0,
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 'var(--space-sm)',
    paddingTop: 'var(--space-sm)',
  },
  tmdbSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-sm)',
    padding: 'var(--space-sm)',
    border: '1px dashed var(--border-color)',
    borderRadius: 'var(--border-radius)',
  },
  tmdbResults: {
    maxHeight: '180px',
    overflowY: 'auto',
    border: '1px solid var(--crt-green)',
    borderRadius: 'var(--border-radius)',
    backgroundColor: 'var(--bg-panel)',
  },
  tmdbResult: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-sm)',
    padding: '6px 10px',
    cursor: 'pointer',
    borderBottom: '1px solid var(--border-color)',
    transition: 'background-color 0.1s ease',
  },
};
