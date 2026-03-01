// ABOUTME: Modal form for creating or editing a title in the inventory
// ABOUTME: Handles title metadata and initial copy creation via api.titles.create/update

import { type CSSProperties, useEffect, useState } from 'react';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Select } from '../common/Select';
import { Modal } from '../common/Modal';
import { Alert } from '../common/Alert';
import { api } from '../../api/client';

interface TitleFormProps {
  onClose: () => void;
  onSaved: () => void;
  titleId?: string;
}

const formStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-md)',
};

const rowStyle: CSSProperties = {
  display: 'flex',
  gap: 'var(--space-md)',
};

const textareaStyle: CSSProperties = {
  fontFamily: 'inherit',
  fontSize: 'var(--font-size-md)',
  padding: '6px 8px',
  backgroundColor: 'var(--bg-input)',
  color: 'var(--text-primary)',
  border: '1px solid var(--border-color)',
  borderRadius: 'var(--border-radius)',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box' as const,
  resize: 'vertical' as const,
  minHeight: '80px',
  transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
};

const textareaLabelStyle: CSSProperties = {
  color: 'var(--text-secondary)',
  fontSize: 'var(--font-size-sm)',
  textTransform: 'uppercase',
  letterSpacing: '1px',
  marginBottom: 'var(--space-xs)',
  display: 'block',
};

const GENRE_OPTIONS = [
  { value: '', label: '— Select Genre —' },
  { value: 'Action', label: 'Action' },
  { value: 'Comedy', label: 'Comedy' },
  { value: 'Drama', label: 'Drama' },
  { value: 'Horror', label: 'Horror' },
  { value: 'Sci-Fi', label: 'Sci-Fi' },
  { value: 'Thriller', label: 'Thriller' },
  { value: 'Romance', label: 'Romance' },
  { value: 'Documentary', label: 'Documentary' },
  { value: 'Animation', label: 'Animation' },
  { value: 'Family', label: 'Family' },
  { value: 'Fantasy', label: 'Fantasy' },
  { value: 'Western', label: 'Western' },
  { value: 'Musical', label: 'Musical' },
  { value: 'Other', label: 'Other' },
];

const RATING_OPTIONS = [
  { value: '', label: '— Select Rating —' },
  { value: 'G', label: 'G' },
  { value: 'PG', label: 'PG' },
  { value: 'PG-13', label: 'PG-13' },
  { value: 'R', label: 'R' },
  { value: 'NC-17', label: 'NC-17' },
  { value: 'NR', label: 'Not Rated' },
];

const FORMAT_OPTIONS = [
  { value: 'VHS', label: 'VHS' },
  { value: 'DVD', label: 'DVD' },
  { value: 'Blu-ray', label: 'Blu-ray' },
];

export function TitleForm({ onClose, onSaved, titleId }: TitleFormProps) {
  const isEditing = !!titleId;

  const [name, setName] = useState('');
  const [year, setYear] = useState('');
  const [genre, setGenre] = useState('');
  const [rating, setRating] = useState('');
  const [synopsis, setSynopsis] = useState('');
  const [format, setFormat] = useState('VHS');
  const [quantity, setQuantity] = useState('1');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingTitle, setLoadingTitle] = useState(false);
  const [tmdbResults, setTmdbResults] = useState<any[]>([]);
  const [tmdbSearching, setTmdbSearching] = useState(false);
  const [tmdbId, setTmdbId] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [cast, setCast] = useState('');
  const [runtimeMinutes, setRuntimeMinutes] = useState<number | null>(null);

  useEffect(() => {
    if (!titleId) return;

    let cancelled = false;
    setLoadingTitle(true);

    api.titles.get(titleId)
      .then((data) => {
        if (cancelled) return;
        setName(data.name ?? '');
        setYear(String(data.year ?? ''));
        setGenre(data.genre ?? '');
        setRating(data.rating ?? '');
        setSynopsis(data.synopsis ?? '');
        setCast(data.cast ?? '');
        setCoverUrl(data.coverUrl ?? null);
        setTmdbId(data.tmdbId ? String(data.tmdbId) : null);
        setRuntimeMinutes(data.runtimeMinutes ?? null);
        setLoadingTitle(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load title');
        setLoadingTitle(false);
      });

    return () => { cancelled = true; };
  }, [titleId]);

  async function handleTmdbSearch() {
    if (!name.trim()) return;
    setTmdbSearching(true);
    setTmdbResults([]);
    try {
      const yearNum = year ? parseInt(year, 10) : undefined;
      const data = await api.tmdb.search(name.trim(), yearNum);
      setTmdbResults(Array.isArray(data) ? data : data.data ?? []);
    } catch {
      setError('TMDb search failed');
    } finally {
      setTmdbSearching(false);
    }
  }

  async function handleTmdbSelect(result: any) {
    try {
      const details = await api.tmdb.details(result.tmdbId, result.mediaType);
      setName(details.title ?? result.title ?? name);
      setYear(String(details.year ?? result.year ?? ''));
      setGenre(details.genre ?? '');
      setRating(details.rating ?? '');
      setSynopsis(details.synopsis ?? '');
      setCast(details.cast ?? '');
      setCoverUrl(details.coverUrl ?? result.posterUrl ?? null);
      setRuntimeMinutes(details.runtimeMinutes ?? null);
      setTmdbId(String(details.tmdbId));
      setTmdbResults([]);
    } catch {
      setError('Failed to fetch TMDb details');
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    if (!year.trim() || isNaN(Number(year))) {
      setError('Valid year is required');
      return;
    }

    setSaving(true);

    try {
      const payload: Record<string, unknown> = {
        name: name.trim(),
        year: Number(year),
        genre: genre || undefined,
        rating: rating || undefined,
        synopsis: synopsis.trim() || undefined,
        tmdbId: tmdbId || undefined,
        coverUrl: coverUrl || undefined,
        cast: cast || undefined,
        runtimeMinutes: runtimeMinutes || undefined,
      };

      if (isEditing) {
        await api.titles.update(titleId, payload);
      } else {
        const qty = Math.max(1, parseInt(quantity, 10) || 1);
        await api.titles.create({
          ...payload,
          format,
          quantity: qty,
        });
      }

      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save title');
    } finally {
      setSaving(false);
    }
  };

  const footer = (
    <>
      <Button variant="ghost" onClick={onClose} disabled={saving}>
        Cancel
      </Button>
      <Button variant="primary" type="submit" form="title-form" disabled={saving || loadingTitle}>
        {saving ? 'Saving...' : isEditing ? 'Update' : 'Create'}
      </Button>
    </>
  );

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={isEditing ? 'Edit Title' : 'Add Title'}
      footer={footer}
    >
      {loadingTitle ? (
        <div style={{ color: 'var(--crt-green)', textAlign: 'center', padding: 'var(--space-lg)' }}>
          Loading...
        </div>
      ) : (
        <form id="title-form" style={formStyle} onSubmit={handleSubmit}>
          {error && (
            <Alert variant="error" onDismiss={() => setError(null)}>
              {error}
            </Alert>
          )}

          <div>
            <div style={rowStyle}>
              <div style={{ flex: 1 }}>
                <Input
                  label="Name"
                  value={name}
                  onChange={(e) => { setName(e.target.value); setTmdbResults([]); }}
                  placeholder="Title name"
                  required
                  autoFocus
                />
              </div>
              <div style={{ alignSelf: 'flex-end' }}>
                <Button variant="secondary" onClick={handleTmdbSearch} disabled={tmdbSearching || !name.trim()}>
                  {tmdbSearching ? 'Searching...' : 'TMDb Lookup'}
                </Button>
              </div>
            </div>
            {tmdbResults.length > 0 && (
              <div style={tmdbDropdownStyle}>
                {tmdbResults.map((r: any) => (
                  <div
                    key={`${r.tmdbId}-${r.mediaType}`}
                    style={tmdbResultStyle}
                    onClick={() => handleTmdbSelect(r)}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--accent-10)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                  >
                    {r.posterUrl && (
                      <img src={r.posterUrl} alt="" style={{ width: '32px', height: '48px', objectFit: 'cover', borderRadius: '2px' }} />
                    )}
                    <div style={{ flex: 1 }}>
                      <div style={{ color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {r.title}
                        {r.mediaType === 'tv' && (
                          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--crt-amber)', border: '1px solid var(--crt-amber)', borderRadius: '3px', padding: '0 4px' }}>TV</span>
                        )}
                      </div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                        {r.year ?? '—'} | Rating: {r.voteAverage?.toFixed(1) ?? '—'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {coverUrl && (
              <div style={{ marginTop: 'var(--space-sm)', display: 'flex', gap: 'var(--space-sm)', alignItems: 'center' }}>
                <img src={coverUrl} alt="" style={{ width: '48px', height: '72px', objectFit: 'cover', borderRadius: '4px', border: '1px solid var(--border-color)' }} />
                <span style={{ color: 'var(--crt-green)', fontSize: 'var(--font-size-sm)' }}>TMDb matched</span>
              </div>
            )}
          </div>

          <div style={rowStyle}>
            <Input
              label="Year"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              placeholder="1984"
              type="number"
              min="1900"
              max="2099"
              required
            />
            <Select
              label="Genre"
              options={GENRE_OPTIONS}
              value={genre}
              onChange={(e) => setGenre(e.target.value)}
            />
          </div>

          <div style={rowStyle}>
            <Select
              label="Rating"
              options={RATING_OPTIONS}
              value={rating}
              onChange={(e) => setRating(e.target.value)}
            />
          </div>

          <div>
            <label style={textareaLabelStyle}>Synopsis</label>
            <textarea
              style={textareaStyle}
              value={synopsis}
              onChange={(e) => setSynopsis(e.target.value)}
              placeholder="Brief description..."
              rows={3}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--crt-green)';
                e.currentTarget.style.boxShadow = 'var(--glow-green)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-color)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            />
          </div>

          {!isEditing && (
            <div style={rowStyle}>
              <Select
                label="Format"
                options={FORMAT_OPTIONS}
                value={format}
                onChange={(e) => setFormat(e.target.value)}
              />
              <Input
                label="Quantity"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                type="number"
                min="1"
                max="100"
              />
            </div>
          )}
        </form>
      )}
    </Modal>
  );
}

const tmdbDropdownStyle: CSSProperties = {
  marginTop: 'var(--space-xs)',
  border: '1px solid var(--crt-green)',
  borderRadius: 'var(--border-radius)',
  backgroundColor: 'var(--bg-panel)',
  maxHeight: '200px',
  overflowY: 'auto',
};

const tmdbResultStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-sm)',
  padding: '6px 10px',
  cursor: 'pointer',
  borderBottom: '1px solid var(--border-color)',
  transition: 'background-color 0.1s ease',
};
