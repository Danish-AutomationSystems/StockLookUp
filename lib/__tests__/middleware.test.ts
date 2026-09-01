import { describe, it, expect } from 'vitest';
import proxy, { isAuthorized } from '@/proxy';

it('exports the Next.js proxy handler', () => {
  expect(typeof proxy).toBe('function');
});

describe('isAuthorized', () => {
  it('denies access with no token', () => {
    expect(isAuthorized(null, '/')).toBe(false);
  });

  it('allows a signed-in non-admin on the home page', () => {
    expect(isAuthorized({ isAdmin: false }, '/')).toBe(true);
  });

  it('denies a signed-in non-admin on /admin', () => {
    expect(isAuthorized({ isAdmin: false }, '/admin')).toBe(false);
  });

  it('allows an admin on /admin', () => {
    expect(isAuthorized({ isAdmin: true }, '/admin')).toBe(true);
  });

  it('allows an admin on a nested /admin path', () => {
    expect(isAuthorized({ isAdmin: true }, '/admin/settings')).toBe(true);
  });

  it('denies a signed-in non-admin on /api/admin/config', () => {
    expect(isAuthorized({ isAdmin: false }, '/api/admin/config')).toBe(false);
  });

  it('allows an admin on /api/admin/config', () => {
    expect(isAuthorized({ isAdmin: true }, '/api/admin/config')).toBe(true);
  });
});
