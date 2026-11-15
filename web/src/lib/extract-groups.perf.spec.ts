import { describe, expect, it } from 'vitest';
import { extractGroups } from './extract-groups';

// Regression guard for the quadratic backtracking a trailing-marker regex
// pays: `@a ` repeated and closed by a char that cannot end a marker forces
// the engine to give up on every start position.
const SMALL_CHARS = 25_000;
const LARGE_CHARS = 100_000;
const RUNS = 5;

function adversarial(chars: number): string {
  return '@a '.repeat(Math.floor(chars / 3)) + '!';
}

// The fastest of several runs, so a GC pause or a busy box cannot fail it.
function fastest(run: () => void): number {
  let best = Infinity;
  for (let attempt = 0; attempt < RUNS; attempt += 1) {
    const started = performance.now();
    run();
    best = Math.min(best, performance.now() - started);
  }
  return best;
}

describe('extractGroups scaling', () => {
  it('stays linear on adversarial input', () => {
    const small = adversarial(SMALL_CHARS);
    const large = adversarial(LARGE_CHARS);

    expect(extractGroups(large)).toEqual([]);

    extractGroups(small);
    extractGroups(large);

    const smallMs = fastest(() => extractGroups(small));
    const largeMs = fastest(() => extractGroups(large));

    // Four times the input is four times the work when linear and sixteen when
    // quadratic; 6 leaves room for timer noise without hiding a regression.
    expect(largeMs / smallMs).toBeLessThan(6);
  });
});
