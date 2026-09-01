import { describe, it, expect } from 'vitest';
import { isAllowedDomain, isAdmin } from '@/lib/authRules';

describe('isAllowedDomain', () => {
  it('returns true for matching domain', () => {
    expect(isAllowedDomain('user@automationsystems.org', 'automationsystems.org')).toBe(true);
  });
  it('is case-insensitive', () => {
    expect(isAllowedDomain('USER@AutomationSystems.ORG', 'automationsystems.org')).toBe(true);
  });
  it('returns false for other domain', () => {
    expect(isAllowedDomain('user@gmail.com', 'automationsystems.org')).toBe(false);
  });
  it('returns false for null/undefined email', () => {
    expect(isAllowedDomain(null, 'automationsystems.org')).toBe(false);
    expect(isAllowedDomain(undefined, 'automationsystems.org')).toBe(false);
  });
});

describe('isAdmin', () => {
  it('returns true for matching email, case-insensitive', () => {
    expect(isAdmin('Testing@AutomationSystems.org', 'testing@automationsystems.org')).toBe(true);
  });
  it('returns false for different email', () => {
    expect(isAdmin('other@automationsystems.org', 'testing@automationsystems.org')).toBe(false);
  });
  it('accepts any email in a comma-separated admin allowlist', () => {
    expect(isAdmin('himanshuneb@automationsystems.org', 'testing@automationsystems.org, himanshuneb@automationsystems.org')).toBe(true);
  });
  it('returns false for null email', () => {
    expect(isAdmin(null, 'testing@automationsystems.org')).toBe(false);
  });
});
