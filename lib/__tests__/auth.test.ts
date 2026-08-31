import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { authOptions } from '@/lib/auth';

describe('authOptions.callbacks.signIn', () => {
  beforeEach(() => {
    process.env.ALLOWED_DOMAIN = 'automationsystems.org';
  });

  it('allows sign-in for a company email', async () => {
    const signIn = authOptions.callbacks!.signIn!;
    const result = await signIn({ user: { email: 'sales@automationsystems.org' } } as any);
    expect(result).toBe(true);
  });

  it('rejects sign-in for an outside email', async () => {
    const signIn = authOptions.callbacks!.signIn!;
    const result = await signIn({ user: { email: 'random@gmail.com' } } as any);
    expect(result).toBe(false);
  });
});

describe('authOptions.callbacks.jwt/session', () => {
  beforeEach(() => {
    process.env.ADMIN_EMAIL = 'testing@automationsystems.org';
  });

  it('marks the admin email as isAdmin in the token', async () => {
    const jwt = authOptions.callbacks!.jwt!;
    const token = await jwt({ token: { email: 'testing@automationsystems.org' } } as any);
    expect((token as any).isAdmin).toBe(true);
  });

  it('does not mark other emails as isAdmin', async () => {
    const jwt = authOptions.callbacks!.jwt!;
    const token = await jwt({ token: { email: 'sales@automationsystems.org' } } as any);
    expect((token as any).isAdmin).toBe(false);
  });

  it('copies isAdmin from token onto session.user', async () => {
    const session = authOptions.callbacks!.session!;
    const result = await session({
      session: { user: { email: 'testing@automationsystems.org' } },
      token: { isAdmin: true },
    } as any);
    expect((result.user as any).isAdmin).toBe(true);
  });
});
