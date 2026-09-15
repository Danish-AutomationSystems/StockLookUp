import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('@vercel/oidc', () => ({
  getVercelOidcToken: vi.fn().mockResolvedValue('fallback-oidc-token'),
}));

import { requireEnv, getGoogleAuthClient } from '@/lib/googleAuth';
import { getVercelOidcToken } from '@vercel/oidc';

const REQUIRED_VARS = [
  'GCP_PROJECT_NUMBER',
  'GCP_WORKLOAD_IDENTITY_POOL_ID',
  'GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID',
  'GCP_SERVICE_ACCOUNT_EMAIL',
];

describe('requireEnv', () => {
  it('returns the value when set', () => {
    process.env.__TEST_VAR__ = 'hello';
    expect(requireEnv('__TEST_VAR__')).toBe('hello');
    delete process.env.__TEST_VAR__;
  });

  it('throws when not set', () => {
    delete process.env.__TEST_MISSING__;
    expect(() => requireEnv('__TEST_MISSING__')).toThrow(
      'Missing required environment variable: __TEST_MISSING__'
    );
  });
});

describe('getGoogleAuthClient', () => {
  const originalValues: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of REQUIRED_VARS) originalValues[key] = process.env[key];
    process.env.GCP_PROJECT_NUMBER = '592405826741';
    process.env.GCP_WORKLOAD_IDENTITY_POOL_ID = 'vercel';
    process.env.GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID = 'vercel';
    process.env.GCP_SERVICE_ACCOUNT_EMAIL = 'stocklooker-sheets@stocklooker.iam.gserviceaccount.com';
  });

  afterEach(() => {
    for (const key of REQUIRED_VARS) {
      if (originalValues[key] === undefined) delete process.env[key];
      else process.env[key] = originalValues[key];
    }
  });

  it('builds a client without throwing when all env vars are set', () => {
    expect(() => getGoogleAuthClient()).not.toThrow();
  });

  it('returns a client that can preflight an access-token exchange', () => {
    expect(getGoogleAuthClient()).toHaveProperty('getAccessToken');
  });

  it('uses the request-scoped OIDC token as its subject-token supplier when provided', async () => {
    const client = getGoogleAuthClient('request-scoped-oidc-token') as any;

    await expect(client.subjectTokenSupplier.getSubjectToken()).resolves.toBe('request-scoped-oidc-token');
    expect(getVercelOidcToken).not.toHaveBeenCalled();
  });

  it('uses Vercel OIDC with the configured audience when no request token is provided', async () => {
    const client = getGoogleAuthClient() as any;

    await expect(client.subjectTokenSupplier.getSubjectToken()).resolves.toBe('fallback-oidc-token');
    expect(getVercelOidcToken).toHaveBeenCalledWith({ audience: 'https://vercel.com/automation-systems' });
  });

  it('does not force a quota project for Google API requests', () => {
    expect((getGoogleAuthClient() as any).quotaProjectId).toBeUndefined();
  });

  it('requests the Sheets and Drive metadata scopes for service-account access tokens', () => {
    expect((getGoogleAuthClient() as any).scopes).toEqual([
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive.metadata.readonly',
    ]);
  });

  it('throws when GCP_PROJECT_NUMBER is missing', () => {
    delete process.env.GCP_PROJECT_NUMBER;
    expect(() => getGoogleAuthClient()).toThrow(
      'Missing required environment variable: GCP_PROJECT_NUMBER'
    );
  });
});
