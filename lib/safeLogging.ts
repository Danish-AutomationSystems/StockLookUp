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

export function logServerFailure(operation: string, error: unknown): void {
  const payload: {
    classification: FailureClassification;
    operation: string;
    status?: number;
  } = {
    operation,
    classification: classifyFailure(error),
  };

  const status = readNumericStatus(error);
  if (status !== undefined) {
    payload.status = status;
  }

  console.error('Server failure', payload);
}
