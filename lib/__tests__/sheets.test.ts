import { describe, it, expect, vi } from 'vitest';
vi.mock('googleapis', () => ({
  google: { sheets: vi.fn(({ auth }) => ({ auth })) },
}));
vi.mock('@/lib/googleAuth', () => ({
  getGoogleAuthClient: vi.fn(),
}));

import { google } from 'googleapis';
import { getGoogleAuthClient } from '@/lib/googleAuth';
import {
  getSheetsClient,
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

describe('getSheetsClient', () => {
  it('reuses the no-argument singleton without reconstructing auth', () => {
    const defaultAuth = {} as any;
    (getGoogleAuthClient as any).mockReturnValue(defaultAuth);

    const firstClient = getSheetsClient();
    const secondClient = getSheetsClient();

    expect(firstClient).toBe(secondClient);
    expect(getGoogleAuthClient).toHaveBeenCalledOnce();
    expect(google.sheets).toHaveBeenCalledOnce();
  });

  it('reuses a client for the same explicit auth client', () => {
    const auth = {} as any;

    const firstClient = getSheetsClient(auth);
    const secondClient = getSheetsClient(auth);

    expect(firstClient).toBe(secondClient);
  });

  it('uses the supplied auth client instead of reusing a client for different credentials', () => {
    const firstAuth = {} as any;
    const secondAuth = {} as any;
    const sheetsCallsBefore = (google.sheets as any).mock.calls.length;

    const firstClient = getSheetsClient(firstAuth);
    const secondClient = getSheetsClient(secondAuth);

    expect(firstClient).toMatchObject({ auth: firstAuth });
    expect(secondClient).toMatchObject({ auth: secondAuth });
    expect(firstClient).not.toBe(secondClient);
    expect(google.sheets).toHaveBeenCalledTimes(sheetsCallsBefore + 2);
  });
});

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
      get: vi.fn().mockResolvedValue({
        data: { sheets: [{ properties: { sheetId: 42, title: '_config', hidden: true } }] },
      }),
    });
    await ensureConfigSheet(client, 'sheet-id');
    expect(client.spreadsheets.batchUpdate).not.toHaveBeenCalled();
  });

  it('hides an existing visible _config sheet', async () => {
    const client = makeMockClient({
      get: vi.fn().mockResolvedValue({
        data: { sheets: [{ properties: { sheetId: 42, title: '_config', hidden: false } }] },
      }),
    });

    await ensureConfigSheet(client, 'sheet-id');

    expect(client.spreadsheets.batchUpdate).toHaveBeenCalledWith({
      spreadsheetId: 'sheet-id',
      requestBody: {
        requests: [
          {
            updateSheetProperties: {
              properties: { sheetId: 42, hidden: true },
              fields: 'hidden',
            },
          },
        ],
      },
    });
  });

  it('does not update an already hidden _config sheet', async () => {
    const client = makeMockClient({
      get: vi.fn().mockResolvedValue({
        data: { sheets: [{ properties: { sheetId: 42, title: '_config', hidden: true } }] },
      }),
    });

    await ensureConfigSheet(client, 'sheet-id');

    expect(client.spreadsheets.batchUpdate).not.toHaveBeenCalled();
  });

  it('creates a _config sheet when missing', async () => {
    const client = makeMockClient({
      get: vi.fn().mockResolvedValue({
        data: { sheets: [{ properties: { sheetId: 7, title: 'Products' } }] },
      }),
    });
    await ensureConfigSheet(client, 'sheet-id');
    expect(client.spreadsheets.batchUpdate).toHaveBeenCalledWith({
      spreadsheetId: 'sheet-id',
      requestBody: { requests: [{ addSheet: { properties: { title: '_config', hidden: true } } }] },
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
      data: { values: [['searchColumn', 'resultColumns'], ['SKU', '["Name","Price"]']] },
    });
    const result = await getConfig(client, 'sheet-id');
    expect(result).toEqual({ searchColumn: 'SKU', resultColumns: ['Name', 'Price'] });
  });

  it('correctly round-trips a header containing a comma', async () => {
    const client = makeMockClient();
    client.spreadsheets.values.get = vi.fn().mockResolvedValue({
      data: { values: [['searchColumn', 'resultColumns'], ['SKU', JSON.stringify(['Price, USD', 'Name'])]] },
    });
    const result = await getConfig(client, 'sheet-id');
    expect(result).toEqual({ searchColumn: 'SKU', resultColumns: ['Price, USD', 'Name'] });
  });

  it('does not call batchUpdate (getConfig only reads, never mutates)', async () => {
    const client = makeMockClient();
    await getConfig(client, 'sheet-id');
    expect(client.spreadsheets.batchUpdate).not.toHaveBeenCalled();
  });

  it('returns null when the _config sheet does not exist (values.get throws a 400 "unable to parse range" error)', async () => {
    const client = makeMockClient();
    const err: any = new Error('Unable to parse range: _config!A1:B2');
    err.code = 400;
    client.spreadsheets.values.get = vi.fn().mockRejectedValue(err);
    const result = await getConfig(client, 'sheet-id');
    expect(result).toBeNull();
    expect(client.spreadsheets.batchUpdate).not.toHaveBeenCalled();
  });

  it('propagates a genuine error (e.g. permissions/quota) instead of treating it as "no config"', async () => {
    const client = makeMockClient();
    const err: any = new Error('The caller does not have permission');
    err.code = 403;
    client.spreadsheets.values.get = vi.fn().mockRejectedValue(err);
    await expect(getConfig(client, 'sheet-id')).rejects.toThrow('The caller does not have permission');
  });
});

describe('setConfig', () => {
  it('writes the config to the _config sheet as a JSON-encoded resultColumns cell', async () => {
    const client = makeMockClient();
    await setConfig(client, 'sheet-id', { searchColumn: 'SKU', resultColumns: ['Name', 'Price'] });
    expect(client.spreadsheets.values.update).toHaveBeenCalledWith({
      spreadsheetId: 'sheet-id',
      range: "'_config'!A1:B2",
      valueInputOption: 'RAW',
      requestBody: {
        values: [
          ['searchColumn', 'resultColumns'],
          ['SKU', '["Name","Price"]'],
        ],
      },
    });
  });

  it('preserves resultColumns order in the unchanged _config JSON cell format', async () => {
    const client = makeMockClient();
    await setConfig(client, 'sheet-id', { searchColumn: 'SKU', resultColumns: ['Price', 'Name'] });
    expect(client.spreadsheets.values.update).toHaveBeenCalledWith({
      spreadsheetId: 'sheet-id',
      range: "'_config'!A1:B2",
      valueInputOption: 'RAW',
      requestBody: {
        values: [
          ['searchColumn', 'resultColumns'],
          ['SKU', '["Price","Name"]'],
        ],
      },
    });
  });

  it('preserves a comma-containing header when round-tripped through JSON encoding', async () => {
    const client = makeMockClient();
    await setConfig(client, 'sheet-id', { searchColumn: 'SKU', resultColumns: ['Price, USD'] });
    expect(client.spreadsheets.values.update).toHaveBeenCalledWith({
      spreadsheetId: 'sheet-id',
      range: "'_config'!A1:B2",
      valueInputOption: 'RAW',
      requestBody: {
        values: [
          ['searchColumn', 'resultColumns'],
          ['SKU', '["Price, USD"]'],
        ],
      },
    });
  });
});
