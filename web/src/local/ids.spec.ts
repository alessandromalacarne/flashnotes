import { afterEach, describe, expect, it, vi } from 'vitest';
import { newId } from './ids';

const V7 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function timestampOf(id: string): number {
  return parseInt(id.replaceAll('-', '').slice(0, 12), 16);
}

afterEach(() => {
  vi.useRealTimers();
});

describe('newId', () => {
  it('builds a version 7 uuid with the RFC 4122 variant', () => {
    expect(newId()).toMatch(V7);
  });

  it('puts the current time in the first 48 bits', () => {
    vi.useFakeTimers({ now: 1_700_000_000_000 });

    expect(timestampOf(newId())).toBe(1_700_000_000_000);
  });

  it('keeps ids from different milliseconds ordered', () => {
    vi.useFakeTimers({ now: 1_700_000_000_000 });
    const earlier = newId();

    vi.setSystemTime(1_700_000_001_000);
    const later = newId();

    expect(timestampOf(later)).toBeGreaterThan(timestampOf(earlier));
    expect(later > earlier).toBe(true);
  });

  it('does not repeat itself for ids made in the same millisecond', () => {
    vi.useFakeTimers({ now: 1_700_000_000_000 });

    const ids = new Set(Array.from({ length: 20 }, () => newId()));

    expect(ids.size).toBe(20);
  });
});
