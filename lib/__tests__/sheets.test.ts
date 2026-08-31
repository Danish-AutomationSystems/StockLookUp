import { describe, it, expect, vi } from 'vitest';
import {
  getDataSheetTitle,
  getHeadersAndRows,
  ensureConfigSheet,
  getConfig,
  setConfig,
} from '@/lib/sheets';

function makeMockClient(overrides: any = {}) {
  return {
    spreadsheets: {
      get: vi.fn().mockResolvedValue({
        data: { sheets: [{ properties: { title: 'Products' } }] },
      }),
      batchUpdate: vi.fn().mockResolvedValue({}),
      values: {
        get: vi.fn().mockResolvedValue({ data: { values: [] } }),
        update: vi.fn().mockResolvedValue({}),
      },
      ...overrides,
    },
  } as any;
}

describe('getDataSheetTitle', () => {
  it('returns the title of the first non-_config sheet', async () => {
    const client = makeMockClient({
      get: vi.fn().mockResolvedValue({
        data: {
          sheets: [
            { properties: { title: '_config' } },
            { properties: { title: 'Products' } },
          ],
        },
      }),
    });
    const title = await getDataSheetTitle(client, 'sheet-id');
    expect(title).toBe('Products');
  });

  it('throws when no data sheet is found', async () => {
    const client = makeMockClient({
      get: vi.fn().mockResolvedValue({ data: { sheets: [{ properties: { title: '_config' } }] } }),
    });
    await expect(getDataSheetTitle(client, 'sheet-id')).rejects.toThrow('No data sheet found in spreadsheet');
  });
});

describe('getHeadersAndRows', () => {
  it('splits the first row as headers and the rest as rows', async () => {
    const client = makeMockClient();
    client.spreadsheets.values.get = vi.fn().mockResolvedValue({
      data: { values: [['SKU', 'Name'], ['A1', 'Widget']] },
    });
    const result = await getHeadersAndRows(client, 'sheet-id', 'Products');
    expect(result).toEqual({ headers: ['SKU', 'Name'], rows: [['A1', 'Widget']] });
  });

  it('returns empty headers and rows when sheet is empty', async () => {
    const client = makeMockClient();
    const result = await getHeadersAndRows(client, 'sheet-id', 'Products');
    expect(result).toEqual({ headers: [], rows: [] });
  });
});

describe('ensureConfigSheet', () => {
  it('does not create a sheet when _config already exists', async () => {
    const client = makeMockClient({
      get: vi.fn().mockResolvedValue({ data: { sheets: [{ properties: { title: '_config' } }] } }),
    });
    await ensureConfigSheet(client, 'sheet-id');
    expect(client.spreadsheets.batchUpdate).not.toHaveBeenCalled();
  });

  it('creates a _config sheet when missing', async () => {
    const client = makeMockClient({
      get: vi.fn().mockResolvedValue({ data: { sheets: [{ properties: { title: 'Products' } }] } }),
    });
    await ensureConfigSheet(client, 'sheet-id');
    expect(client.spreadsheets.batchUpdate).toHaveBeenCalledWith({
      spreadsheetId: 'sheet-id',
      requestBody: { requests: [{ addSheet: { properties: { title: '_config' } } }] },
    });
  });
});

describe('getConfig', () => {
  it('returns null when config sheet has no data row', async () => {
    const client = makeMockClient();
    const result = await getConfig(client, 'sheet-id');
    expect(result).toBeNull();
  });

  it('parses a stored config', async () => {
    const client = makeMockClient();
    client.spreadsheets.values.get = vi.fn().mockResolvedValue({
      data: { values: [['searchColumn', 'resultColumns'], ['SKU', 'Name, Price']] },
    });
    const result = await getConfig(client, 'sheet-id');
    expect(result).toEqual({ searchColumn: 'SKU', resultColumns: ['Name', 'Price'] });
  });
});

describe('setConfig', () => {
  it('writes the config to the _config sheet', async () => {
    const client = makeMockClient();
    await setConfig(client, 'sheet-id', { searchColumn: 'SKU', resultColumns: ['Name', 'Price'] });
    expect(client.spreadsheets.values.update).toHaveBeenCalledWith({
      spreadsheetId: 'sheet-id',
      range: "'_config'!A1:B2",
      valueInputOption: 'RAW',
      requestBody: {
        values: [
          ['searchColumn', 'resultColumns'],
          ['SKU', 'Name,Price'],
        ],
      },
    });
  });
});
