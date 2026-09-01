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
