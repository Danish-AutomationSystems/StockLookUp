import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getGoogleAuthClient, requireEnv } from '@/lib/googleAuth';
import { getDriveClient, getSheetLastModified } from '@/lib/driveMeta';
import { logServerFailure } from '@/lib/safeLogging';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let stage = 'environment';
  try {
    const spreadsheetId = requireEnv('GOOGLE_SHEET_ID');
    const requestSubjectToken = req.headers.get('x-vercel-oidc-token') || undefined;
    const auth = getGoogleAuthClient(requestSubjectToken);
    stage = 'token exchange';
    await auth.getAccessToken();
    const client = getDriveClient(auth);
    stage = 'metadata read';
    const modifiedTime = await getSheetLastModified(client, spreadsheetId);
    return NextResponse.json({ modifiedTime });
  } catch (err) {
    logServerFailure('sheetStatus.GET', err, stage);
    return NextResponse.json({ error: 'Status temporarily unavailable' }, { status: 503 });
  }
}
