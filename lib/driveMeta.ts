import { google, drive_v3 } from 'googleapis';
import type { BaseExternalAccountClient } from 'google-auth-library';

export function getDriveClient(auth: BaseExternalAccountClient): drive_v3.Drive {
  return google.drive({ version: 'v3', auth: auth as any });
}

export async function getSheetLastModified(
  client: drive_v3.Drive,
  spreadsheetId: string
): Promise<string> {
  const res = await client.files.get({
    fileId: spreadsheetId,
    fields: 'modifiedTime',
  });
  return res.data.modifiedTime as string;
}
