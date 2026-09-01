import type { SheetConfig } from '@/types';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateConfig(headers: string[], config: SheetConfig): ValidationResult {
  const errors: string[] = [];
  const seenResultColumns = new Set<string>();

  if (!config.searchColumn || !headers.includes(config.searchColumn)) {
    errors.push(`Search column "${config.searchColumn}" not found in sheet headers`);
  }

  if (!config.resultColumns || config.resultColumns.length === 0) {
    errors.push('At least one result column is required');
  } else {
    for (const col of config.resultColumns) {
      if (!headers.includes(col)) {
        errors.push(`Result column "${col}" not found in sheet headers`);
        continue;
      }

      if (col === config.searchColumn) {
        errors.push(`Result column "${col}" cannot be the search column`);
      }

      if (seenResultColumns.has(col)) {
        errors.push(`Result column "${col}" is duplicated`);
      } else {
        seenResultColumns.add(col);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
