'use client';

import { useEffect, useRef, useState } from 'react';
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
  const mappingVersionRef = useRef(0);
  const saveRequestRef = useRef(0);

  async function loadConfiguration() {
    setLoading(true);
    setLoadError(null);

    try {
      const res = await fetch('/api/admin/config');
      if (!res.ok) {
        throw new Error('Failed to load configuration');
      }

      const body = await res.json();
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
    } catch {
      setLoadError('Failed to load configuration. Refresh to try again.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadConfiguration();
  }, []);

  function markMappingEdited() {
    mappingVersionRef.current += 1;
    setStatus(null);
  }

  function updateResultColumn(index: number, value: string) {
    markMappingEdited();
    setResultColumns((prev) => prev.map((column, columnIndex) => (columnIndex === index ? value : column)));
  }

  function addResultColumnRow() {
    markMappingEdited();
    setResultColumns((prev) => [...prev, '']);
    setRowKeys((prev) => [...prev, nextRowKey]);
    setNextRowKey((prev) => prev + 1);
  }

  function removeResultColumnRow(index: number) {
    if (resultColumns.length === 1) {
      return;
    }

    markMappingEdited();
    setResultColumns((prev) => prev.filter((_, columnIndex) => columnIndex !== index));
    setRowKeys((prev) => prev.filter((_, rowIndex) => rowIndex !== index));
  }

  function handleSearchColumnChange(value: string) {
    const filteredColumns = resultColumns.filter((column) => column !== value);
    const filteredKeys = rowKeys.filter((_, index) => resultColumns[index] !== value);
    const shouldRestoreEmptyRow = filteredColumns.length === 0;

    markMappingEdited();
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

    const requestId = saveRequestRef.current + 1;
    saveRequestRef.current = requestId;
    const mappingVersion = mappingVersionRef.current;
    const canReportCompletion = () =>
      saveRequestRef.current === requestId && mappingVersionRef.current === mappingVersion;

    try {
      const res = await fetch('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ searchColumn, resultColumns }),
      });
      const body = await res.json();
      if (!canReportCompletion()) {
        return;
      }

      if (res.ok) {
        setStatus('Saved.');
        return;
      }

      const details = Array.isArray(body?.details)
        ? body.details.filter((detail: unknown): detail is string => typeof detail === 'string')
        : [];
      const errorMessage = typeof body?.error === 'string' ? body.error : 'Request failed';

      setStatus(`Error: ${details.length > 0 ? details.join(', ') : errorMessage}`);
    } catch {
      if (canReportCompletion()) {
        setStatus('Network error, try again.');
      }
    }
  }

  if (loading) {
    return (
      <main className="app-shell">
        <div className="app-content">
          <section className="surface-card p-5 sm:p-8" aria-busy="true" aria-live="polite">
            <p className="eyebrow">Admin configuration</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--color-navy)]">
              Admin: Column Mapping
            </h1>
            <p className="mt-2 text-base text-[var(--color-muted)] sm:text-sm">Loading configuration...</p>
            <div className="mt-6 space-y-4" aria-hidden="true">
              <div className="h-11 animate-pulse rounded bg-slate-100" />
              <div className="h-32 animate-pulse rounded bg-slate-100" />
            </div>
          </section>
        </div>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="app-shell">
        <div className="app-content">
          <section className="surface-card p-5 sm:p-8" aria-labelledby="admin-heading">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="eyebrow">Admin configuration</p>
                <h1 id="admin-heading" className="mt-2 text-2xl font-semibold tracking-tight text-[var(--color-navy)]">
                  Admin: Column Mapping
                </h1>
              </div>
              <Link href="/" className="link-target font-medium text-[var(--color-blue)] hover:text-[var(--color-blue-dark)] hover:underline">
            Back to search
              </Link>
            </div>
            <p role="alert" className="status-message status-error mt-6">{loadError}</p>
            <button type="button" onClick={() => void loadConfiguration()} className="button-secondary mt-4">
              Retry loading configuration
            </button>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="app-shell overflow-x-hidden">
      <div className="app-content">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="eyebrow">Admin configuration</p>
            <h1 id="admin-heading" className="mt-2 text-2xl font-semibold tracking-tight text-[var(--color-navy)]">
              Admin: Column Mapping
            </h1>
          </div>
          <Link href="/" className="link-target font-medium text-[var(--color-blue)] hover:text-[var(--color-blue-dark)] hover:underline">
            Back to search
          </Link>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <section className="surface-card p-5 sm:p-6" aria-labelledby="search-mapping-heading">
            <h2 id="search-mapping-heading" className="text-lg font-semibold text-[var(--color-navy)]">
              What can be searched
            </h2>
            <p className="mt-1 text-base text-[var(--color-muted)] sm:text-sm">
              Choose the sheet column admins can search by.
            </p>
            <div className="mt-5">
              <label htmlFor="searchColumn" className="mb-2 block text-base font-medium sm:text-sm">
                Search column
              </label>
              <select
                id="searchColumn"
                aria-label="Search column"
                value={searchColumn}
                onChange={(e) => handleSearchColumnChange(e.target.value)}
                className="field-control"
              >
                <option value="">Select a column</option>
                {headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>
          </section>

          <section className="surface-card p-5 sm:p-6" aria-labelledby="display-mapping-heading">
            <h2 id="display-mapping-heading" className="text-lg font-semibold text-[var(--color-navy)]">
              What is displayed
            </h2>
            <p className="mt-1 text-base text-[var(--color-muted)] sm:text-sm">
              Choose the sheet columns shown with each search result.
            </p>
            <fieldset className="mt-5">
              <legend className="sr-only">Result columns</legend>
              <div className="space-y-3">
                {resultColumns.map((column, index) => (
                  <div key={rowKeys[index] ?? index} className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-end">
                    <label className="flex-1 text-base sm:text-sm">
                      <span className="mb-2 block font-medium">Displayed column {index + 1}</span>
                      <select
                        aria-label={`Displayed column ${index + 1}`}
                        value={column}
                        onChange={(e) => updateResultColumn(index, e.target.value)}
                        className="field-control"
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
                      className="button-secondary shrink-0 text-base disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
              <button type="button" onClick={addResultColumnRow} className="button-secondary mt-4 text-base sm:text-sm">
                Add display column
              </button>
            </fieldset>
          </section>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-4">
          <button type="button" onClick={handleSave} className="button-primary">
            Save
          </button>
          {status && (
            <p role="status" aria-live="polite" className={`status-message ${status === 'Saved.' ? 'status-success' : 'status-error'}`}>
              {status}
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
