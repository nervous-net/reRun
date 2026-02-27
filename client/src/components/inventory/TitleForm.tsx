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
        setLoadingTitle(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load title');
        setLoadingTitle(false);
      });

    return () => { cancelled = true; };
  }, [titleId]);

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
      <Button variant="primary" onClick={handleSubmit} disabled={saving || loadingTitle}>
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
        <form style={formStyle} onSubmit={handleSubmit}>
          {error && (
            <Alert variant="error" onDismiss={() => setError(null)}>
              {error}
            </Alert>
          )}

          <Input
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Title name"
            required
            autoFocus
          />

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
