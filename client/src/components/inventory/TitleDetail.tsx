// ABOUTME: Slide-in detail panel for viewing full title metadata and copies
// ABOUTME: Slides in from the right at 400px wide with green border and dark background

import { type CSSProperties, useCallback, useEffect, useRef, useState } from 'react';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Table } from '../common/Table';
import { api } from '../../api/client';

interface TitleDetailProps {
  titleId: string;
  onClose: () => void;
}

interface CopyData {
  id: string;
  barcode: string;
  format: string;
  condition: string;
  status: string;
}

interface TitleData {
  id: string;
  name: string;
  year: number;
  genre: string;
  runtime?: number;
  rating: string;
  synopsis?: string;
  cast?: string;
  coverUrl?: string;
  copies: CopyData[];
}

const overlayStyle: CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'var(--overlay-60)',
  zIndex: 900,
};

const panelStyle: CSSProperties = {
  position: 'fixed',
  top: 0,
  right: 0,
  bottom: 0,
  width: '400px',
  maxWidth: '100vw',
  backgroundColor: 'var(--bg-panel)',
  borderLeft: '1px solid var(--crt-green)',
  boxShadow: '-4px 0 20px var(--accent-15)',
  display: 'flex',
  flexDirection: 'column',
  zIndex: 901,
  transition: 'transform 0.2s ease-out',
  overflowY: 'auto',
};

const headerStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: 'var(--space-sm) var(--space-md)',
  borderBottom: '1px solid var(--border-color)',
  flexShrink: 0,
};

const headerTitleStyle: CSSProperties = {
  color: 'var(--crt-green)',
  fontSize: 'var(--font-size-lg)',
  textTransform: 'uppercase',
  letterSpacing: '2px',
  textShadow: '0 0 10px var(--accent-50)',
  margin: 0,
};

const closeButtonStyle: CSSProperties = {
  background: 'transparent',
  border: '1px solid var(--border-color)',
  color: 'var(--text-secondary)',
  fontSize: 'var(--font-size-md)',
  cursor: 'pointer',
  padding: '2px 8px',
  fontFamily: 'inherit',
  borderRadius: 'var(--border-radius)',
  transition: 'color 0.15s ease, border-color 0.15s ease',
};

const bodyStyle: CSSProperties = {
  padding: 'var(--space-md)',
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-md)',
};

const coverLargeStyle: CSSProperties = {
  width: '100%',
  maxHeight: '350px',
  objectFit: 'contain',
  borderRadius: 'var(--border-radius)',
  border: '1px solid var(--border-color)',
};

const placeholderLargeStyle: CSSProperties = {
  width: '100%',
  height: '200px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'var(--bg-input)',
  border: '1px solid var(--border-color)',
  borderRadius: 'var(--border-radius)',
  color: 'var(--text-muted)',
  fontSize: 'var(--font-size-sm)',
  textTransform: 'uppercase',
  letterSpacing: '2px',
};

const metaRowStyle: CSSProperties = {
  display: 'flex',
  gap: 'var(--space-md)',
  flexWrap: 'wrap',
};

const metaItemStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
};

const metaLabelStyle: CSSProperties = {
  color: 'var(--text-secondary)',
  fontSize: 'var(--font-size-sm)',
  textTransform: 'uppercase',
  letterSpacing: '1px',
};

const metaValueStyle: CSSProperties = {
  color: 'var(--text-primary)',
  fontSize: 'var(--font-size-md)',
};

const sectionLabelStyle: CSSProperties = {
  color: 'var(--crt-green)',
  fontSize: 'var(--font-size-sm)',
  textTransform: 'uppercase',
  letterSpacing: '1px',
  borderBottom: '1px solid var(--border-color)',
  paddingBottom: 'var(--space-xs)',
  marginBottom: 'var(--space-xs)',
};

const synopsisStyle: CSSProperties = {
  color: 'var(--text-primary)',
  fontSize: 'var(--font-size-md)',
  lineHeight: 1.5,
  opacity: 0.85,
};

const loadingStyle: CSSProperties = {
  color: 'var(--crt-green)',
  textAlign: 'center',
  padding: 'var(--space-xl)',
  fontSize: 'var(--font-size-md)',
};

const errorStyle: CSSProperties = {
  color: 'var(--crt-red)',
  textAlign: 'center',
  padding: 'var(--space-xl)',
  fontSize: 'var(--font-size-md)',
};

const copiesColumns = [
  { key: 'barcode', label: 'Barcode', width: '120px' },
  { key: 'format', label: 'Format', width: '70px' },
  { key: 'condition', label: 'Cond', width: '60px' },
  { key: 'status', label: 'Status', width: '80px' },
  { key: 'actions', label: '', width: '90px' },
];

function getStatusVariant(status: string): 'success' | 'warning' | 'danger' | 'info' {
  switch (status.toLowerCase()) {
    case 'in':
    case 'available': return 'success';
    case 'out':
    case 'rented': return 'warning';
    case 'lost':
    case 'damaged': return 'danger';
    default: return 'info';
  }
}

export function TitleDetail({ titleId, onClose }: TitleDetailProps) {
  const [title, setTitle] = useState<TitleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddCopies, setShowAddCopies] = useState(false);
  const [addFormat, setAddFormat] = useState('DVD');
  const [addQty, setAddQty] = useState('1');
  const [addingCopies, setAddingCopies] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const loadTitle = useCallback(() => {
    setLoading(true);
    setError(null);
    api.titles.get(titleId)
      .then((data) => {
        setTitle(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load title');
        setLoading(false);
      });
  }, [titleId]);

  useEffect(() => {
    loadTitle();
  }, [loadTitle]);

  async function updateCopyStatus(copyId: string, status: string) {
    try {
      await api.copies.update(copyId, { status });
      loadTitle();
    } catch {
      // silent — visible from stale state
    }
  }

  async function handleAddCopies() {
    const qty = parseInt(addQty, 10);
    if (!qty || qty < 1) return;
    setAddingCopies(true);
    try {
      await api.titles.addCopies(titleId, { format: addFormat, quantity: qty });
      loadTitle();
      setShowAddCopies(false);
      setAddQty('1');
    } catch {
      // visible from stale state
    } finally {
      setAddingCopies(false);
    }
  }

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
      onClose();
    }
  };

  const copiesData = (title?.copies ?? []).map((copy) => ({
    barcode: copy.barcode,
    format: copy.format,
    condition: copy.condition,
    status: <Badge variant={getStatusVariant(copy.status)}>{copy.status}</Badge>,
    actions: copy.status === 'in' ? (
      <div style={{ display: 'flex', gap: '4px' }}>
        <Button variant="danger" onClick={() => updateCopyStatus(copy.id, 'damaged')}>
          Dmg
        </Button>
        <Button variant="ghost" onClick={() => updateCopyStatus(copy.id, 'retired')}>
          Retire
        </Button>
      </div>
    ) : copy.status === 'damaged' || copy.status === 'lost' || copy.status === 'retired' ? (
      <Button variant="secondary" onClick={() => updateCopyStatus(copy.id, 'in')}>
        Restore
      </Button>
    ) : null,
  }));

  return (
    <>
      <div style={overlayStyle} onClick={handleOverlayClick} />
      <div ref={panelRef} style={panelStyle} role="dialog" aria-modal="true" aria-label="Title Detail">
        <div style={headerStyle}>
          <h2 style={headerTitleStyle}>Title Detail</h2>
          <button
            style={closeButtonStyle}
            onClick={onClose}
            aria-label="Close"
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--crt-green)';
              e.currentTarget.style.borderColor = 'var(--crt-green)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--text-secondary)';
              e.currentTarget.style.borderColor = 'var(--border-color)';
            }}
          >
            [X]
          </button>
        </div>

        <div style={bodyStyle}>
          {loading && <div style={loadingStyle}>Loading...</div>}
          {error && <div style={errorStyle}>Error: {error}</div>}

          {title && (
            <>
              {title.coverUrl ? (
                <img src={title.coverUrl} alt={title.name} style={coverLargeStyle} />
              ) : (
                <div style={placeholderLargeStyle}>[ NO COVER ]</div>
              )}

              <div>
                <div style={{ color: 'var(--crt-green)', fontSize: 'var(--font-size-xl)', fontWeight: 'bold' }}>
                  {title.name}
                </div>
              </div>

              <div style={metaRowStyle}>
                <div style={metaItemStyle}>
                  <span style={metaLabelStyle}>Year</span>
                  <span style={metaValueStyle}>{title.year}</span>
                </div>
                <div style={metaItemStyle}>
                  <span style={metaLabelStyle}>Genre</span>
                  <span style={metaValueStyle}>{title.genre || '—'}</span>
                </div>
                {title.runtime && (
                  <div style={metaItemStyle}>
                    <span style={metaLabelStyle}>Runtime</span>
                    <span style={metaValueStyle}>{title.runtime} min</span>
                  </div>
                )}
                <div style={metaItemStyle}>
                  <span style={metaLabelStyle}>Rating</span>
                  <span style={metaValueStyle}>{title.rating || '—'}</span>
                </div>
              </div>

              {title.synopsis && (
                <div>
                  <div style={sectionLabelStyle}>Synopsis</div>
                  <div style={synopsisStyle}>{title.synopsis}</div>
                </div>
              )}

              {title.cast && (
                <div>
                  <div style={sectionLabelStyle}>Cast</div>
                  <div style={synopsisStyle}>{title.cast}</div>
                </div>
              )}

              <div>
                <div style={{ ...sectionLabelStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Copies ({title.copies.length})</span>
                  <Button variant="secondary" onClick={() => setShowAddCopies(!showAddCopies)}>
                    {showAddCopies ? 'Cancel' : '+ Add'}
                  </Button>
                </div>
                {showAddCopies && (
                  <div style={addCopiesFormStyle}>
                    <select
                      value={addFormat}
                      onChange={(e) => setAddFormat(e.target.value)}
                      style={selectStyle}
                    >
                      <option value="VHS">VHS</option>
                      <option value="DVD">DVD</option>
                      <option value="Blu-ray">Blu-ray</option>
                      <option value="4K">4K UHD</option>
                    </select>
                    <input
                      type="number"
                      min="1"
                      max="50"
                      value={addQty}
                      onChange={(e) => setAddQty(e.target.value)}
                      style={{ width: '60px', backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius)', padding: '4px 8px' }}
                    />
                    <Button variant="primary" onClick={handleAddCopies} disabled={addingCopies}>
                      {addingCopies ? 'Adding...' : 'Add Copies'}
                    </Button>
                  </div>
                )}
                <Table
                  columns={copiesColumns}
                  data={copiesData}
                  emptyMessage="No copies in inventory"
                />
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

const addCopiesFormStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-sm)',
  padding: 'var(--space-sm) 0',
};

const selectStyle: CSSProperties = {
  backgroundColor: 'var(--bg-input)',
  color: 'var(--text-primary)',
  border: '1px solid var(--border-color)',
  borderRadius: 'var(--border-radius)',
  padding: '6px 8px',
  fontFamily: 'inherit',
  fontSize: 'var(--font-size-md)',
};
