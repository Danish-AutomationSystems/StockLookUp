import type { SearchResult } from '@/types';

export default function ResultCard({ result }: { result: SearchResult }) {
  return (
    <dl className="surface-card mt-6 grid gap-4 p-4 sm:grid-cols-2 sm:p-6">
      {Object.entries(result).map(([label, value]) => (
        <div key={label} className="min-w-0 border-b border-[var(--color-border)] pb-3 last:border-b-0 sm:last:border-b">
          <dt className="text-xs font-bold uppercase tracking-wide text-[var(--color-muted)]">{label}</dt>
          <dd className="mt-1 break-words text-base font-medium text-[var(--color-navy)]">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
