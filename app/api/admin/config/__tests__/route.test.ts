import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('@/lib/sheets', () => ({
  getSheetsClient: vi.fn(() => ({})),
  getDataSheetTitle: vi.fn(),
  getHeadersAndRows: vi.fn(),
  getConfig: vi.fn(),
  setConfig: vi.fn(),
}));

import { getServerSession } from 'next-auth';
import { getDataSheetTitle, getHeadersAndRows, getConfig, setConfig } from '@/lib/sheets';
import { GET, POST } from '@/app/api/admin/config/route';
import { NextRequest } from 'next/server';

function makePostRequest(body: unknown) {
  return new NextRequest('http://localhost/api/admin/config', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  consoleErrorSpy.mockRestore();
});

describe('GET /api/admin/config', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GOOGLE_SHEET_ID = 'sheet-id';
  });

  it('returns 403 for a non-admin session', async () => {
    (getServerSession as any).mockResolvedValue({ user: { email: 'sales@automationsystems.org', isAdmin: false } });
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it('returns 403 with no session', async () => {
    (getServerSession as any).mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it('returns headers and current config for an admin', async () => {
    (getServerSession as any).mockResolvedValue({ user: { email: 'testing@automationsystems.org', isAdmin: true } });
    (getDataSheetTitle as any).mockResolvedValue('Products');
    (getHeadersAndRows as any).mockResolvedValue({ headers: ['SKU', 'Name'], rows: [] });
    (getConfig as any).mockResolvedValue({ searchColumn: 'SKU', resultColumns: ['Name'] });
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ headers: ['SKU', 'Name'], config: { searchColumn: 'SKU', resultColumns: ['Name'] } });
  });
});

describe('POST /api/admin/config', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GOOGLE_SHEET_ID = 'sheet-id';
  });

  it('returns 403 for a non-admin session', async () => {
    (getServerSession as any).mockResolvedValue({ user: { email: 'sales@automationsystems.org', isAdmin: false } });
    const res = await POST(makePostRequest({ searchColumn: 'SKU', resultColumns: ['Name'] }));
    expect(res.status).toBe(403);
  });

  it('returns 400 for an invalid config', async () => {
    (getServerSession as any).mockResolvedValue({ user: { email: 'testing@automationsystems.org', isAdmin: true } });
    (getDataSheetTitle as any).mockResolvedValue('Products');
    (getHeadersAndRows as any).mockResolvedValue({ headers: ['SKU', 'Name'], rows: [] });
    const res = await POST(makePostRequest({ searchColumn: 'Nope', resultColumns: [] }));
    expect(res.status).toBe(400);
  });

  it('returns 400 with duplicate result column details and does not save the config', async () => {
    (getServerSession as any).mockResolvedValue({ user: { email: 'testing@automationsystems.org', isAdmin: true } });
    (getDataSheetTitle as any).mockResolvedValue('Products');
    (getHeadersAndRows as any).mockResolvedValue({ headers: ['SKU', 'Name'], rows: [] });
    const res = await POST(makePostRequest({ searchColumn: 'SKU', resultColumns: ['Name', 'Name'] }));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: 'Invalid configuration',
      details: ['Result column "Name" is duplicated'],
    });
    expect(setConfig).not.toHaveBeenCalled();
  });

  it('returns 400 with search/display overlap details and does not save the config', async () => {
    (getServerSession as any).mockResolvedValue({ user: { email: 'testing@automationsystems.org', isAdmin: true } });
    (getDataSheetTitle as any).mockResolvedValue('Products');
    (getHeadersAndRows as any).mockResolvedValue({ headers: ['SKU', 'Name'], rows: [] });
    const res = await POST(makePostRequest({ searchColumn: 'SKU', resultColumns: ['SKU', 'Name'] }));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: 'Invalid configuration',
      details: ['Result column "SKU" cannot be the search column'],
    });
    expect(setConfig).not.toHaveBeenCalled();
  });

  it('saves a valid config for an admin', async () => {
    (getServerSession as any).mockResolvedValue({ user: { email: 'testing@automationsystems.org', isAdmin: true } });
    (getDataSheetTitle as any).mockResolvedValue('Products');
    (getHeadersAndRows as any).mockResolvedValue({ headers: ['SKU', 'Name'], rows: [] });
    const res = await POST(makePostRequest({ searchColumn: 'SKU', resultColumns: ['Name'] }));
    expect(res.status).toBe(200);
    expect(setConfig).toHaveBeenCalledWith({}, 'sheet-id', { searchColumn: 'SKU', resultColumns: ['Name'] });
  });

  it('returns 400 for malformed JSON in the request body', async () => {
    (getServerSession as any).mockResolvedValue({ user: { email: 'testing@automationsystems.org', isAdmin: true } });
    const req = new NextRequest('http://localhost/api/admin/config', {
      method: 'POST',
      body: '{not valid json',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 when body is null', async () => {
    (getServerSession as any).mockResolvedValue({ user: { email: 'testing@automationsystems.org', isAdmin: true } });
    const res = await POST(makePostRequest(null));
    expect(res.status).toBe(400);
  });

  it('returns 400 when resultColumns is not an array', async () => {
    (getServerSession as any).mockResolvedValue({ user: { email: 'testing@automationsystems.org', isAdmin: true } });
    const res = await POST(makePostRequest({ searchColumn: 'SKU', resultColumns: 'Name' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when resultColumns contains non-string entries', async () => {
    (getServerSession as any).mockResolvedValue({ user: { email: 'testing@automationsystems.org', isAdmin: true } });
    const res = await POST(makePostRequest({ searchColumn: 'SKU', resultColumns: [1, 2] }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when searchColumn is missing', async () => {
    (getServerSession as any).mockResolvedValue({ user: { email: 'testing@automationsystems.org', isAdmin: true } });
    const res = await POST(makePostRequest({ resultColumns: ['Name'] }));
    expect(res.status).toBe(400);
  });

  it('returns 503 (not the raw error message) when the Sheets API throws during POST', async () => {
    (getServerSession as any).mockResolvedValue({ user: { email: 'testing@automationsystems.org', isAdmin: true } });
    const err = Object.assign(new Error('internal sheets failure details subject_token=abc123'), {
      authorization: 'Bearer secret-token',
      response: {
        status: 503,
        data: {
          error: {
            message: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.signature',
          },
        },
      },
    });
    (getDataSheetTitle as any).mockRejectedValue(err);
    const res = await POST(makePostRequest({ searchColumn: 'SKU', resultColumns: ['Name'] }));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(JSON.stringify(body)).not.toContain('internal sheets failure details');
    expect(consoleErrorSpy.mock.calls).toEqual([
      ['Server failure', { operation: 'admin.config.POST', classification: 'error', status: 503 }],
    ]);
  });

  it('returns 503 (not the raw error message) when the Sheets API throws during GET', async () => {
    (getServerSession as any).mockResolvedValue({ user: { email: 'testing@automationsystems.org', isAdmin: true } });
    const err = Object.assign(new Error('internal sheets failure details authorization=secret'), {
      subject_token: 'abc123',
      response: {
        status: 503,
        data: {
          error: {
            message: 'Bearer secret-token',
          },
        },
      },
    });
    (getDataSheetTitle as any).mockRejectedValue(err);
    const res = await GET();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(JSON.stringify(body)).not.toContain('internal sheets failure details');
    expect(consoleErrorSpy.mock.calls).toEqual([
      ['Server failure', { operation: 'admin.config.GET', classification: 'error', status: 503 }],
    ]);
  });
});
