import { describe, it, expect } from 'vitest';
import { findMatchingRow } from '@/lib/searchLogic';

const headers = ['SKU', 'Name', 'Price', 'Stock'];
const rows = [
  ['ABC123', 'Widget', '9.99', '42'],
  ['XYZ789', 'Gadget', '19.99', '7'],
];

describe('findMatchingRow', () => {
  it('finds exact match on search column', () => {
    const result = findMatchingRow(headers, rows, { searchColumn: 'SKU', resultColumns: ['Name', 'Price'] }, 'ABC123');
    expect(result).toEqual({ Name: 'Widget', Price: '9.99' });
  });

  it('is case-insensitive and trims whitespace', () => {
    const result = findMatchingRow(headers, rows, { searchColumn: 'SKU', resultColumns: ['Name'] }, '  abc123  ');
    expect(result).toEqual({ Name: 'Widget' });
  });

  it('returns null when no row matches', () => {
    const result = findMatchingRow(headers, rows, { searchColumn: 'SKU', resultColumns: ['Name'] }, 'NOPE');
    expect(result).toBeNull();
  });

  it('returns null when search column is not in headers', () => {
    const result = findMatchingRow(headers, rows, { searchColumn: 'Missing', resultColumns: ['Name'] }, 'ABC123');
    expect(result).toBeNull();
  });

  it('fills empty string for a result column missing from a row', () => {
    const shortRows = [['ABC123', 'Widget']];
    const result = findMatchingRow(headers, shortRows, { searchColumn: 'SKU', resultColumns: ['Name', 'Stock'] }, 'ABC123');
    expect(result).toEqual({ Name: 'Widget', Stock: '' });
  });
});
