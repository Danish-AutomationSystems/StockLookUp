type FailureClassification =
  | 'array'
  | 'boolean'
  | 'error'
  | 'function'
  | 'null'
  | 'number'
  | 'object'
  | 'string'
  | 'symbol'
  | 'undefined';

const SAFE_UPSTREAM_REASONS = new Set([
  'FAILED_PRECONDITION',
  'INVALID_ARGUMENT',
  'NOT_FOUND',
  'PERMISSION_DENIED',
  'RESOURCE_EXHAUSTED',
  'SERVICE_DISABLED',
  'UNAUTHENTICATED',
]);

const SAFE_AUTH_CODES = new Set([
  'access_denied',
  'invalid_grant',
  'invalid_request',
  'invalid_target',
  'permission_denied',
  'unauthenticated',
  'unauthorized_client',
]);

const MAX_AUTH_SOURCE_LENGTH = 160;

type SafeAuthCode =
  | 'access_denied'
  | 'invalid_grant'
  | 'invalid_request'
  | 'invalid_target'
  | 'permission_denied'
  | 'unauthenticated'
  | 'unauthorized_client';

type SafeAuthDiagnostic = {
  code: SafeAuthCode;
  detail: string;
};

function classifyFailure(error: unknown): FailureClassification {
  if (error instanceof Error) return 'error';
  if (Array.isArray(error)) return 'array';
  if (error === null) return 'null';
  return typeof error as FailureClassification;
}

function readNumericStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined;

  const candidate = error as {
    code?: unknown;
    response?: { status?: unknown };
    status?: unknown;
  };

  for (const value of [candidate.status, candidate.response?.status, candidate.code]) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
  }

  return undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

function redactAuthSource(value: string): string {
  return value
    .replace(/\bsubject_token\s*[=:]\s*(?:"[^"]*"|'[^']*'|\S+)/gi, 'subject_token=[REDACTED]')
    .replace(/\bauthorization\s*[=:]\s*(?:"[^"]*"|'[^']*'|\S+)/gi, 'authorization=[REDACTED]')
    .replace(/\bbearer\s+[A-Za-z0-9._~+\/-]+=*/gi, 'Bearer [REDACTED]')
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[REDACTED_JWT]')
    .slice(0, MAX_AUTH_SOURCE_LENGTH);
}

function readAuthSources(error: unknown): string[] {
  const candidate = asRecord(error);
  if (!candidate) return [];

  const response = asRecord(candidate.response);
  const data = asRecord(response?.data);
  const upstreamError = asRecord(data?.error);

  const values = [
    candidate.message,
    data?.error,
    data?.error_description,
    upstreamError?.error,
    upstreamError?.code,
    upstreamError?.status,
    upstreamError?.reason,
    upstreamError?.error_description,
    upstreamError?.message,
  ];

  return values
    .filter((value): value is string => typeof value === 'string')
    .map(redactAuthSource);
}

function extractSafeAuthDiagnostic(error: unknown): SafeAuthDiagnostic | undefined {
  const source = readAuthSources(error).join(' ').toLowerCase();
  if (!source) return undefined;

  const matchingCode = [...SAFE_AUTH_CODES].find((code) =>
    new RegExp(`\\b${code}\\b`, 'i').test(source),
  ) as SafeAuthCode | undefined;

  const code = matchingCode
    ?? (/\bpermission denied\b|\baccess denied\b/i.test(source) ? 'permission_denied' : undefined)
    ?? (/\bunauthenticated\b|\bauthentication failed\b/i.test(source) ? 'unauthenticated' : undefined);

  if (!code) return undefined;

  if (code === 'invalid_target') {
    return { code, detail: /\baudience\b/i.test(source) ? 'invalid target audience' : 'invalid target' };
  }

  const detailByCode: Record<Exclude<SafeAuthCode, 'invalid_target'>, string> = {
    access_denied: 'access denied',
    invalid_grant: 'invalid grant',
    invalid_request: 'invalid request',
    permission_denied: 'permission denied',
    unauthenticated: 'unauthenticated',
    unauthorized_client: 'unauthorized client',
  };

  return { code, detail: detailByCode[code] };
}

function readSafeReason(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const candidate = error as any;
  const reason = candidate.response?.data?.error?.status ?? candidate.response?.data?.error?.reason;
  if (typeof reason === 'string' && SAFE_UPSTREAM_REASONS.has(reason)) return reason;

  const authDiagnostic = extractSafeAuthDiagnostic(error);
  if (authDiagnostic?.code === 'invalid_grant' || authDiagnostic?.code === 'unauthenticated') return 'UNAUTHENTICATED';
  if (authDiagnostic?.code === 'permission_denied' || authDiagnostic?.code === 'access_denied') return 'PERMISSION_DENIED';

  const message = error instanceof Error ? error.message : typeof candidate.message === 'string' ? candidate.message : '';
  if (/invalid argument|invalid value|unable to parse range/i.test(message)) return 'INVALID_ARGUMENT';
  if (/permission denied|forbidden|access denied/i.test(message)) return 'PERMISSION_DENIED';
  return undefined;
}

export function logServerFailure(operation: string, error: unknown, stage?: string): void {
  const payload: {
    classification: FailureClassification;
    operation: string;
    reason?: string;
    stage?: string;
    status?: number;
    upstreamCode?: SafeAuthCode;
    upstreamDetail?: string;
  } = {
    operation,
    classification: classifyFailure(error),
  };

  if (stage) payload.stage = stage;

  const reason = readSafeReason(error);
  if (reason) payload.reason = reason;

  const authDiagnostic = extractSafeAuthDiagnostic(error);
  if (authDiagnostic) {
    payload.upstreamCode = authDiagnostic.code;
    payload.upstreamDetail = authDiagnostic.detail;
  }

  const status = readNumericStatus(error);
  if (status !== undefined) {
    payload.status = status;
  }

  console.error('Server failure', payload);
}
