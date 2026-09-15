import { describe, it, expect, vi } from 'vitest';

vi.mock('googleapis', () => ({
  google: { drive: vi.fn(({ auth }) => ({ auth })) },
}));

import { google } from 'googleapis';
import { getDriveClient, getSheetLastModified } from '@/lib/driveMeta';

function makeMockClient(overrides: any = {}) {
  return {
    files: {
      get: vi.fn().mockResolvedValue({ data: { modifiedTime: '2026-09-15T12:00:00.000Z' } }),
      ...overrides,
    },
  } as any;
}

describe('getDriveClient', () => {
  it('builds a drive v3 client with the given auth', () => {
    const auth = {} as any;
    getDriveClient(auth);
    expect(google.drive).toHaveBeenCalledWith(expect.objectContaining({ version: 'v3', auth }));
  });
});

describe('getSheetLastModified', () => {
  it('returns the modifiedTime for the given spreadsheet id', async () => {
    const client = makeMockClient();
    const result = await getSheetLastModified(client, 'sheet-id');
    expect(result).toBe('2026-09-15T12:00:00.000Z');
    expect(client.files.get).toHaveBeenCalledWith({
      fileId: 'sheet-id',
      fields: 'modifiedTime',
    });
  });

  it('propagates an error from the Drive API', async () => {
    const client = makeMockClient({ get: vi.fn().mockRejectedValue(new Error('drive failure')) });
    await expect(getSheetLastModified(client, 'sheet-id')).rejects.toThrow('drive failure');
  });
});
