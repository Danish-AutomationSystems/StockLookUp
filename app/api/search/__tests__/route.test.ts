import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('@/lib/sheets', () => ({
  getSheetsClient: vi.fn(() => ({})),
  getDataSheetTitle: vi.fn(),
  getHeadersAndRows: vi.fn(),
  getConfig: vi.fn(),
}));
vi.mock('@/lib/googleAuth', () => ({
  getGoogleAuthClient: vi.fn(() => ({ getAccessToken: vi.fn().mockResolvedValue({ token: 'access-token' }) })),
  requireEnv: vi.fn((name: string) => process.env[name]),
}));

import { getServerSession } from 'next-auth';
import { getSheetsClient, getDataSheetTitle, getHeadersAndRows, getConfig } from '@/lib/sheets';
import { getGoogleAuthClient } from '@/lib/googleAuth';
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
    (getGoogleAuthClient as any).mockReset().mockReturnValue({
      getAccessToken: vi.fn().mockResolvedValue({ token: 'access-token' }),
    });
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
    (getConfig as any).mockResolvedValue({ searchColumn: 'SKU', resultColumns: ['Price', 'Name'] });
    (getDataSheetTitle as any).mockResolvedValue('Products');
    (getHeadersAndRows as any).mockResolvedValue({
      headers: ['SKU', 'Name', 'Price'],
      rows: [['ABC123', 'Widget', '9.99']],
    });
    const res = await GET(makeRequest('ABC123'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ result: { Price: '9.99', Name: 'Widget' } });
    expect(body.result).not.toHaveProperty('SKU');
  });

  it('uses the incoming Vercel OIDC token to authenticate the Sheets search', async () => {
    (getServerSession as any).mockResolvedValue({ user: { email: 'sales@automationsystems.org' } });
    const auth = { getAccessToken: vi.fn().mockResolvedValue({ token: 'access-token' }) };
    (getGoogleAuthClient as any).mockReturnValue(auth);
    (getConfig as any).mockResolvedValue({ searchColumn: 'SKU', resultColumns: ['Name'] });
    (getDataSheetTitle as any).mockResolvedValue('Products');
    (getHeadersAndRows as any).mockResolvedValue({
      headers: ['SKU', 'Name'],
      rows: [['ABC123', 'Widget']],
    });
    const request = new NextRequest('http://localhost/api/search?q=ABC123', {
      headers: { 'x-vercel-oidc-token': 'request-scoped-oidc-token' },
    });

    const res = await GET(request);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ result: { Name: 'Widget' } });
    expect(getGoogleAuthClient).toHaveBeenCalledWith('request-scoped-oidc-token');
    expect(auth.getAccessToken).toHaveBeenCalledOnce();
    expect(getSheetsClient).toHaveBeenCalledWith(auth);
  });

  it('returns a safe configuration error when the persisted config is stale', async () => {
    (getServerSession as any).mockResolvedValue({ user: { email: 'sales@automationsystems.org' } });
    (getConfig as any).mockResolvedValue({ searchColumn: 'SKU', resultColumns: ['Price', 'Name'] });
    (getDataSheetTitle as any).mockResolvedValue('Products');
    (getHeadersAndRows as any).mockResolvedValue({
      headers: ['SKU', 'Name'],
      rows: [['ABC123', 'Widget']],
    });
    const res = await GET(makeRequest('ABC123'));
    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toEqual({ error: 'Search configuration is invalid' });
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
    expect(consoleErrorSpy.mock.calls).toEqual([
      ['Server failure', { operation: 'search.GET', stage: 'configuration read', classification: 'error', status: 503 }],
    ]);
  });
});
