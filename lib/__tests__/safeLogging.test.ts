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

    expect(consoleErrorSpy).toHaveBeenCalledWith('Server failure', {
      operation: 'search.GET',
      classification: 'error',
      status: 503,
    });

    const serializedCalls = JSON.stringify(consoleErrorSpy.mock.calls);
    expect(serializedCalls).not.toContain('authorization failed for subject_token abc123');
    expect(serializedCalls).not.toContain('Bearer secret-token');
    expect(serializedCalls).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.signature');
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

    expect(consoleErrorSpy).toHaveBeenCalledWith('Server failure', {
      operation: 'admin.config.POST',
      classification: 'object',
      status: 400,
    });

    const serializedCalls = JSON.stringify(consoleErrorSpy.mock.calls);
    expect(serializedCalls).not.toContain('subject_token');
    expect(serializedCalls).not.toContain('Bearer secret-token');
    expect(serializedCalls).not.toContain('Sensitive upstream body');
    expect(serializedCalls).not.toContain('do not leak this');
  });
});
