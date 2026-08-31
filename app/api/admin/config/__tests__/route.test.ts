import { describe, it, expect, vi, beforeEach } from 'vitest';

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

  it('saves a valid config for an admin', async () => {
    (getServerSession as any).mockResolvedValue({ user: { email: 'testing@automationsystems.org', isAdmin: true } });
    (getDataSheetTitle as any).mockResolvedValue('Products');
    (getHeadersAndRows as any).mockResolvedValue({ headers: ['SKU', 'Name'], rows: [] });
    const res = await POST(makePostRequest({ searchColumn: 'SKU', resultColumns: ['Name'] }));
    expect(res.status).toBe(200);
    expect(setConfig).toHaveBeenCalledWith({}, 'sheet-id', { searchColumn: 'SKU', resultColumns: ['Name'] });
  });
});
