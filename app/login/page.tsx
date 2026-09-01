'use client';

import { Suspense } from 'react';
import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';

function LoginContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');

  return (
    <main className="app-shell flex min-h-screen flex-col items-center justify-center px-4 py-8 sm:px-6">
      <section className="surface-card w-full max-w-md p-6 text-center sm:p-10" aria-labelledby="login-heading">
        <p className="eyebrow">Internal sales lookup</p>
        <h1 id="login-heading" className="mt-3 text-2xl font-semibold text-[var(--color-navy)]">StockLooker</h1>
        <p className="mt-3 text-gray-600">Sign in with your AutomationSystems Google account.</p>
      {error && (
        <p role="alert" className="status-message status-error mt-5 text-left">
          Access denied. Use your @automationsystems.org account.
        </p>
      )}
      <button
        className="button-primary mt-6 w-full"
        onClick={() => signIn('google', { callbackUrl: '/' })}
      >
        Sign in with Google
      </button>
      </section>
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
