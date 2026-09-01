import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { isAdmin: true } } }),
  signOut: vi.fn(),
}));

import HomePage from '@/app/page';

describe('HomePage', () => {
  it('uses the shared 44px target class for header navigation links', () => {
    render(<HomePage />);

    expect(screen.getByRole('link', { name: 'StockLooker' })).toHaveClass('link-target');
    expect(screen.getByRole('link', { name: 'Admin' })).toHaveClass('link-target');
  });
});
