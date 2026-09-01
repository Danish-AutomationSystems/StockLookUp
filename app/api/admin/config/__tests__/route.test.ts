import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('@/lib/sheets', () => ({
  getSheetsClient: vi.fn(() => ({})),
  getDataSheetTitle: vi.fn(),
  getHeadersAndRows: vi.fn(),
  getConfig: vi.fn(),
  setConfig: vi.fn(),
}));
vi.mock('@/lib/googleAuth', () => ({
  getGoogleAuthClient: vi.fn(() => ({ getAccessToken: vi.fn() })),
  requireEnv: vi.fn((name: string) => process.env[name]),
}));

import { getServerSession } from 'next-auth';
import { getSheetsClient, getDataSheetTitle, getHeadersAndRows, getConfig, setConfig } from '@/lib/sheets';
import { getGoogleAuthClient } from '@/lib/googleAuth';
import { GET, POST } from '@/app/api/admin/config/route';
import { NextRequest } from 'next/server';

function makePostRequest(body: unknown, headers?: HeadersInit) {
  return new NextRequest('http://localhost/api/admin/config', {
    method: 'POST',
    body: JSON.stringify(body),
    headers,
  });
}

function makeGetRequest(headers?: HeadersInit) {
  return new NextRequest('http://localhost/api/admin/config', { headers });
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
    (getGoogleAuthClient as any).mockReset().mockReturnValue({ getAccessToken: vi.fn().mockResolvedValue({ token: 'access-token' }) });
    process.env.GOOGLE_SHEET_ID = 'sheet-id';
  });

  it('returns 403 for a non-admin session', async () => {
    (getServerSession as any).mockResolvedValue({ user: { email: 'sales@automationsystems.org', isAdmin: false } });
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(403);
  });

  it('returns 403 with no session', async () => {
    (getServerSession as any).mockResolvedValue(null);
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(403);
  });

  it('returns headers and current config for an admin', async () => {
    (getServerSession as any).mockResolvedValue({ user: { email: 'testing@automationsystems.org', isAdmin: true } });
    const auth = { getAccessToken: vi.fn().mockResolvedValue({ token: 'access-token' }) };
    (getGoogleAuthClient as any).mockReturnValue(auth);
    (getDataSheetTitle as any).mockResolvedValue('Products');
    (getHeadersAndRows as any).mockResolvedValue({ headers: ['SKU', 'Name'], rows: [] });
    (getConfig as any).mockResolvedValue({ searchColumn: 'SKU', resultColumns: ['Name'] });
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ headers: ['SKU', 'Name'], config: { searchColumn: 'SKU', resultColumns: ['Name'] } });
    expect(auth.getAccessToken).toHaveBeenCalledOnce();
    expect(getSheetsClient).toHaveBeenCalledWith(auth);
  });

  it('passes a non-empty request-scoped Vercel OIDC token to the auth client', async () => {
    (getServerSession as any).mockResolvedValue({ user: { email: 'testing@automationsystems.org', isAdmin: true } });
    (getDataSheetTitle as any).mockResolvedValue('Products');
    (getHeadersAndRows as any).mockResolvedValue({ headers: ['SKU'], rows: [] });
    (getConfig as any).mockResolvedValue(null);
    const request = new NextRequest('http://localhost/api/admin/config', {
      headers: { 'x-vercel-oidc-token': 'request-scoped-oidc-token' },
    });

    const res = await GET(request);

    expect(res.status).toBe(200);
    expect(getGoogleAuthClient).toHaveBeenCalledWith('request-scoped-oidc-token');
  });

  it('reports token exchange failures separately from Sheets metadata failures', async () => {
    (getServerSession as any).mockResolvedValue({ user: { email: 'testing@automationsystems.org', isAdmin: true } });
    const authError = new Error('invalid_grant');
    const getAccessToken = vi.fn().mockRejectedValue(authError);
    (getGoogleAuthClient as any).mockReturnValue({ getAccessToken });

    const res = await GET(makeGetRequest());

    expect(res.status).toBe(503);
    expect(consoleErrorSpy.mock.calls).toEqual([
      ['Server failure', {
        operation: 'admin.config.GET',
        stage: 'token exchange',
        classification: 'error',
        reason: 'UNAUTHENTICATED',
        upstreamCode: 'invalid_grant',
        upstreamDetail: 'invalid grant',
      }],
    ]);
  });

  it('reports auth-client construction failures at the environment stage', async () => {
    (getServerSession as any).mockResolvedValue({ user: { email: 'testing@automationsystems.org', isAdmin: true } });
    (getGoogleAuthClient as any).mockImplementation(() => {
      throw new Error('Missing required environment variable: GCP_PROJECT_NUMBER');
    });

    const res = await GET(makeGetRequest());

    expect(res.status).toBe(503);
    expect(consoleErrorSpy.mock.calls).toEqual([
      ['Server failure', { operation: 'admin.config.GET', stage: 'environment', classification: 'error' }],
    ]);
  });
});

describe('POST /api/admin/config', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getGoogleAuthClient as any).mockReset().mockReturnValue({ getAccessToken: vi.fn().mockResolvedValue({ token: 'access-token' }) });
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

  it('uses the request-scoped OIDC token and same auth client when saving a valid config', async () => {
    (getServerSession as any).mockResolvedValue({ user: { email: 'testing@automationsystems.org', isAdmin: true } });
    const auth = { getAccessToken: vi.fn().mockResolvedValue({ token: 'access-token' }) };
    (getGoogleAuthClient as any).mockReturnValue(auth);
    (getDataSheetTitle as any).mockResolvedValue('Products');
    (getHeadersAndRows as any).mockResolvedValue({ headers: ['SKU', 'Name'], rows: [] });
    const res = await POST(makePostRequest(
      { searchColumn: 'SKU', resultColumns: ['Name'] },
      { 'x-vercel-oidc-token': 'request-scoped-oidc-token' }
    ));
    expect(res.status).toBe(200);
    expect(getGoogleAuthClient).toHaveBeenCalledWith('request-scoped-oidc-token');
    expect(auth.getAccessToken).toHaveBeenCalledOnce();
    expect(getSheetsClient).toHaveBeenCalledWith(auth);
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

  it('reports the spreadsheet metadata stage when Sheets fails during POST', async () => {
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
      ['Server failure', {
        operation: 'admin.config.POST',
        stage: 'spreadsheet metadata',
        classification: 'error',
        status: 503,
      }],
    ]);
  });

  it('reports token exchange failures separately during POST', async () => {
    (getServerSession as any).mockResolvedValue({ user: { email: 'testing@automationsystems.org', isAdmin: true } });
    const authError = new Error('invalid_grant');
    (getGoogleAuthClient as any).mockReturnValue({ getAccessToken: vi.fn().mockRejectedValue(authError) });

    const res = await POST(makePostRequest({ searchColumn: 'SKU', resultColumns: ['Name'] }));

    expect(res.status).toBe(503);
    expect(consoleErrorSpy.mock.calls).toEqual([
      ['Server failure', {
        operation: 'admin.config.POST',
        stage: 'token exchange',
        classification: 'error',
        reason: 'UNAUTHENTICATED',
        upstreamCode: 'invalid_grant',
        upstreamDetail: 'invalid grant',
      }],
    ]);
  });

  it('reports auth-client construction failures at the environment stage during POST', async () => {
    (getServerSession as any).mockResolvedValue({ user: { email: 'testing@automationsystems.org', isAdmin: true } });
    (getGoogleAuthClient as any).mockImplementation(() => {
      throw new Error('Missing required environment variable: GCP_PROJECT_NUMBER');
    });

    const res = await POST(makePostRequest({ searchColumn: 'SKU', resultColumns: ['Name'] }));

    expect(res.status).toBe(503);
    expect(consoleErrorSpy.mock.calls).toEqual([
      ['Server failure', { operation: 'admin.config.POST', stage: 'environment', classification: 'error' }],
    ]);
  });

  it('reports the data headers stage when loading headers fails during POST', async () => {
    (getServerSession as any).mockResolvedValue({ user: { email: 'testing@automationsystems.org', isAdmin: true } });
    (getDataSheetTitle as any).mockResolvedValue('Products');
    (getHeadersAndRows as any).mockRejectedValue(Object.assign(new Error('request failed'), { response: { status: 503 } }));

    const res = await POST(makePostRequest({ searchColumn: 'SKU', resultColumns: ['Name'] }));

    expect(res.status).toBe(503);
    expect(consoleErrorSpy.mock.calls).toEqual([
      ['Server failure', {
        operation: 'admin.config.POST',
        stage: 'data headers',
        classification: 'error',
        status: 503,
      }],
    ]);
  });

  it('reports the configuration write stage when saving fails during POST', async () => {
    (getServerSession as any).mockResolvedValue({ user: { email: 'testing@automationsystems.org', isAdmin: true } });
    (getDataSheetTitle as any).mockResolvedValue('Products');
    (getHeadersAndRows as any).mockResolvedValue({ headers: ['SKU', 'Name'], rows: [] });
    (setConfig as any).mockRejectedValue(Object.assign(new Error('request failed'), { response: { status: 503 } }));

    const res = await POST(makePostRequest({ searchColumn: 'SKU', resultColumns: ['Name'] }));

    expect(res.status).toBe(503);
    expect(consoleErrorSpy.mock.calls).toEqual([
      ['Server failure', {
        operation: 'admin.config.POST',
        stage: 'configuration write',
        classification: 'error',
        status: 503,
      }],
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
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(JSON.stringify(body)).not.toContain('internal sheets failure details');
    expect(consoleErrorSpy.mock.calls).toEqual([
      ['Server failure', { operation: 'admin.config.GET', stage: 'spreadsheet metadata', classification: 'error', status: 503 }],
    ]);
  });
});
