import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('@/lib/sheets', () => ({
  getSheetsClient: vi.fn(() => ({})),
  getDataSheetTitle: vi.fn(),
  getHeadersAndRows: vi.fn(),
  getConfig: vi.fn(),
}));

import { getServerSession } from 'next-auth';
import { getDataSheetTitle, getHeadersAndRows, getConfig } from '@/lib/sheets';
import { GET } from '@/app/api/search/route';
import { NextRequest } from 'next/server';

function makeRequest(query: string | null) {
  const url = new URL('http://localhost/api/search');
  if (query !== null) url.searchParams.set('q', query);
  return new NextRequest(url);
}

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  consoleErrorSpy.mockRestore();
});

describe('GET /api/search', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GOOGLE_SHEET_ID = 'sheet-id';
  });

  it('returns 401 when not signed in', async () => {
    (getServerSession as any).mockResolvedValue(null);
    const res = await GET(makeRequest('abc'));
    expect(res.status).toBe(401);
  });

  it('returns 400 when query param is missing', async () => {
    (getServerSession as any).mockResolvedValue({ user: { email: 'sales@automationsystems.org' } });
    const res = await GET(makeRequest(null));
    expect(res.status).toBe(400);
  });

  it('returns 503 when no config is saved yet', async () => {
    (getServerSession as any).mockResolvedValue({ user: { email: 'sales@automationsystems.org' } });
    (getConfig as any).mockResolvedValue(null);
    const res = await GET(makeRequest('abc'));
    expect(res.status).toBe(503);
  });

  it('returns 404 when no row matches', async () => {
    (getServerSession as any).mockResolvedValue({ user: { email: 'sales@automationsystems.org' } });
    (getConfig as any).mockResolvedValue({ searchColumn: 'SKU', resultColumns: ['Name'] });
    (getDataSheetTitle as any).mockResolvedValue('Products');
    (getHeadersAndRows as any).mockResolvedValue({ headers: ['SKU', 'Name'], rows: [] });
    const res = await GET(makeRequest('nope'));
    expect(res.status).toBe(404);
  });

  it('returns 200 with the matched result', async () => {
    (getServerSession as any).mockResolvedValue({ user: { email: 'sales@automationsystems.org' } });
    (getConfig as any).mockResolvedValue({ searchColumn: 'SKU', resultColumns: ['Name'] });
    (getDataSheetTitle as any).mockResolvedValue('Products');
    (getHeadersAndRows as any).mockResolvedValue({
      headers: ['SKU', 'Name'],
      rows: [['ABC123', 'Widget']],
    });
    const res = await GET(makeRequest('ABC123'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ result: { Name: 'Widget' } });
  });

  it('returns 503 (not the raw error message) when the Sheets API throws', async () => {
    (getServerSession as any).mockResolvedValue({ user: { email: 'sales@automationsystems.org' } });
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
    (getConfig as any).mockRejectedValue(err);
    const res = await GET(makeRequest('abc'));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(JSON.stringify(body)).not.toContain('internal sheets failure details');
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Server failure',
      expect.objectContaining({ operation: 'search.GET', classification: 'error', status: 503 })
    );
    const serializedCalls = JSON.stringify(consoleErrorSpy.mock.calls);
    expect(serializedCalls).not.toContain('subject_token');
    expect(serializedCalls).not.toContain('Bearer secret-token');
    expect(serializedCalls).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.signature');
  });
});
