import type { SheetConfig } from '@/types';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateConfig(headers: string[], config: SheetConfig): ValidationResult {
  const errors: string[] = [];

  if (!config.searchColumn || !headers.includes(config.searchColumn)) {
    errors.push(`Search column "${config.searchColumn}" not found in sheet headers`);
  }

  if (!config.resultColumns || config.resultColumns.length === 0) {
    errors.push('At least one result column is required');
  } else {
    for (const col of config.resultColumns) {
      if (!headers.includes(col)) {
        errors.push(`Result column "${col}" not found in sheet headers`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
