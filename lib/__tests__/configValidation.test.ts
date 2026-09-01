import { describe, it, expect } from 'vitest';
import { validateConfig } from '@/lib/configValidation';

const headers = ['SKU', 'Name', 'Price', 'Stock'];

describe('validateConfig', () => {
  it('accepts a valid config', () => {
    const result = validateConfig(headers, { searchColumn: 'SKU', resultColumns: ['Name', 'Price'] });
    expect(result).toEqual({ valid: true, errors: [] });
  });

  it('rejects a search column not in headers', () => {
    const result = validateConfig(headers, { searchColumn: 'Nope', resultColumns: ['Name'] });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Search column "Nope" not found in sheet headers');
  });

  it('rejects an empty resultColumns array', () => {
    const result = validateConfig(headers, { searchColumn: 'SKU', resultColumns: [] });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('At least one result column is required');
  });

  it('rejects a result column not in headers', () => {
    const result = validateConfig(headers, { searchColumn: 'SKU', resultColumns: ['Nope'] });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Result column "Nope" not found in sheet headers');
  });

  it('rejects duplicate result columns', () => {
    const result = validateConfig(headers, { searchColumn: 'SKU', resultColumns: ['Name', 'Name'] });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Result column "Name" is duplicated');
  });

  it('rejects a result column equal to the search column', () => {
    const result = validateConfig(headers, { searchColumn: 'SKU', resultColumns: ['SKU'] });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Result column "SKU" cannot be the search column');
  });
});
