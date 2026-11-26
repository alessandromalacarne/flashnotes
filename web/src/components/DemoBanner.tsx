import { useState } from 'react';
import { prepareDemoData } from '../local/store';

function useDemoReset(userId: string) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reset() {
    setBusy(true);
    setError(null);
    try {
      await prepareDemoData(userId);
      setConfirming(false);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Could not reset the demo',
      );
    } finally {
      setBusy(false);
    }
  }

  return { confirming, setConfirming, busy, error, reset };
}

export function DemoBanner({ userId }: { userId: string }) {
  const { confirming, setConfirming, busy, error, reset } =
    useDemoReset(userId);

  return (
    <section
      role="status"
      aria-label="Demo mode"
      className="mb-3 flex shrink-0 flex-wrap items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2 text-xs text-ink-soft"
    >
      <p>Demo mode: notes stay in this browser and are removed on sign out.</p>

      {confirming ? (
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void reset()}
            className="rounded-full bg-mark px-3 py-1 font-semibold text-mark-contrast disabled:opacity-50"
          >
            Reset
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setConfirming(false)}
            className="rounded-full border border-line px-3 py-1 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="ml-auto rounded-full border border-line px-3 py-1 transition-colors hover:border-ink-faint hover:text-ink"
        >
          Reset demo data
        </button>
      )}

      {error ? (
        <p role="alert" className="w-full text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
    </section>
  );
}
