import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const signInMock = vi.fn();
vi.mock('next-auth/react', () => ({ signIn: (...args: unknown[]) => signInMock(...args) }));
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(''),
}));

import LoginPage from '@/app/login/page';

describe('LoginPage', () => {
  it('calls signIn("google") when the button is clicked', async () => {
    render(<LoginPage />);
    await userEvent.click(screen.getByRole('button', { name: /sign in with google/i }));
    expect(signInMock).toHaveBeenCalledWith('google', { callbackUrl: '/' });
  });
});
