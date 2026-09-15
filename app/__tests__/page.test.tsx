import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { isAdmin: true } } }),
  signOut: vi.fn(),
}));

import HomePage from '@/app/page';

describe('HomePage', () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/sheet-status') {
        return Promise.resolve({
          ok: true,
          json: async () => ({ modifiedTime: new Date().toISOString() }),
        });
      }
      throw new Error(`Unexpected URL: ${url}`);
    }) as typeof fetch;
  });

  it('uses the shared 44px target class for header navigation links', () => {
    render(<HomePage />);

    expect(screen.getByRole('link', { name: 'StockLooker' })).toHaveClass('link-target');
    expect(screen.getByRole('link', { name: 'Admin' })).toHaveClass('link-target');
  });
});
