import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import SheetStatus from '@/components/SheetStatus';
import { formatAbsoluteTime } from '@/lib/formatAbsoluteTime';

describe('SheetStatus', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('renders nothing before the first fetch resolves', () => {
    global.fetch = vi.fn(() => new Promise(() => {})) as any;
    const { container } = render(<SheetStatus />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the relative time with the absolute time inline and as a tooltip', async () => {
    const modifiedTime = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ modifiedTime }),
    }) as any;

    render(<SheetStatus />);

    const absolute = formatAbsoluteTime(modifiedTime);
    await waitFor(() => {
      expect(screen.getByText(new RegExp(`Data updated 5 min ago \\(${absolute.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)`))).toBeInTheDocument();
    });
    const el = screen.getByText(/Data updated 5 min ago/i);
    expect(el).toHaveAttribute('title', absolute);
  });

  it('renders nothing when the fetch response is not ok', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }) as any;
    const { container } = render(<SheetStatus />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalledOnce());
    expect(container).toBeEmptyDOMElement();
  });

  it('re-fetches every 60 seconds', async () => {
    const modifiedTime = new Date(Date.now() - 60 * 1000).toISOString();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ modifiedTime }),
    }) as any;

    render(<SheetStatus />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));

    await vi.advanceTimersByTimeAsync(60 * 1000);
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
  });

  it('ages the displayed relative time even when the fetched modifiedTime is unchanged', async () => {
    const t0 = new Date('2024-01-01T00:00:00.000Z');
    vi.setSystemTime(t0);
    const modifiedTime = new Date(t0.getTime() - 60 * 1000).toISOString(); // 1 min before t0

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ modifiedTime }),
    }) as any;

    render(<SheetStatus />);

    await waitFor(() => {
      expect(screen.getByText(/Data updated 1 min ago/i)).toBeInTheDocument();
    });

    // Advance 2 more minutes without the fetched modifiedTime ever changing.
    await vi.advanceTimersByTimeAsync(2 * 60 * 1000);

    await waitFor(() => {
      expect(screen.getByText(/Data updated 3 min ago/i)).toBeInTheDocument();
    });
  });

  it('stops polling once unmounted', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ modifiedTime: new Date().toISOString() }),
    }) as any;

    const { unmount } = render(<SheetStatus />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));

    unmount();
    const callsAtUnmount = (global.fetch as any).mock.calls.length;

    await vi.advanceTimersByTimeAsync(2 * 60 * 1000);

    expect(global.fetch).toHaveBeenCalledTimes(callsAtUnmount);
  });
});
