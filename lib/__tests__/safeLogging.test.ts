import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logServerFailure } from '@/lib/safeLogging';

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  consoleErrorSpy.mockRestore();
});

describe('logServerFailure', () => {
  it('includes only a safe operation stage when provided', () => {
    logServerFailure('admin.config.GET', { code: 400 }, 'spreadsheet metadata');

    expect(consoleErrorSpy.mock.calls).toEqual([
      ['Server failure', { operation: 'admin.config.GET', stage: 'spreadsheet metadata', classification: 'object', status: 400 }],
    ]);
  });

  it('includes only a whitelisted upstream reason when available', () => {
    logServerFailure('admin.config.GET', { response: { status: 400, data: { error: { status: 'INVALID_ARGUMENT' } } } }, 'spreadsheet metadata');

    expect(consoleErrorSpy.mock.calls).toEqual([
      ['Server failure', { operation: 'admin.config.GET', stage: 'spreadsheet metadata', classification: 'object', status: 400, reason: 'INVALID_ARGUMENT' }],
    ]);
  });

  it('maps an authentication error message to a safe reason without logging the message', () => {
    logServerFailure('admin.config.GET', new Error('invalid_grant: Invalid JWT signature with subject_token=secret'));

    expect(consoleErrorSpy.mock.calls).toEqual([
      ['Server failure', {
        operation: 'admin.config.GET',
        classification: 'error',
        reason: 'UNAUTHENTICATED',
        upstreamCode: 'invalid_grant',
        upstreamDetail: 'invalid grant',
      }],
    ]);
  });

  it('logs a recognized STS invalid_target code and normalized audience detail without credentials', () => {
    logServerFailure('admin.config.GET', {
      response: {
        status: 400,
        data: {
          error: {
            error: 'invalid_target',
            error_description: 'Invalid target audience https://vercel.com/automation-systems subject_token=super-secret Authorization: Bearer top-secret eyJhbGciOiJIUzI1NiJ9.payload.signature',
          },
        },
      },
    }, 'token exchange');

    expect(consoleErrorSpy.mock.calls).toEqual([
      ['Server failure', {
        operation: 'admin.config.GET',
        stage: 'token exchange',
        classification: 'object',
        status: 400,
        upstreamCode: 'invalid_target',
        upstreamDetail: 'invalid target audience',
      }],
    ]);
  });

  it('logs a recognized STS invalid_grant code with a fixed sanitized detail', () => {
    logServerFailure(
      'admin.config.GET',
      new Error('invalid_grant: token rejected: subject_token=super-secret Authorization: Bearer top-secret eyJhbGciOiJIUzI1NiJ9.payload.signature'),
      'token exchange',
    );

    expect(consoleErrorSpy.mock.calls).toEqual([
      ['Server failure', {
        operation: 'admin.config.GET',
        stage: 'token exchange',
        classification: 'error',
        reason: 'UNAUTHENTICATED',
        upstreamCode: 'invalid_grant',
        upstreamDetail: 'invalid grant',
      }],
    ]);
  });

  it('logs only stable metadata for thrown Error objects', () => {
    const err = Object.assign(new Error('authorization failed for subject_token abc123'), {
      status: 503,
      authorization: 'Bearer secret-token',
      response: {
        status: 503,
        data: {
          error: {
            message: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.signature',
          },
        },
      },
    });

    logServerFailure('search.GET', err);

    expect(consoleErrorSpy.mock.calls).toEqual([
      ['Server failure', { operation: 'search.GET', classification: 'error', status: 503 }],
    ]);
  });

  it('redacts raw object contents and keeps only object classification and numeric status', () => {
    logServerFailure('admin.config.POST', {
      authorization: 'Bearer secret-token',
      subject_token: 'abc123',
      response: {
        status: 400,
        data: {
          message: 'Sensitive upstream body',
        },
      },
      message: 'do not leak this',
    });

    expect(consoleErrorSpy.mock.calls).toEqual([
      ['Server failure', { operation: 'admin.config.POST', classification: 'object', status: 400 }],
    ]);
  });

  it('does not leak a sensitive Error message when the Error has no enumerable custom fields', () => {
    logServerFailure('admin.config.GET', new Error('subject_token=abc123 authorization=Bearer secret-token'));

    expect(consoleErrorSpy.mock.calls).toEqual([
      ['Server failure', { operation: 'admin.config.GET', classification: 'error' }],
    ]);
  });
});
