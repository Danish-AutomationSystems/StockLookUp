import { describe, it, expect } from 'vitest';
import { formatRelativeTime } from '@/lib/formatRelativeTime';

const NOW = new Date('2026-09-15T12:00:00.000Z');

describe('formatRelativeTime', () => {
  it('returns "just now" for under 60 seconds ago', () => {
    const isoString = new Date(NOW.getTime() - 30 * 1000).toISOString();
    expect(formatRelativeTime(isoString, NOW)).toBe('just now');
  });

  it('returns singular minute for exactly 1 minute ago', () => {
    const isoString = new Date(NOW.getTime() - 60 * 1000).toISOString();
    expect(formatRelativeTime(isoString, NOW)).toBe('1 min ago');
  });

  it('returns plural minutes for multiple minutes ago', () => {
    const isoString = new Date(NOW.getTime() - 5 * 60 * 1000).toISOString();
    expect(formatRelativeTime(isoString, NOW)).toBe('5 min ago');
  });

  it('returns singular hour for exactly 1 hour ago', () => {
    const isoString = new Date(NOW.getTime() - 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(isoString, NOW)).toBe('1 hour ago');
  });

  it('returns plural hours for multiple hours ago', () => {
    const isoString = new Date(NOW.getTime() - 3 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(isoString, NOW)).toBe('3 hours ago');
  });

  it('returns singular day for exactly 1 day ago', () => {
    const isoString = new Date(NOW.getTime() - 24 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(isoString, NOW)).toBe('1 day ago');
  });

  it('returns plural days for multiple days ago', () => {
    const isoString = new Date(NOW.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(isoString, NOW)).toBe('5 days ago');
  });

  it('falls back to a locale date string past 7 days', () => {
    const isoString = new Date(NOW.getTime() - 8 * 24 * 60 * 60 * 1000).toISOString();
    const result = formatRelativeTime(isoString, NOW);
    expect(result).toBe(new Date(isoString).toLocaleDateString());
  });
});
