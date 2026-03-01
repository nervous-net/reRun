// ABOUTME: Fuzzy string matching utilities for TMDb title matching during CSV import
// ABOUTME: Provides Levenshtein-based similarity, composite scoring, and query variation generation

/**
 * Normalize a title string for comparison: lowercase, strip leading "the",
 * remove punctuation, and collapse whitespace.
 */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/^the\s+/, '')
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Compute Levenshtein edit distance between two strings.
 */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;

  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }

  return dp[m][n];
}

/**
 * Title similarity score between 0 and 1 using normalized Levenshtein distance.
 */
export function titleSimilarity(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);

  if (na.length === 0 && nb.length === 0) return 1.0;
  if (na.length === 0 || nb.length === 0) return 0;

  const maxLen = Math.max(na.length, nb.length);
  const dist = levenshtein(na, nb);

  return 1 - dist / maxLen;
}

/**
 * Composite match score: 70% title similarity + 30% year match.
 * Year match: exact = 1.0, ±1 year = 0.5, else 0.
 * If either year is missing, year component is omitted (score based on title only).
 */
export function scoreTmdbMatch(
  inputTitle: string,
  resultTitle: string,
  inputYear?: number,
  resultYear?: number,
): number {
  const titleScore = titleSimilarity(inputTitle, resultTitle);

  if (inputYear == null || resultYear == null) {
    return 0.7 * titleScore;
  }

  const diff = Math.abs(inputYear - resultYear);
  const yearScore = diff === 0 ? 1.0 : diff === 1 ? 0.5 : 0;

  return 0.7 * titleScore + 0.3 * yearScore;
}

/**
 * Generate search query variations to improve TMDb matching.
 * Returns: original, strip subtitle after colon, drop leading "The",
 * strip trailing parenthetical year. All deduplicated.
 */
export function queryVariations(title: string): string[] {
  const variations: string[] = [title];

  // Strip subtitle after colon
  const colonIdx = title.indexOf(':');
  if (colonIdx > 0) {
    variations.push(title.substring(0, colonIdx).trim());
  }

  // Drop leading "The"
  if (/^the\s+/i.test(title)) {
    variations.push(title.replace(/^the\s+/i, ''));
  }

  // Strip trailing parenthetical year
  const withoutYear = title.replace(/\s*\(\d{4}\)\s*$/, '').trim();
  if (withoutYear !== title) {
    variations.push(withoutYear);
  }

  // Deduplicate while preserving order
  return [...new Set(variations)];
}
