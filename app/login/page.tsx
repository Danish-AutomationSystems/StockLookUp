'use client';

import { Suspense } from 'react';
import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';

function LoginContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');

  return (
    <main className="app-shell flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-2xl font-semibold">StockLooker</h1>
      <p className="text-gray-600">Sign in with your AutomationSystems Google account.</p>
      {error && (
        <p className="rounded bg-red-50 px-4 py-2 text-red-700">
          Access denied. Use your @automationsystems.org account.
        </p>
      )}
      <button
        className="button-primary"
        onClick={() => signIn('google', { callbackUrl: '/' })}
      >
        Sign in with Google
      </button>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Loading...</div>}>
      <LoginContent />
    </Suspense>
  );
}
