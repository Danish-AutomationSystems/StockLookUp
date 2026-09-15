const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const MAX_RELATIVE_DAYS = 7;

export function formatRelativeTime(isoString: string, now: Date): string {
  const then = new Date(isoString);
  const diffMs = now.getTime() - then.getTime();

  if (diffMs < MINUTE_MS) return 'just now';

  if (diffMs < HOUR_MS) {
    const minutes = Math.floor(diffMs / MINUTE_MS);
    return `${minutes} min ago`;
  }

  if (diffMs < DAY_MS) {
    const hours = Math.floor(diffMs / HOUR_MS);
    return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  }

  const days = Math.floor(diffMs / DAY_MS);
  if (days <= MAX_RELATIVE_DAYS) {
    return `${days} day${days === 1 ? '' : 's'} ago`;
  }

  return then.toLocaleDateString();
}
