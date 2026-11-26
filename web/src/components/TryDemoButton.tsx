import { useState } from 'react';
import { useAuth } from '../auth/auth-context';

interface TryDemoButtonProps {
  onEntered: () => void;
  className?: string;
}

export function TryDemoButton({ onEntered, className }: TryDemoButtonProps) {
  const { startDemo } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enter() {
    if (busy) {
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await startDemo();
      onEntered();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Could not start the demo',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={
        className ? `flex flex-col gap-2 ${className}` : 'flex flex-col gap-2'
      }
    >
      <button
        type="button"
        onClick={() => void enter()}
        disabled={busy}
        className="inline-flex min-h-12 items-center justify-center rounded-full border border-line px-7 text-ink-soft transition-colors hover:border-ink-faint hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
      >
        Try demo
      </button>

      {error ? (
        <p role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
