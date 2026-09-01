import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSheetsClient, getDataSheetTitle, getHeadersAndRows, getConfig } from '@/lib/sheets';
import { validateConfig } from '@/lib/configValidation';
import { findMatchingRow } from '@/lib/searchLogic';
import { getGoogleAuthClient, requireEnv } from '@/lib/googleAuth';
import { logServerFailure } from '@/lib/safeLogging';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const query = req.nextUrl.searchParams.get('q');
  if (!query) return NextResponse.json({ error: 'Missing query parameter "q"' }, { status: 400 });

  let stage = 'environment';
  try {
    const spreadsheetId = requireEnv('GOOGLE_SHEET_ID');
    const requestSubjectToken = req.headers.get('x-vercel-oidc-token') || undefined;
    const auth = getGoogleAuthClient(requestSubjectToken);
    stage = 'token exchange';
    await auth.getAccessToken();
    const client = getSheetsClient(auth);
    stage = 'configuration read';
    const config = await getConfig(client, spreadsheetId);
    if (!config) return NextResponse.json({ error: 'Search not configured yet' }, { status: 503 });

    stage = 'spreadsheet metadata';
    const sheetTitle = await getDataSheetTitle(client, spreadsheetId);
    stage = 'data read';
    const { headers, rows } = await getHeadersAndRows(client, spreadsheetId, sheetTitle);
    const validation = validateConfig(headers, config);
    if (!validation.valid) {
      return NextResponse.json({ error: 'Search configuration is invalid' }, { status: 503 });
    }
    const result = findMatchingRow(headers, rows, config, query);

    if (!result) return NextResponse.json({ error: 'No match found' }, { status: 404 });
    return NextResponse.json({ result });
  } catch (err) {
    logServerFailure('search.GET', err, stage);
    return NextResponse.json({ error: 'Search temporarily unavailable' }, { status: 503 });
  }
}
