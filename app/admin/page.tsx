'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function AdminPage() {
  const [headers, setHeaders] = useState<string[]>([]);
  const [searchColumn, setSearchColumn] = useState('');
  const [resultColumns, setResultColumns] = useState<string[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/config')
      .then((res) => res.json())
      .then((body) => {
        setHeaders(body.headers ?? []);
        setSearchColumn(body.config?.searchColumn ?? '');
        setResultColumns(body.config?.resultColumns ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  function toggleResultColumn(col: string) {
    setResultColumns((prev) =>
      prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]
    );
  }

  async function handleSave() {
    setStatus(null);
    const res = await fetch('/api/admin/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ searchColumn, resultColumns }),
    });
    const body = await res.json();
    setStatus(res.ok ? 'Saved.' : `Error: ${(body.details ?? [body.error]).join(', ')}`);
  }

  if (loading) return <main className="p-8">Loading...</main>;

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
        value={searchColumn}
        onChange={(e) => setSearchColumn(e.target.value)}
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
        {headers.map((h) => (
          <label key={h} className="flex items-center gap-2 py-1">
            <input
              type="checkbox"
              aria-label={h}
              checked={resultColumns.includes(h)}
              onChange={() => toggleResultColumn(h)}
            />
            {h}
          </label>
        ))}
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
