import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import SheetStatus from '@/components/SheetStatus';

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

  it('renders the relative time with an absolute-time tooltip after fetching', async () => {
    const modifiedTime = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ modifiedTime }),
    }) as any;

    render(<SheetStatus />);

    await waitFor(() => {
      expect(screen.getByText(/Data updated 5 min ago/i)).toBeInTheDocument();
    });
    const el = screen.getByText(/Data updated 5 min ago/i);
    expect(el).toHaveAttribute('title', new Date(modifiedTime).toLocaleString());
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
});
