'use client';

import { useEffect, useState } from 'react';
import { formatRelativeTime } from '@/lib/formatRelativeTime';

const POLL_INTERVAL_MS = 60 * 1000;

export default function SheetStatus() {
  const [modifiedTime, setModifiedTime] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch('/api/sheet-status');
        if (!res.ok) return;
        const body = await res.json();
        if (!cancelled) setModifiedTime(body.modifiedTime);
      } catch {
        // Ambient info only — silently retry on the next tick.
      }
    }

    void poll();
    const intervalId = setInterval(() => void poll(), POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, []);

  if (!modifiedTime) return null;

  return (
    <span title={new Date(modifiedTime).toLocaleString()} className="text-sm text-[var(--color-muted)]">
      Data updated {formatRelativeTime(modifiedTime, new Date())}
    </span>
  );
}
