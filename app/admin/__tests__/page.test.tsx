import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminPage from '@/app/admin/page';

describe('AdminPage', () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      if (!options || options.method === undefined) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            headers: ['SKU', 'Name', 'Price'],
            config: { searchColumn: 'SKU', resultColumns: ['Name'] },
          }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({ success: true }) });
    }) as any;
  });

  it('loads headers and current config, then saves an updated selection', async () => {
    render(<AdminPage />);

    await waitFor(() => expect(screen.getByLabelText(/search column/i)).toBeInTheDocument());

    await userEvent.click(screen.getByLabelText('Price'));
    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/admin/config',
        expect.objectContaining({ method: 'POST' })
      );
    });
  });
});
