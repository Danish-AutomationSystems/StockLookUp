'use client';

import { useState, FormEvent } from 'react';

export default function SearchForm({
  onSearch,
  loading,
}: {
  onSearch: (query: string) => void;
  loading: boolean;
}) {
  const [query, setQuery] = useState('');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (query.trim()) onSearch(query.trim());
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <label htmlFor="search-query" className="flex-1 text-sm font-medium text-gray-700">
        <span className="mb-1 block">Search</span>
        <input
          id="search-query"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Enter a value to search..."
          className="field-control"
        />
      </label>
      <button
        type="submit"
        disabled={loading}
        className="button-primary w-full disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
      >
        {loading ? 'Searching...' : 'Search'}
      </button>
    </form>
  );
}
