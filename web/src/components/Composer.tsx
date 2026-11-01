import { useEffect, useRef, useState } from 'react';
import { extractGroups, stripGroups } from '../lib/extract-groups';

interface ComposerProps {
  onSubmit: (content: string) => Promise<void>;
}

function useComposer(onSubmit: (content: string) => Promise<void>) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const savedTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(savedTimer.current), []);

  function change(next: string) {
    setValue(next);
    if (error) {
      setError(null);
    }
  }

  async function submit() {
    const content = value.trim();
    if (content.length === 0) {
      setError('Write something before dumping');
      return;
    }
    if (extractGroups(content).length === 0) {
      setError('Include at least one @group in the note');
      return;
    }
    if (stripGroups(content).length === 0) {
      setError('The note needs text besides the @group');
      return;
    }

    setError(null);
    setBusy(true);
    try {
      await onSubmit(content);
      setValue('');
      setSaved(true);
      window.clearTimeout(savedTimer.current);
      savedTimer.current = window.setTimeout(() => setSaved(false), 1600);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Could not send the note',
      );
    } finally {
      setBusy(false);
    }
  }

  return { value, error, saved, busy, change, submit };
}

interface ComposerFooterProps {
  error: string | null;
  saved: boolean;
  busy: boolean;
}

function ComposerFooter({ error, saved, busy }: ComposerFooterProps) {
  return (
    <div className="flex min-h-16 items-center gap-4 border-t border-line px-4 py-3 sm:px-6">
      {error ? (
        <p role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      ) : saved ? (
        <p className="animate-fade-in text-sm text-ink-soft">note saved</p>
      ) : (
        <p className="text-sm text-ink-faint">
          Enter sends · end with at least one @group
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="ml-auto inline-flex min-h-11 shrink-0 items-center rounded-full bg-mark px-6 font-semibold text-mark-contrast transition-[filter] hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Note
      </button>
    </div>
  );
}

export function Composer({ onSubmit }: ComposerProps) {
  const { value, error, saved, busy, change, submit } = useComposer(onSubmit);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  return (
    <form
      aria-label="New note"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
      onClick={(event) => {
        if (
          (event.target as HTMLElement).closest('button, textarea') === null
        ) {
          textareaRef.current?.focus();
        }
      }}
      className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-[inset_0_1px_0_oklch(1_0_0/0.04)]"
    >
      <textarea
        ref={textareaRef}
        autoFocus
        aria-label="New note"
        placeholder="Write what's on your mind... and finish with a @group"
        value={value}
        onChange={(event) => change(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            void submit();
          }
        }}
        disabled={busy}
        className="min-h-0 w-full flex-1 resize-none bg-transparent p-5 text-lg leading-relaxed text-ink placeholder:text-ink-faint focus:outline-none disabled:opacity-60 sm:p-8 sm:text-xl"
      />

      <ComposerFooter error={error} saved={saved} busy={busy} />
    </form>
  );
}
