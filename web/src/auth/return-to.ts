const FALLBACK = '/app';

export function returnTo(state: unknown): string {
  if (state !== null && typeof state === 'object' && 'from' in state) {
    const from = (state as { from?: unknown }).from;
    if (typeof from === 'string' && from.startsWith('/')) {
      return from;
    }
  }

  return FALLBACK;
}
