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
    <main className="mx-auto max-w-xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">StockLooker</h1>
        <div className="flex items-center gap-3 text-sm">
          {(session?.user as any)?.isAdmin && (
            <Link href="/admin" className="text-blue-600 hover:underline">
              Admin
            </Link>
          )}
          <button onClick={() => signOut()} className="text-gray-500 hover:underline">
            Sign out
          </button>
        </div>
      </div>
      <SearchForm onSearch={handleSearch} loading={loading} />
      {error && <p className="mt-4 text-red-600">{error}</p>}
      {result && <ResultCard result={result} />}
    </main>
  );
}
