// ABOUTME: 5-step CSV import wizard orchestrating file upload through database commit
// ABOUTME: Manages wizard state, step transitions, and API calls for bulk title imports

import { type CSSProperties, useState } from 'react';
import { api } from '../../api/client';
import { FileUpload } from './FileUpload';
import { ColumnMapper } from './ColumnMapper';
import { MatchReview, type ImportTitle } from './MatchReview';
import { ImportProgress } from './ImportProgress';

const STEPS = [
  { number: 1, label: 'Upload' },
  { number: 2, label: 'Map Columns' },
  { number: 3, label: 'Match' },
  { number: 4, label: 'Review' },
  { number: 5, label: 'Import' },
];

interface ParseResult {
  headers: string[];
  sampleRows: string[][];
  rowCount: number;
  detectedMapping: Record<string, string>;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

export function ImportWizard() {
  const [currentStep, setCurrentStep] = useState(1);
  const [parsedData, setParsedData] = useState<ParseResult | null>(null);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [matchedTitles, setMatchedTitles] = useState<ImportTitle[]>([]);
  const [importResults, setImportResults] = useState<any>(null);
  const [csvContent, setCsvContent] = useState<string>('');
  const [matchLoading, setMatchLoading] = useState(false);
  const [matchError, setMatchError] = useState<string | null>(null);

  async function handleFileLoaded(csv: string) {
    setCsvContent(csv);
    try {
      const result = await api.import.parse({ csv });
      setParsedData(result);
      setCurrentStep(2);
    } catch (err) {
      // If parse endpoint fails, do basic client-side parsing as fallback
      const lines = csv.split('\n').filter((l) => l.trim());
      const headers = parseCSVLine(lines[0] ?? '');
      const sampleRows = lines.slice(1, 4).map((line) => parseCSVLine(line));

      // Attempt auto-detection of column mapping
      const detectedMapping: Record<string, string> = {};
      const headerLower = headers.map((h) => h.toLowerCase());

      const mappingRules: [string, string[]][] = [
        ['title', ['title', 'name', 'movie', 'film']],
        ['format', ['format', 'vhs/dvd/bluray', 'media', 'type']],
        ['director', ['director', 'director(s)', 'directors']],
        ['cast', ['cast', 'actors', 'principal actors', 'starring']],
        ['rating', ['rating', 'mpaa', 'rated']],
        ['year', ['year', 'release year']],
        ['genre', ['genre', 'category']],
        ['quantity', ['quantity', 'qty', 'copies']],
        ['barcode', ['barcode', 'upc', 'sku']],
      ];

      for (const [field, keywords] of mappingRules) {
        for (const keyword of keywords) {
          const idx = headerLower.indexOf(keyword);
          if (idx !== -1) {
            detectedMapping[field] = headers[idx];
            break;
          }
        }
      }

      setParsedData({
        headers,
        sampleRows,
        rowCount: Math.max(0, lines.length - 1),
        detectedMapping,
      });
      setCurrentStep(2);
    }
  }

  async function handleMappingConfirmed(mapping: Record<string, string>) {
    setColumnMapping(mapping);
    setMatchLoading(true);
    setMatchError(null);
    setCurrentStep(3);

    try {
      // Parse all rows using the mapping
      const lines = csvContent.split('\n').filter((l) => l.trim());
      const headers = parseCSVLine(lines[0] ?? '');
      const rows = lines.slice(1).map((line) => parseCSVLine(line));

      const result = await api.import.match({ rows, headers, mapping });
      setMatchedTitles(result.titles ?? []);
      setMatchLoading(false);
      setCurrentStep(4);
    } catch (err) {
      // Fallback: construct titles locally from CSV data
      const lines = csvContent.split('\n').filter((l) => l.trim());
      const headers = parseCSVLine(lines[0] ?? '');
      const rows = lines.slice(1).map((line) => parseCSVLine(line));

      const titles: ImportTitle[] = rows.map((row) => {
        const getValue = (field: string): string => {
          const csvHeader = mapping[field];
          if (!csvHeader) return '';
          const idx = headers.indexOf(csvHeader);
          return idx >= 0 ? (row[idx] ?? '') : '';
        };

        return {
          title: getValue('title'),
          year: getValue('year'),
          format: getValue('format'),
          quantity: getValue('quantity') || '1',
          genre: getValue('genre'),
          barcode: getValue('barcode'),
          director: getValue('director'),
          cast: getValue('cast'),
          rating: getValue('rating'),
          matched: false,
        };
      });

      setMatchedTitles(titles);
      setMatchLoading(false);
      setCurrentStep(4);
    }
  }

  function handleReviewConfirmed(finalTitles: ImportTitle[]) {
    setMatchedTitles(finalTitles);
    setCurrentStep(5);
  }

  function handleImportComplete(results: any) {
    setImportResults(results);
  }

  function getStepStyle(stepNumber: number): CSSProperties {
    if (stepNumber === currentStep) return styles.stepActive;
    if (stepNumber < currentStep) return styles.stepCompleted;
    return styles.stepFuture;
  }

  function getConnectorStyle(stepNumber: number): CSSProperties {
    if (stepNumber < currentStep) return styles.connectorCompleted;
    return styles.connectorFuture;
  }

  return (
    <div style={styles.container}>
      {/* Step indicator */}
      <div style={styles.stepIndicator}>
        {STEPS.map((step, idx) => (
          <div key={step.number} style={styles.stepGroup}>
            <div style={styles.stepItem}>
              <div style={getStepStyle(step.number)}>
                {step.number < currentStep ? '\u2713' : step.number}
              </div>
              <span style={{
                ...styles.stepLabel,
                color: step.number === currentStep
                  ? 'var(--crt-green)'
                  : step.number < currentStep
                    ? 'var(--crt-green-dim)'
                    : 'var(--text-muted)',
              }}>
                {step.label}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div style={getConnectorStyle(step.number)} />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div style={styles.content}>
        {currentStep === 1 && (
          <FileUpload onFileLoaded={handleFileLoaded} />
        )}

        {currentStep === 2 && parsedData && (
          <ColumnMapper
            headers={parsedData.headers}
            sampleRows={parsedData.sampleRows}
            detectedMapping={parsedData.detectedMapping}
            onConfirm={handleMappingConfirmed}
          />
        )}

        {currentStep === 3 && matchLoading && (
          <div style={styles.loadingContainer}>
            <h3 style={styles.loadingHeading}>Matching Titles...</h3>
            <p style={styles.loadingText}>
              Processing rows against the database. This may take a moment for large files.
            </p>
            <div style={styles.spinner}>[ . . . ]</div>
          </div>
        )}

        {currentStep === 4 && matchedTitles.length > 0 && (
          <MatchReview
            titles={matchedTitles}
            onConfirm={handleReviewConfirmed}
          />
        )}

        {currentStep === 5 && (
          <ImportProgress
            titles={matchedTitles}
            onComplete={handleImportComplete}
          />
        )}
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'hidden',
  },
  stepIndicator: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 'var(--space-md) var(--space-lg)',
    borderBottom: '1px solid var(--border-color)',
    background: 'var(--bg-secondary)',
    flexShrink: 0,
  },
  stepGroup: {
    display: 'flex',
    alignItems: 'center',
  },
  stepItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 'var(--space-xs)',
  },
  stepActive: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    border: '2px solid var(--crt-green)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--crt-green)',
    fontSize: 'var(--font-size-sm)',
    fontWeight: 'bold',
    textShadow: 'var(--glow-green)',
    boxShadow: 'var(--glow-green)',
  },
  stepCompleted: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    border: '2px solid var(--crt-green-dim)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--crt-green-dim)',
    fontSize: 'var(--font-size-sm)',
    background: 'var(--accent-05)',
  },
  stepFuture: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    border: '2px solid var(--text-muted)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--text-muted)',
    fontSize: 'var(--font-size-sm)',
  },
  stepLabel: {
    fontSize: 'var(--font-size-sm)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    whiteSpace: 'nowrap',
  },
  connectorCompleted: {
    width: '40px',
    height: '2px',
    background: 'var(--crt-green-dim)',
    margin: '0 var(--space-sm)',
    marginBottom: '20px',
  },
  connectorFuture: {
    width: '40px',
    height: '2px',
    background: 'var(--text-muted)',
    margin: '0 var(--space-sm)',
    marginBottom: '20px',
  },
  content: {
    flex: 1,
    overflow: 'auto',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 'var(--space-md)',
    padding: 'var(--space-xl)',
  },
  loadingHeading: {
    color: 'var(--crt-green)',
    textShadow: 'var(--glow-green)',
    fontSize: 'var(--font-size-lg)',
    margin: 0,
  },
  loadingText: {
    color: 'var(--text-secondary)',
    fontSize: 'var(--font-size-md)',
    margin: 0,
    textAlign: 'center',
  },
  spinner: {
    color: 'var(--crt-green)',
    fontSize: 'var(--font-size-xl)',
    textShadow: 'var(--glow-green)',
    animation: 'pulse 1.5s ease-in-out infinite',
  },
};
