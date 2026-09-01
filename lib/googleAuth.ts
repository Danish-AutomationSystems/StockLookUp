import { getVercelOidcToken } from '@vercel/oidc';
import { ExternalAccountClient, type BaseExternalAccountClient } from 'google-auth-library';

const VERCEL_OIDC_AUDIENCE = 'https://vercel.com/automation-systems';

function getVercelSubjectToken(): Promise<string> {
  return getVercelOidcToken({ audience: VERCEL_OIDC_AUDIENCE });
}

function getSubjectTokenSupplier(subjectToken?: string): { getSubjectToken: () => Promise<string> } {
  if (subjectToken) {
    return {
      getSubjectToken: async () => subjectToken,
    };
  }

  return {
    getSubjectToken: getVercelSubjectToken,
  };
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export function getGoogleAuthClient(subjectToken?: string): BaseExternalAccountClient {
  const projectNumber = requireEnv('GCP_PROJECT_NUMBER');
  const poolId = requireEnv('GCP_WORKLOAD_IDENTITY_POOL_ID');
  const providerId = requireEnv('GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID');
  const serviceAccountEmail = requireEnv('GCP_SERVICE_ACCOUNT_EMAIL');

  const authClient = ExternalAccountClient.fromJSON({
    type: 'external_account',
    audience: `//iam.googleapis.com/projects/${projectNumber}/locations/global/workloadIdentityPools/${poolId}/providers/${providerId}`,
    subject_token_type: 'urn:ietf:params:oauth:token-type:jwt',
    token_url: 'https://sts.googleapis.com/v1/token',
    service_account_impersonation_url: `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${serviceAccountEmail}:generateAccessToken`,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    subject_token_supplier: getSubjectTokenSupplier(subjectToken),
  });

  if (!authClient) throw new Error('Failed to create Google external account client');
  return authClient;
}
