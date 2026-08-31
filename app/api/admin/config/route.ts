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

export async function GET() {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const spreadsheetId = requireEnv('GOOGLE_SHEET_ID');
  const client = getSheetsClient();
  const sheetTitle = await getDataSheetTitle(client, spreadsheetId);
  const { headers } = await getHeadersAndRows(client, spreadsheetId, sheetTitle);
  const config = await getConfig(client, spreadsheetId);
  return NextResponse.json({ headers, config });
}

export async function POST(req: NextRequest) {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
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
}
