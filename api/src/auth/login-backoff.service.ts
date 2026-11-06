import { Injectable } from '@nestjs/common';
import { normalizeEmail } from '../users/email.js';

const MAX_ENTRIES = 10_000;
const FAILURES_BEFORE_BLOCK = 5;
const BASE_BLOCK_MS = 30_000;
const MAX_BLOCK_MS = 15 * 60_000;

interface Attempt {
  failures: number;
  lastFailureAt: number;
  blockedUntil: number;
}

/**
 * Progressive lockout for password attempts, kept per account rather than per
 * IP: an attacker behind one address cannot rotate emails to escape it, and a
 * distributed attack still needs one attempt per account. The trade-off is
 * that an attacker can lock a known account out for up to 15 minutes; the
 * threshold sits high enough that a user mistyping a password is not blocked.
 *
 * In memory on purpose, like the default session store: a restart clears the
 * lockouts, and multi-instance deployments should move this to Redis.
 */
@Injectable()
export class LoginBackoffService {
  private readonly attempts = new Map<string, Attempt>();

  retryAfterSeconds(email: string, now = Date.now()): number {
    const attempt = this.attempts.get(normalizeEmail(email));

    if (!attempt || attempt.blockedUntil <= now) {
      return 0;
    }

    return Math.ceil((attempt.blockedUntil - now) / 1000);
  }

  registerFailure(email: string, now = Date.now()): void {
    const key = normalizeEmail(email);
    const failures = (this.attempts.get(key)?.failures ?? 0) + 1;
    const blockedUntil =
      failures >= FAILURES_BEFORE_BLOCK ? now + blockDuration(failures) : 0;

    this.attempts.set(key, { failures, lastFailureAt: now, blockedUntil });
    this.evictOldest();
  }

  registerSuccess(email: string): void {
    this.attempts.delete(normalizeEmail(email));
  }

  private evictOldest(): void {
    if (this.attempts.size <= MAX_ENTRIES) {
      return;
    }

    const oldest = this.attempts.keys().next().value;
    if (oldest !== undefined) {
      this.attempts.delete(oldest);
    }
  }
}

function blockDuration(failures: number): number {
  const steps = failures - FAILURES_BEFORE_BLOCK;
  return Math.min(BASE_BLOCK_MS * 2 ** steps, MAX_BLOCK_MS);
}
