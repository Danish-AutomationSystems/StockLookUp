import { google, sheets_v4 } from 'googleapis';
import { getGoogleAuthClient } from './googleAuth';
import type { SheetConfig } from '@/types';

const CONFIG_SHEET_TITLE = '_config';

let cachedClient: sheets_v4.Sheets | null = null;

export function getSheetsClient(): sheets_v4.Sheets {
  if (cachedClient) return cachedClient;
  const auth = getGoogleAuthClient();
  cachedClient = google.sheets({ version: 'v4', auth: auth as any });
  return cachedClient;
}

export async function getDataSheetTitle(
  client: sheets_v4.Sheets,
  spreadsheetId: string
): Promise<string> {
  const meta = await client.spreadsheets.get({ spreadsheetId });
  const sheetsList = meta.data.sheets ?? [];
  const dataSheet = sheetsList.find((s) => s.properties?.title !== CONFIG_SHEET_TITLE);
  if (!dataSheet?.properties?.title) throw new Error('No data sheet found in spreadsheet');
  return dataSheet.properties.title;
}

export async function getHeadersAndRows(
  client: sheets_v4.Sheets,
  spreadsheetId: string,
  sheetTitle: string
): Promise<{ headers: string[]; rows: string[][] }> {
  const res = await client.spreadsheets.values.get({
    spreadsheetId,
    range: `'${sheetTitle}'!A1:ZZ`,
  });
  const values = res.data.values ?? [];
  const [headers = [], ...rows] = values as string[][];
  return { headers, rows };
}

export async function ensureConfigSheet(
  client: sheets_v4.Sheets,
  spreadsheetId: string
): Promise<void> {
  const meta = await client.spreadsheets.get({ spreadsheetId });
  const exists = (meta.data.sheets ?? []).some((s) => s.properties?.title === CONFIG_SHEET_TITLE);
  if (exists) return;
  await client.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{ addSheet: { properties: { title: CONFIG_SHEET_TITLE } } }],
    },
  });
}

export async function getConfig(
  client: sheets_v4.Sheets,
  spreadsheetId: string
): Promise<SheetConfig | null> {
  await ensureConfigSheet(client, spreadsheetId);
  const res = await client.spreadsheets.values.get({
    spreadsheetId,
    range: `'${CONFIG_SHEET_TITLE}'!A1:B2`,
  });
  const values = (res.data.values ?? []) as string[][];
  if (values.length < 2) return null;

  const [header, dataRow] = values;
  const searchColIdx = header.indexOf('searchColumn');
  const resultColsIdx = header.indexOf('resultColumns');
  if (searchColIdx === -1 || resultColsIdx === -1) return null;

  const searchColumn = dataRow[searchColIdx];
  const resultColumnsRaw = dataRow[resultColsIdx];
  if (!searchColumn || !resultColumnsRaw) return null;

  return {
    searchColumn,
    resultColumns: resultColumnsRaw.split(',').map((c) => c.trim()).filter(Boolean),
  };
}

export async function setConfig(
  client: sheets_v4.Sheets,
  spreadsheetId: string,
  config: SheetConfig
): Promise<void> {
  await ensureConfigSheet(client, spreadsheetId);
  await client.spreadsheets.values.update({
    spreadsheetId,
    range: `'${CONFIG_SHEET_TITLE}'!A1:B2`,
    valueInputOption: 'RAW',
    requestBody: {
      values: [
        ['searchColumn', 'resultColumns'],
        [config.searchColumn, config.resultColumns.join(',')],
      ],
    },
  });
}
