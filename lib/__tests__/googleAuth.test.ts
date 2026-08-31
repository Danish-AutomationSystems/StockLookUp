import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { requireEnv, getGoogleAuthClient } from '@/lib/googleAuth';

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

  it('throws when GCP_PROJECT_NUMBER is missing', () => {
    delete process.env.GCP_PROJECT_NUMBER;
    expect(() => getGoogleAuthClient()).toThrow(
      'Missing required environment variable: GCP_PROJECT_NUMBER'
    );
  });
});
