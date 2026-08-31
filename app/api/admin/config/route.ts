import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSheetsClient, getDataSheetTitle, getHeadersAndRows, getConfig, setConfig } from '@/lib/sheets';
import { validateConfig } from '@/lib/configValidation';
import { requireEnv } from '@/lib/googleAuth';

async function requireAdminSession() {
  const session = await getServerSession(authOptions);
  if (!session || !(session.user as any)?.isAdmin) return null;
  return session;
}

function isValidConfigShape(body: unknown): body is { searchColumn: string; resultColumns: string[] } {
  if (!body || typeof body !== 'object') return false;
  const candidate = body as Record<string, unknown>;
  if (typeof candidate.searchColumn !== 'string') return false;
  if (!Array.isArray(candidate.resultColumns)) return false;
  return candidate.resultColumns.every((c) => typeof c === 'string');
}

export async function GET() {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const spreadsheetId = requireEnv('GOOGLE_SHEET_ID');
    const client = getSheetsClient();
    const sheetTitle = await getDataSheetTitle(client, spreadsheetId);
    const { headers } = await getHeadersAndRows(client, spreadsheetId, sheetTitle);
    const config = await getConfig(client, spreadsheetId);
    return NextResponse.json({ headers, config });
  } catch (err) {
    console.error('Admin config GET failed:', err);
    return NextResponse.json({ error: 'Admin config temporarily unavailable' }, { status: 503 });
  }
}

export async function POST(req: NextRequest) {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!isValidConfigShape(body)) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  try {
    const spreadsheetId = requireEnv('GOOGLE_SHEET_ID');
    const client = getSheetsClient();
    const sheetTitle = await getDataSheetTitle(client, spreadsheetId);
    const { headers } = await getHeadersAndRows(client, spreadsheetId, sheetTitle);

    const validation = validateConfig(headers, body);
    if (!validation.valid) {
      return NextResponse.json({ error: 'Invalid configuration', details: validation.errors }, { status: 400 });
    }

    await setConfig(client, spreadsheetId, body);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Admin config POST failed:', err);
    return NextResponse.json({ error: 'Admin config temporarily unavailable' }, { status: 503 });
  }
}
