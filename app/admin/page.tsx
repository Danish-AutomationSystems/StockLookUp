'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

function initializeResultColumns(
  headers: string[],
  searchColumn: string,
  resultColumns: unknown
): string[] {
  if (!Array.isArray(resultColumns) || resultColumns.length === 0) {
    return [''];
  }

  const normalized = resultColumns.filter((value): value is string => typeof value === 'string');
  if (normalized.length !== resultColumns.length) {
    return [''];
  }

  const seenColumns = new Set<string>();

  for (const column of normalized) {
    if (!headers.includes(column) || column === searchColumn || seenColumns.has(column)) {
      return [''];
    }

    seenColumns.add(column);
  }

  return normalized;
}

function buildRowKeys(length: number, startAt = 0): number[] {
  return Array.from({ length }, (_, index) => startAt + index);
}

export default function AdminPage() {
  const [headers, setHeaders] = useState<string[]>([]);
  const [searchColumn, setSearchColumn] = useState('');
  const [resultColumns, setResultColumns] = useState<string[]>([]);
  const [rowKeys, setRowKeys] = useState<number[]>([]);
  const [nextRowKey, setNextRowKey] = useState(0);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/config')
      .then((res) => {
        if (!res.ok) {
          throw new Error('Failed to load configuration');
        }
        return res.json();
      })
      .then((body) => {
        const nextHeaders = body.headers ?? [];
        const nextSearchColumn = body.config?.searchColumn ?? '';
        const initialRows = initializeResultColumns(
          nextHeaders,
          nextSearchColumn,
          body.config?.resultColumns
        );
        setHeaders(nextHeaders);
        setSearchColumn(nextSearchColumn);
        setResultColumns(initialRows);
        setRowKeys(buildRowKeys(initialRows.length));
        setNextRowKey(initialRows.length);
        setLoadError(null);
      })
      .catch(() => {
        setLoadError('Failed to load configuration. Refresh to try again.');
      })
      .finally(() => setLoading(false));
  }, []);

  function updateResultColumn(index: number, value: string) {
    setResultColumns((prev) => prev.map((column, columnIndex) => (columnIndex === index ? value : column)));
  }

  function addResultColumnRow() {
    setResultColumns((prev) => [...prev, '']);
    setRowKeys((prev) => [...prev, nextRowKey]);
    setNextRowKey((prev) => prev + 1);
  }

  function removeResultColumnRow(index: number) {
    if (resultColumns.length === 1) {
      return;
    }

    setResultColumns((prev) => prev.filter((_, columnIndex) => columnIndex !== index));
    setRowKeys((prev) => prev.filter((_, rowIndex) => rowIndex !== index));
  }

  function handleSearchColumnChange(value: string) {
    const filteredColumns = resultColumns.filter((column) => column !== value);
    const filteredKeys = rowKeys.filter((_, index) => resultColumns[index] !== value);
    const shouldRestoreEmptyRow = filteredColumns.length === 0;

    setSearchColumn(value);
    setResultColumns(shouldRestoreEmptyRow ? [''] : filteredColumns);
    setRowKeys(shouldRestoreEmptyRow ? [nextRowKey] : filteredKeys);

    if (shouldRestoreEmptyRow) {
      setNextRowKey((prev) => prev + 1);
    }
  }

  function getDisplayOptions(index: number) {
    const selectedByOtherRows = new Set(
      resultColumns.filter((column, columnIndex) => columnIndex !== index && column !== '')
    );

    return headers.filter((header) => {
      if (header === resultColumns[index]) {
        return true;
      }

      if (header === searchColumn) {
        return false;
      }

      return !selectedByOtherRows.has(header);
    });
  }

  function getValidationMessage() {
    if (!searchColumn) {
      return 'Search column is required.';
    }

    if (!headers.includes(searchColumn)) {
      return `Search column "${searchColumn}" not found in sheet headers.`;
    }

    const seenColumns = new Set<string>();

    for (const [index, column] of resultColumns.entries()) {
      if (!column) {
        return `Displayed column ${index + 1} is required.`;
      }

      if (!headers.includes(column)) {
        return `Displayed column ${index + 1} must match a sheet header.`;
      }

      if (column === searchColumn) {
        return `Displayed column ${index + 1} cannot be the search column.`;
      }

      if (seenColumns.has(column)) {
        return `Displayed column ${index + 1} must be unique.`;
      }

      seenColumns.add(column);
    }

    return null;
  }

  async function handleSave() {
    setStatus(null);

    const validationMessage = getValidationMessage();
    if (validationMessage) {
      setStatus(validationMessage);
      return;
    }

    try {
      const res = await fetch('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ searchColumn, resultColumns }),
      });
      const body = await res.json();
      if (res.ok) {
        setStatus('Saved.');
        return;
      }

      const details = Array.isArray(body?.details)
        ? body.details.filter((detail): detail is string => typeof detail === 'string')
        : [];
      const errorMessage = typeof body?.error === 'string' ? body.error : 'Request failed';

      setStatus(`Error: ${details.length > 0 ? details.join(', ') : errorMessage}`);
    } catch {
      setStatus('Network error, try again.');
    }
  }

  if (loading) return <main className="p-8">Loading...</main>;

  if (loadError) {
    return (
      <main className="mx-auto max-w-xl p-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Admin: Column Mapping</h1>
          <Link href="/" className="text-blue-600 hover:underline">
            Back to search
          </Link>
        </div>
        <p className="text-red-600">{loadError}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Admin: Column Mapping</h1>
        <Link href="/" className="text-blue-600 hover:underline">
          Back to search
        </Link>
      </div>

      <label htmlFor="searchColumn" className="mb-1 block text-sm font-medium text-gray-700">
        Search column
      </label>
      <select
        id="searchColumn"
        aria-label="Search column"
        value={searchColumn}
        onChange={(e) => handleSearchColumnChange(e.target.value)}
        className="mb-4 w-full rounded border border-gray-300 px-3 py-2"
      >
        <option value="">Select a column</option>
        {headers.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>

      <fieldset className="mb-4">
        <legend className="mb-1 text-sm font-medium text-gray-700">Result columns</legend>
        <div className="space-y-3">
          {resultColumns.map((column, index) => (
            <div key={rowKeys[index] ?? index} className="flex items-center gap-3">
              <label className="flex-1 text-sm text-gray-700">
                <span className="mb-1 block font-medium">Displayed column {index + 1}</span>
                <select
                  aria-label={`Displayed column ${index + 1}`}
                  value={column}
                  onChange={(e) => updateResultColumn(index, e.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-2"
                >
                  <option value="">Select a column</option>
                  {getDisplayOptions(index).map((header) => (
                    <option key={header} value={header}>
                      {header}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                aria-label={`Remove displayed column ${index + 1}`}
                onClick={() => removeResultColumnRow(index)}
                disabled={resultColumns.length === 1}
                className="rounded border border-gray-300 px-3 py-2 text-sm text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addResultColumnRow}
          className="mt-3 rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          Add display column
        </button>
      </fieldset>

      <button
        onClick={handleSave}
        className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
      >
        Save
      </button>
      {status && <p className="mt-4">{status}</p>}
    </main>
  );
}
