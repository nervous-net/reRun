// ABOUTME: Main inventory browser page with search, filters, grid/list views
// ABOUTME: Fetches titles via search API with debounced input and filter sidebar

import { type CSSProperties, useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Select } from '../common/Select';
import { Badge } from '../common/Badge';
import { Table } from '../common/Table';
import { TitleCard, type TitleSummary } from './TitleCard';
import { TitleDetail } from './TitleDetail';
import { TitleForm } from './TitleForm';
import { api } from '../../api/client';

type ViewMode = 'grid' | 'list';

const FORMAT_CHOICES = ['VHS', 'DVD', 'Blu-ray'];

const RATING_FILTER_OPTIONS = [
  { value: '', label: 'All Ratings' },
  { value: 'G', label: 'G' },
  { value: 'PG', label: 'PG' },
  { value: 'PG-13', label: 'PG-13' },
  { value: 'R', label: 'R' },
  { value: 'NC-17', label: 'NC-17' },
  { value: 'NR', label: 'Not Rated' },
];

// --- Layout styles ---

const pageStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  overflow: 'hidden',
};

const topBarStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-sm)',
  padding: 'var(--space-sm) var(--space-md)',
  borderBottom: '1px solid var(--border-color)',
  flexShrink: 0,
};

const bodyStyle: CSSProperties = {
  display: 'flex',
  flex: 1,
  overflow: 'hidden',
};

const sidebarStyle: CSSProperties = {
  width: '200px',
  flexShrink: 0,
  padding: 'var(--space-md)',
  borderRight: '1px solid var(--border-color)',
  backgroundColor: 'var(--bg-secondary)',
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-md)',
};

const mainAreaStyle: CSSProperties = {
  flex: 1,
  overflow: 'auto',
  padding: 'var(--space-md)',
};

// --- Sidebar styles ---

const sidebarSectionStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-xs)',
};

const sidebarLabelStyle: CSSProperties = {
  color: 'var(--crt-green)',
  fontSize: 'var(--font-size-sm)',
  textTransform: 'uppercase',
  letterSpacing: '1px',
  borderBottom: '1px solid var(--border-color)',
  paddingBottom: 'var(--space-xs)',
};

const checkboxRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-sm)',
  cursor: 'pointer',
  color: 'var(--text-primary)',
  fontSize: 'var(--font-size-md)',
};

const toggleRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  cursor: 'pointer',
  color: 'var(--text-primary)',
  fontSize: 'var(--font-size-md)',
};

const toggleIndicatorStyle = (active: boolean): CSSProperties => ({
  display: 'inline-block',
  width: '12px',
  height: '12px',
  borderRadius: '2px',
  border: `1px solid ${active ? 'var(--crt-green)' : 'var(--border-color)'}`,
  backgroundColor: active ? 'var(--crt-green)' : 'transparent',
  transition: 'background-color 0.15s ease, border-color 0.15s ease',
});

// --- View toggle ---

const viewToggleStyle: CSSProperties = {
  display: 'flex',
  border: '1px solid var(--border-color)',
  borderRadius: 'var(--border-radius)',
  overflow: 'hidden',
};

const viewToggleButtonStyle = (active: boolean): CSSProperties => ({
  padding: '4px 10px',
  background: active ? 'var(--bg-panel)' : 'transparent',
  border: 'none',
  color: active ? 'var(--crt-green)' : 'var(--text-secondary)',
  fontFamily: 'inherit',
  fontSize: 'var(--font-size-sm)',
  cursor: 'pointer',
  textTransform: 'uppercase',
  letterSpacing: '1px',
  transition: 'color 0.15s ease, background 0.15s ease',
});

// --- Grid ---

const gridStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 'var(--space-md)',
};

// --- Status ---

const statusBarStyle: CSSProperties = {
  color: 'var(--text-secondary)',
  fontSize: 'var(--font-size-sm)',
  padding: 'var(--space-xs) 0',
};

const emptyStateStyle: CSSProperties = {
  color: 'var(--text-muted)',
  textAlign: 'center',
  padding: 'var(--space-xl)',
  fontSize: 'var(--font-size-md)',
};

const loadingStyle: CSSProperties = {
  color: 'var(--crt-green)',
  textAlign: 'center',
  padding: 'var(--space-xl)',
  fontSize: 'var(--font-size-md)',
};

// --- List columns ---

const listColumns = [
  { key: 'name', label: 'Title' },
  { key: 'year', label: 'Year', width: '60px' },
  { key: 'genre', label: 'Genre', width: '100px' },
  { key: 'rating', label: 'Rating', width: '70px' },
  { key: 'formats', label: 'Formats', width: '140px' },
  { key: 'availability', label: 'Avail', width: '90px' },
];

function mapTitleToSummary(raw: any): TitleSummary {
  return {
    id: raw.id,
    name: raw.name,
    year: raw.year,
    genre: raw.genre ?? '',
    rating: raw.rating ?? '',
    coverUrl: raw.coverUrl,
    availableCopies: raw.availableCopies ?? 0,
    totalCopies: raw.totalCopies ?? 0,
    formats: raw.formats ?? [],
  };
}

function getAvailBadgeVariant(available: number, total: number): 'success' | 'warning' | 'danger' {
  if (total === 0 || available === 0) return 'danger';
  if (available < total) return 'warning';
  return 'success';
}

export function InventoryBrowser() {
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [titles, setTitles] = useState<TitleSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [genreFilter, setGenreFilter] = useState('');
  const [formatFilters, setFormatFilters] = useState<Set<string>>(new Set());
  const [availableOnly, setAvailableOnly] = useState(false);
  const [ratingFilter, setRatingFilter] = useState('');
  const [showDeleted, setShowDeleted] = useState(false);

  // Genre options built from results
  const [genreOptions, setGenreOptions] = useState<{ value: string; label: string }[]>([
    { value: '', label: 'All Genres' },
  ]);

  // Panels
  const [detailTitleId, setDetailTitleId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editTitleId, setEditTitleId] = useState<string | null>(null);

  // Select mode
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ deleted: string[]; skipped: any[] } | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const buildParams = useCallback(() => {
    const params: Record<string, string> = { limit: '50' };
    if (searchQuery.trim()) params.q = searchQuery.trim();
    if (genreFilter) params.genre = genreFilter;
    if (ratingFilter) params.rating = ratingFilter;
    if (availableOnly) params.available = 'true';
    if (formatFilters.size > 0) params.format = [...formatFilters].join(',');
    if (showDeleted) params.showInactive = '1';
    return params;
  }, [searchQuery, genreFilter, formatFilters, availableOnly, ratingFilter, showDeleted]);

  const fetchTitles = useCallback(async () => {
    setLoading(true);
    setError(null);
    setPage(1);

    try {
      const params = buildParams();
      params.page = '1';

      const data = await api.search.query(params);
      const results: any[] = data.titles ?? [];
      const mapped = results.map(mapTitleToSummary);
      setTitles(mapped);
      setTotal(data.total ?? 0);

      // Build genre options from all unique genres
      const genres = [...new Set(mapped.map((t) => t.genre).filter(Boolean))].sort();
      setGenreOptions([
        { value: '', label: 'All Genres' },
        ...genres.map((g) => ({ value: g, label: g })),
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load inventory');
      setTitles([]);
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  const fetchMore = useCallback(async () => {
    const nextPage = page + 1;
    setLoadingMore(true);
    try {
      const params = buildParams();
      params.page = String(nextPage);

      const data = await api.search.query(params);
      const results: any[] = data.titles ?? [];
      const mapped = results.map(mapTitleToSummary);
      setTitles((prev) => [...prev, ...mapped]);
      setPage(nextPage);
      setTotal(data.total ?? 0);
    } catch {
      // silent — user can retry
    } finally {
      setLoadingMore(false);
    }
  }, [page, buildParams]);

  // Debounced fetch on filter/search changes
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchTitles();
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [fetchTitles]);

  const toggleFormat = (fmt: string) => {
    setFormatFilters((prev) => {
      const next = new Set(prev);
      if (next.has(fmt)) {
        next.delete(fmt);
      } else {
        next.add(fmt);
      }
      return next;
    });
  };

  const handleTitleClick = (id: string) => {
    setDetailTitleId(id);
  };

  const handleFormSaved = () => {
    setShowForm(false);
    setEditTitleId(null);
    fetchTitles();
  };

  const handleEditTitle = (id: string) => {
    setDetailTitleId(null);
    setEditTitleId(id);
    setShowForm(true);
  };

  // Select mode helpers
  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === titles.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(titles.map((t) => t.id)));
    }
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelectedIds(new Set());
    setBulkResult(null);
  }

  async function handleBulkDelete() {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
    if (!window.confirm(`Permanently delete ${count} title${count !== 1 ? 's' : ''} and all their copies? This cannot be undone.`)) return;

    setBulkDeleting(true);
    try {
      const result = await api.titles.bulkDelete(Array.from(selectedIds));
      setBulkResult(result);
      setSelectedIds(new Set());
      fetchTitles();
    } catch (err: any) {
      setError(err.message || 'Bulk delete failed');
    } finally {
      setBulkDeleting(false);
    }
  }

  // Build list-view data
  const listData = titles.map((t) => ({
    id: t.id,
    name: t.name,
    year: String(t.year),
    genre: t.genre || '—',
    rating: t.rating || '—',
    formats: (
      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
        {t.formats.map((f) => <Badge key={f} variant="info">{f}</Badge>)}
      </div>
    ),
    availability: (
      <Badge variant={getAvailBadgeVariant(t.availableCopies, t.totalCopies)}>
        {t.totalCopies === 0 ? 'None' : `${t.availableCopies}/${t.totalCopies}`}
      </Badge>
    ),
  }));

  return (
    <div style={pageStyle}>
      {/* Top Bar: Search + View Toggle + Add Button */}
      <div style={topBarStyle}>
        <div style={{ flex: 1, maxWidth: '400px' }}>
          <Input
            placeholder="Search titles..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div style={viewToggleStyle}>
          <button
            style={viewToggleButtonStyle(viewMode === 'grid')}
            onClick={() => setViewMode('grid')}
            title="Grid view"
          >
            Grid
          </button>
          <button
            style={viewToggleButtonStyle(viewMode === 'list')}
            onClick={() => setViewMode('list')}
            title="List view"
          >
            List
          </button>
        </div>

        {!selectMode && (
          <Button variant="primary" onClick={() => setShowForm(true)}>
            + Add Title
          </Button>
        )}

        {!selectMode ? (
          <Button variant="secondary" onClick={() => setSelectMode(true)}>
            Select
          </Button>
        ) : (
          <Button variant="secondary" onClick={exitSelectMode}>
            Cancel
          </Button>
        )}
      </div>

      {/* Body: Sidebar + Main Content */}
      <div style={bodyStyle}>
        {/* Filter Sidebar */}
        <aside style={sidebarStyle}>
          <div style={sidebarSectionStyle}>
            <div style={sidebarLabelStyle}>Genre</div>
            <Select
              options={genreOptions}
              value={genreFilter}
              onChange={(e) => setGenreFilter(e.target.value)}
            />
          </div>

          <div style={sidebarSectionStyle}>
            <div style={sidebarLabelStyle}>Format</div>
            {FORMAT_CHOICES.map((fmt) => (
              <label key={fmt} style={checkboxRowStyle}>
                <input
                  type="checkbox"
                  checked={formatFilters.has(fmt)}
                  onChange={() => toggleFormat(fmt)}
                  style={{ accentColor: 'var(--crt-green)' }}
                />
                {fmt}
              </label>
            ))}
          </div>

          <div style={sidebarSectionStyle}>
            <div style={sidebarLabelStyle}>Availability</div>
            <div
              style={toggleRowStyle}
              onClick={() => setAvailableOnly(!availableOnly)}
              onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setAvailableOnly(!availableOnly); } }}
              role="checkbox"
              aria-checked={availableOnly}
              tabIndex={0}
            >
              <span>In stock only</span>
              <span style={toggleIndicatorStyle(availableOnly)} />
            </div>
          </div>

          <div style={sidebarSectionStyle}>
            <div style={sidebarLabelStyle}>Rating</div>
            <Select
              options={RATING_FILTER_OPTIONS}
              value={ratingFilter}
              onChange={(e) => setRatingFilter(e.target.value)}
            />
          </div>

          <div style={sidebarSectionStyle}>
            <div style={sidebarLabelStyle}>Deleted</div>
            <div
              style={toggleRowStyle}
              onClick={() => setShowDeleted(!showDeleted)}
              role="checkbox"
              aria-checked={showDeleted}
            >
              <span>Show deleted</span>
              <span style={toggleIndicatorStyle(showDeleted)} />
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <div style={mainAreaStyle}>
          <div style={statusBarStyle}>
            {loading ? 'Searching...' : `${titles.length} of ${total} title${total !== 1 ? 's' : ''}`}
            {error && <span style={{ color: 'var(--crt-red)', marginLeft: 'var(--space-sm)' }}>({error})</span>}
          </div>

          {loading && titles.length === 0 && (
            <div style={loadingStyle}>Scanning inventory...</div>
          )}

          {!loading && titles.length === 0 && !error && (
            <div style={emptyStateStyle}>
              No titles found. Try adjusting your search or filters.
            </div>
          )}

          {titles.length > 0 && viewMode === 'grid' && (
            <div style={gridStyle}>
              {titles.map((title) => (
                <div key={title.id} style={{ position: 'relative' }}>
                  {selectMode && (
                    <input
                      type="checkbox"
                      checked={selectedIds.has(title.id)}
                      onChange={() => toggleSelect(title.id)}
                      style={{
                        position: 'absolute', top: '8px', left: '8px', zIndex: 2,
                        accentColor: 'var(--crt-green)', width: '18px', height: '18px', cursor: 'pointer',
                      }}
                    />
                  )}
                  <TitleCard
                    title={title}
                    onClick={selectMode ? () => toggleSelect(title.id) : handleTitleClick}
                  />
                </div>
              ))}
            </div>
          )}

          {titles.length > 0 && viewMode === 'list' && (
            <Table
              columns={selectMode ? [{ key: 'checkbox', label: '', width: '36px' }, ...listColumns] : listColumns}
              data={selectMode
                ? listData.map((row) => ({
                    checkbox: (
                      <input
                        type="checkbox"
                        checked={selectedIds.has(row.id as string)}
                        onChange={(e) => { e.stopPropagation(); toggleSelect(row.id as string); }}
                        style={{ accentColor: 'var(--crt-green)', cursor: 'pointer' }}
                      />
                    ),
                    ...row,
                  }))
                : listData
              }
              onRowClick={selectMode
                ? (row) => toggleSelect(row.id as string)
                : (row) => handleTitleClick(row.id as string)
              }
              emptyMessage="No titles found"
            />
          )}

          {titles.length < total && !loading && (
            <div style={{ textAlign: 'center', padding: 'var(--space-md)' }}>
              <Button variant="secondary" onClick={fetchMore} disabled={loadingMore}>
                {loadingMore ? 'Loading...' : `Load More (${total - titles.length} remaining)`}
              </Button>
            </div>
          )}

          {selectMode && (
            <div style={{
              position: 'sticky', bottom: 0,
              display: 'flex', alignItems: 'center', gap: 'var(--space-md)',
              padding: 'var(--space-sm) var(--space-md)',
              borderTop: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-secondary)',
            }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', color: 'var(--text-primary)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={titles.length > 0 && selectedIds.size === titles.length}
                  onChange={toggleSelectAll}
                  style={{ accentColor: 'var(--crt-green)' }}
                />
                Select All on Page
              </label>
              <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                {selectedIds.size} selected
              </span>
              <div style={{ flex: 1 }} />
              <Button
                variant="danger"
                onClick={handleBulkDelete}
                disabled={selectedIds.size === 0 || bulkDeleting}
              >
                {bulkDeleting ? 'Deleting...' : 'Delete Selected'}
              </Button>
            </div>
          )}

          {bulkResult && (
            <div style={{
              padding: 'var(--space-sm) var(--space-md)',
              backgroundColor: 'var(--bg-secondary)',
              borderTop: '1px solid var(--border-color)',
              color: 'var(--crt-green)', fontSize: 'var(--font-size-sm)',
            }}>
              Deleted {bulkResult.deleted.length} title{bulkResult.deleted.length !== 1 ? 's' : ''}.
              {bulkResult.skipped.length > 0 && (
                <> Skipped {bulkResult.skipped.length} with active rentals: {bulkResult.skipped.map((s: any) => s.name).join(', ')}.</>
              )}
              <span style={{ marginLeft: 'var(--space-sm)' }}>
                <Button variant="secondary" onClick={() => setBulkResult(null)}>
                  Dismiss
                </Button>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Slide-in Detail Panel */}
      {detailTitleId && (
        <TitleDetail
          titleId={detailTitleId}
          onClose={() => setDetailTitleId(null)}
          onEdit={handleEditTitle}
          onDeleted={fetchTitles}
        />
      )}

      {/* Add/Edit Title Modal */}
      {showForm && (
        <TitleForm
          onClose={() => { setShowForm(false); setEditTitleId(null); }}
          onSaved={handleFormSaved}
          titleId={editTitleId ?? undefined}
        />
      )}
    </div>
  );
}
