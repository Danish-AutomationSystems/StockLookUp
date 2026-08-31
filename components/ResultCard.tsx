import type { SearchResult } from '@/types';

export default function ResultCard({ result }: { result: SearchResult }) {
  return (
    <dl className="mt-6 grid gap-3 rounded border border-gray-200 bg-white p-4">
      {Object.entries(result).map(([label, value]) => (
        <div key={label}>
          <dt className="text-sm font-medium text-gray-500">{label}</dt>
          <dd className="text-lg text-gray-900">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
