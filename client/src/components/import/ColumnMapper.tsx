// ABOUTME: Column mapping step for CSV import wizard
// ABOUTME: Lets users map CSV headers to reRun fields with a live preview table

import { type CSSProperties, useState } from 'react';
import { Button } from '../common/Button';
import { Select } from '../common/Select';

interface ColumnMapperProps {
  headers: string[];
  sampleRows: string[][];
  detectedMapping: Record<string, string>;
  onConfirm: (mapping: Record<string, string>) => void;
}

const RERUN_FIELDS = [
  { key: 'title', label: 'Title', required: true },
  { key: 'year', label: 'Year', required: false },
  { key: 'format', label: 'Format', required: false },
  { key: 'quantity', label: 'Quantity', required: false },
  { key: 'genre', label: 'Genre', required: false },
  { key: 'barcode', label: 'Barcode', required: false },
  { key: 'director', label: 'Director', required: false },
  { key: 'cast', label: 'Cast', required: false },
  { key: 'rating', label: 'Rating', required: false },
];

export function ColumnMapper({ headers, sampleRows, detectedMapping, onConfirm }: ColumnMapperProps) {
  const [mapping, setMapping] = useState<Record<string, string>>(detectedMapping);

  function handleChange(fieldKey: string, csvHeader: string) {
    setMapping((prev) => ({ ...prev, [fieldKey]: csvHeader }));
  }

  function getPreviewValue(rowIndex: number, fieldKey: string): string {
    const csvHeader = mapping[fieldKey];
    if (!csvHeader || csvHeader === '') return '';
    const colIndex = headers.indexOf(csvHeader);
    if (colIndex === -1) return '';
    return sampleRows[rowIndex]?.[colIndex] ?? '';
  }

  const selectOptions = [
    { value: '', label: '-- skip --' },
    ...headers.map((h) => ({ value: h, label: h })),
  ];

  const hasTitleMapping = mapping.title && mapping.title !== '';

  return (
    <div style={styles.container}>
      <h3 style={styles.heading}>Map Columns</h3>
      <p style={styles.hint}>
        Match your CSV columns to reRun fields. Only Title is required.
      </p>

      <div style={styles.mappingGrid}>
        {RERUN_FIELDS.map((field) => (
          <div key={field.key} style={styles.mappingRow}>
            <div style={styles.fieldLabel}>
              {field.label}
              {field.required && <span style={styles.required}>*</span>}
            </div>
            <div style={styles.selectWrapper}>
              <Select
                options={selectOptions}
                value={mapping[field.key] || ''}
                onChange={(e) => handleChange(field.key, e.target.value)}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Preview table */}
      <h4 style={styles.previewHeading}>Preview (first 3 rows)</h4>
      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead>
            <tr>
              {RERUN_FIELDS.filter((f) => mapping[f.key] && mapping[f.key] !== '').map((f) => (
                <th key={f.key} style={styles.th}>{f.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sampleRows.slice(0, 3).map((_, rowIndex) => (
              <tr key={rowIndex} style={rowIndex % 2 === 1 ? styles.altRow : undefined}>
                {RERUN_FIELDS.filter((f) => mapping[f.key] && mapping[f.key] !== '').map((f) => (
                  <td key={f.key} style={styles.td}>{getPreviewValue(rowIndex, f.key)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={styles.actions}>
        <Button variant="primary" onClick={() => onConfirm(mapping)} disabled={!hasTitleMapping}>
          Confirm Mapping
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
  hint: {
    color: 'var(--text-secondary)',
    fontSize: 'var(--font-size-sm)',
    margin: 0,
  },
  mappingGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-sm)',
    maxWidth: '500px',
  },
  mappingRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-md)',
  },
  fieldLabel: {
    width: '100px',
    flexShrink: 0,
    color: 'var(--text-primary)',
    fontSize: 'var(--font-size-md)',
    textAlign: 'right',
  },
  required: {
    color: 'var(--crt-red)',
    marginLeft: '2px',
  },
  selectWrapper: {
    flex: 1,
  },
  previewHeading: {
    color: 'var(--crt-green-dim)',
    fontSize: 'var(--font-size-md)',
    margin: 0,
    marginTop: 'var(--space-sm)',
  },
  tableWrapper: {
    overflowX: 'auto',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--border-radius)',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 'var(--font-size-sm)',
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
  },
  td: {
    color: 'var(--text-primary)',
    padding: '4px 8px',
    borderBottom: '1px solid var(--border-color)',
  },
  altRow: {
    backgroundColor: 'var(--accent-02)',
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    paddingTop: 'var(--space-sm)',
  },
};
