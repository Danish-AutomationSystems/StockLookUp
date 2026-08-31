import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSheetsClient, getDataSheetTitle, getHeadersAndRows, getConfig } from '@/lib/sheets';
import { findMatchingRow } from '@/lib/searchLogic';
import { requireEnv } from '@/lib/googleAuth';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const query = req.nextUrl.searchParams.get('q');
  if (!query) return NextResponse.json({ error: 'Missing query parameter "q"' }, { status: 400 });

  const spreadsheetId = requireEnv('GOOGLE_SHEET_ID');
  const client = getSheetsClient();
  const config = await getConfig(client, spreadsheetId);
  if (!config) return NextResponse.json({ error: 'Search not configured yet' }, { status: 503 });

  const sheetTitle = await getDataSheetTitle(client, spreadsheetId);
  const { headers, rows } = await getHeadersAndRows(client, spreadsheetId, sheetTitle);
  const result = findMatchingRow(headers, rows, config, query);

  if (!result) return NextResponse.json({ error: 'No match found' }, { status: 404 });
  return NextResponse.json({ result });
}
