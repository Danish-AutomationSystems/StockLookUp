'use client';

import { useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import SearchForm from '@/components/SearchForm';
import ResultCard from '@/components/ResultCard';
import type { SearchResult } from '@/types';

export default function HomePage() {
  const { data: session } = useSession();
  const [result, setResult] = useState<SearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSearch(query: string) {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? 'Something went wrong');
        return;
      }
      setResult(body.result);
    } catch {
      setError('Network error, try again');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="app-content flex items-center justify-between py-4">
          <Link href="/" className="link-target app-brand text-lg">StockLooker</Link>
          <div className="flex items-center gap-3 text-base sm:text-sm">
          {(session?.user as any)?.isAdmin && (
            <Link href="/admin" className="link-target font-medium text-[var(--color-blue)] hover:text-[var(--color-blue-dark)] hover:underline">
              Admin
            </Link>
          )}
          <button onClick={() => signOut()} className="button-secondary text-base sm:text-sm">
            Sign out
          </button>
          </div>
        </div>
      </header>
      <div className="app-content">
        <section className="surface-card p-5 sm:p-8" aria-labelledby="search-heading">
          <p className="eyebrow">Internal sales lookup</p>
          <h1 id="search-heading" className="mt-2 text-2xl font-semibold tracking-tight text-[var(--color-navy)] sm:text-3xl">
            Find a stock record
          </h1>
          <p className="mt-2 max-w-2xl text-base text-[var(--color-muted)]">
            Search the connected inventory sheet by entering a stock value below.
          </p>
          <div className="mt-6">
            <SearchForm onSearch={handleSearch} loading={loading} />
          </div>
          {error && (
            <p role="alert" className="status-message status-error mt-5">
              {error}
            </p>
          )}
          {result && <ResultCard result={result} />}
        </section>
      </div>
    </main>
  );
}
