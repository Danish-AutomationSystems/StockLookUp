import type { SheetConfig, SearchResult } from '@/types';

export function findMatchingRow(
  headers: string[],
  rows: string[][],
  config: SheetConfig,
  query: string
): SearchResult | null {
  const searchColIndex = headers.indexOf(config.searchColumn);
  if (searchColIndex === -1) return null;

  const normalizedQuery = query.trim().toLowerCase();
  const matchRow = rows.find(
    (row) => (row[searchColIndex] ?? '').trim().toLowerCase() === normalizedQuery
  );
  if (!matchRow) return null;

  const result: SearchResult = {};
  for (const col of config.resultColumns) {
    const idx = headers.indexOf(col);
    result[col] = idx === -1 ? '' : matchRow[idx] ?? '';
  }
  return result;
}
