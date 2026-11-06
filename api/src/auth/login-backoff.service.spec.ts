import { describe, expect, it } from 'vitest';
import { LoginBackoffService } from './login-backoff.service.js';

const EMAIL = 'ana@example.com';
const T0 = new Date('2026-01-01T00:00:00.000Z').getTime();

function fail(service: LoginBackoffService, count: number): void {
  for (let index = 0; index < count; index += 1) {
    service.registerFailure(EMAIL, T0 + index);
  }
}

describe('LoginBackoffService', () => {
  it('does not block before the fifth failure', () => {
    const service = new LoginBackoffService();
    fail(service, 4);

    expect(service.retryAfterSeconds(EMAIL, T0 + 3)).toBe(0);
  });

  it('blocks for 30 seconds on the fifth failure', () => {
    const service = new LoginBackoffService();
    fail(service, 5);

    expect(service.retryAfterSeconds(EMAIL, T0 + 4)).toBe(30);
    expect(service.retryAfterSeconds(EMAIL, T0 + 34_000)).toBe(0);
  });

  it('doubles the block on each further failure and caps it at 15 minutes', () => {
    const service = new LoginBackoffService();
    fail(service, 6);

    expect(service.retryAfterSeconds(EMAIL, T0 + 5)).toBe(60);

    fail(service, 11);

    expect(service.retryAfterSeconds(EMAIL, T0 + 10)).toBe(15 * 60);
  });

  it('clears the counter after a successful sign-in', () => {
    const service = new LoginBackoffService();
    fail(service, 5);

    service.registerSuccess(EMAIL);

    expect(service.retryAfterSeconds(EMAIL, T0 + 4)).toBe(0);
  });

  it('matches emails the same way the user repository stores them', () => {
    const service = new LoginBackoffService();
    fail(service, 5);

    expect(service.retryAfterSeconds('  ANA@Example.com ', T0 + 4)).toBe(30);
  });
});
