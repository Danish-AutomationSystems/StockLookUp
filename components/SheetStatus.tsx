'use client';

import { useEffect, useState } from 'react';
import { formatRelativeTime } from '@/lib/formatRelativeTime';
import { formatAbsoluteTime } from '@/lib/formatAbsoluteTime';

const POLL_INTERVAL_MS = 60 * 1000;

export default function SheetStatus() {
  const [modifiedTime, setModifiedTime] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

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
    const intervalId = setInterval(() => {
      void poll();
      if (!cancelled) setNow(new Date());
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, []);

  if (!modifiedTime) return null;

  return (
    <span title={formatAbsoluteTime(modifiedTime)} className="text-sm text-[var(--color-muted)]">
      Data updated {formatRelativeTime(modifiedTime, now)} ({formatAbsoluteTime(modifiedTime)})
    </span>
  );
}
