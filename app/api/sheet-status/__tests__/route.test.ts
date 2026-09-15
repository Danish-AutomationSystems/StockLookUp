import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('@/lib/driveMeta', () => ({
  getDriveClient: vi.fn(() => ({})),
  getSheetLastModified: vi.fn(),
}));
vi.mock('@/lib/googleAuth', () => ({
  getGoogleAuthClient: vi.fn(() => ({ getAccessToken: vi.fn().mockResolvedValue({ token: 'access-token' }) })),
  requireEnv: vi.fn((name: string) => process.env[name]),
}));

import { getServerSession } from 'next-auth';
import { getDriveClient, getSheetLastModified } from '@/lib/driveMeta';
import { getGoogleAuthClient } from '@/lib/googleAuth';
import { GET } from '@/app/api/sheet-status/route';
import { NextRequest } from 'next/server';

function makeRequest(oidcHeader?: string) {
  const init = oidcHeader ? { headers: { 'x-vercel-oidc-token': oidcHeader } } : undefined;
  return new NextRequest('http://localhost/api/sheet-status', init);
}

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  consoleErrorSpy.mockRestore();
});

describe('GET /api/sheet-status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getGoogleAuthClient as any).mockReset().mockReturnValue({
      getAccessToken: vi.fn().mockResolvedValue({ token: 'access-token' }),
    });
    process.env.GOOGLE_SHEET_ID = 'sheet-id';
  });

  it('returns 401 when not signed in', async () => {
    (getServerSession as any).mockResolvedValue(null);
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it('returns 200 with the modifiedTime for a signed-in non-admin user', async () => {
    (getServerSession as any).mockResolvedValue({ user: { email: 'sales@automationsystems.org', isAdmin: false } });
    (getSheetLastModified as any).mockResolvedValue('2026-09-15T12:00:00.000Z');
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ modifiedTime: '2026-09-15T12:00:00.000Z' });
  });

  it('uses the incoming Vercel OIDC token to authenticate', async () => {
    (getServerSession as any).mockResolvedValue({ user: { email: 'sales@automationsystems.org' } });
    const auth = { getAccessToken: vi.fn().mockResolvedValue({ token: 'access-token' }) };
    (getGoogleAuthClient as any).mockReturnValue(auth);
    (getSheetLastModified as any).mockResolvedValue('2026-09-15T12:00:00.000Z');

    const res = await GET(makeRequest('request-scoped-oidc-token'));

    expect(res.status).toBe(200);
    expect(getGoogleAuthClient).toHaveBeenCalledWith('request-scoped-oidc-token');
    expect(auth.getAccessToken).toHaveBeenCalledOnce();
    expect(getDriveClient).toHaveBeenCalledWith(auth);
  });

  it('returns 503 (not the raw error message) when the Drive API throws', async () => {
    (getServerSession as any).mockResolvedValue({ user: { email: 'sales@automationsystems.org' } });
    (getSheetLastModified as any).mockRejectedValue(new Error('internal drive failure details'));
    const res = await GET(makeRequest());
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(JSON.stringify(body)).not.toContain('internal drive failure details');
  });
});
