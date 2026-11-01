import { useState } from 'react';
import type { Note } from '../api';

const dateFormat = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const iconButtonClass =
  'flex h-10 w-10 items-center justify-center rounded-full text-ink-faint transition-[color,opacity,background-color] hover:bg-paper focus-visible:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100 disabled:cursor-not-allowed disabled:opacity-50';

const solidButtonClass =
  'inline-flex min-h-9 items-center rounded-full bg-mark px-4 text-sm font-semibold text-mark-contrast transition-[filter] hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50';

const ghostButtonClass =
  'inline-flex min-h-9 items-center rounded-full px-4 text-sm text-ink-soft transition-colors hover:bg-paper hover:text-ink disabled:cursor-not-allowed disabled:opacity-50';

function PencilIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      className="h-5 w-5"
    >
      <path d="M4 20h4L18.5 9.5a2.828 2.828 0 0 0-4-4L4 16v4Z" />
      <path d="M13.5 6.5 17.5 10.5" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      className="h-5 w-5"
    >
      <path d="M4 7h16" />
      <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
      <path d="M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

interface NoteCardProps {
  note: Note;
  onUpdate: (id: string, content: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

function failureOf(cause: unknown, fallback: string): string {
  return cause instanceof Error ? cause.message : fallback;
}

function useNoteEditor({ note, onUpdate, onDelete }: NoteCardProps) {
  const [draft, setDraft] = useState(note.content);
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEditing() {
    setDraft(note.content);
    setError(null);
    setEditing(true);
  }

  function cancelEditing() {
    setEditing(false);
    setError(null);
  }

  function changeDraft(value: string) {
    setDraft(value);
    if (error) {
      setError(null);
    }
  }

  async function save() {
    setError(null);
    setBusy(true);
    try {
      await onUpdate(note.id, draft.trim());
      setEditing(false);
    } catch (cause) {
      setError(failureOf(cause, 'Could not update the note'));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setError(null);
    setBusy(true);
    try {
      await onDelete(note.id);
    } catch (cause) {
      setConfirming(false);
      setError(failureOf(cause, 'Could not delete the note'));
      setBusy(false);
    }
  }

  return {
    draft,
    editing,
    confirming,
    busy,
    error,
    startEditing,
    cancelEditing,
    changeDraft,
    save,
    remove,
    setConfirming,
  };
}

function EditForm({
  draft,
  busy,
  onChange,
  onSave,
  onCancel,
}: {
  draft: string;
  busy: boolean;
  onChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <>
      <textarea
        autoFocus
        rows={3}
        disabled={busy}
        aria-label="Edit note"
        value={draft}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            onCancel();
          }
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            onSave();
          }
        }}
        className="w-full resize-y rounded-xl border border-line bg-paper p-3 leading-relaxed text-ink focus:border-mark focus:outline-none disabled:opacity-60"
      />

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={onSave}
          className={solidButtonClass}
        >
          Save
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onCancel}
          className={ghostButtonClass}
        >
          Cancel
        </button>
      </div>
    </>
  );
}

function NoteActions({
  busy,
  confirming,
  onEdit,
  onConfirming,
  onDelete,
}: {
  busy: boolean;
  confirming: boolean;
  onEdit: () => void;
  onConfirming: (value: boolean) => void;
  onDelete: () => void;
}) {
  return (
    <>
      <button
        type="button"
        onClick={onEdit}
        aria-label="Edit note"
        className={`${iconButtonClass} hover:text-ink`}
      >
        <PencilIcon />
      </button>

      {confirming ? (
        <button
          type="button"
          disabled={busy}
          aria-label="Confirm delete"
          onBlur={() => onConfirming(false)}
          onClick={onDelete}
          className="inline-flex min-h-10 items-center rounded-full bg-paper px-3 text-xs font-medium text-danger transition-[filter] hover:brightness-125 disabled:cursor-not-allowed disabled:opacity-50"
        >
          confirm?
        </button>
      ) : (
        <button
          type="button"
          onClick={() => onConfirming(true)}
          aria-label="Delete note"
          className={`${iconButtonClass} hover:text-danger`}
        >
          <TrashIcon />
        </button>
      )}
    </>
  );
}

export function NoteCard({ note, onUpdate, onDelete }: NoteCardProps) {
  const editor = useNoteEditor({ note, onUpdate, onDelete });

  return (
    <li className="group rounded-2xl border border-line bg-surface-raised p-5">
      {editor.editing ? (
        <EditForm
          draft={editor.draft}
          busy={editor.busy}
          onChange={editor.changeDraft}
          onSave={() => void editor.save()}
          onCancel={editor.cancelEditing}
        />
      ) : (
        <p className="whitespace-pre-wrap leading-relaxed text-ink">
          {note.content}
        </p>
      )}

      {editor.error ? (
        <p role="alert" className="mt-3 text-sm font-medium text-danger">
          {editor.error}
        </p>
      ) : null}

      <footer className="mt-3 flex flex-wrap items-center gap-2">
        {note.groups.map((group) => (
          <span
            key={group.id}
            className="rounded-full bg-paper px-2.5 py-1 text-xs text-ink-soft"
          >
            @{group.name}
          </span>
        ))}

        <div className="ml-auto flex items-center gap-1">
          <time dateTime={note.createdAt} className="text-xs text-ink-faint">
            {dateFormat.format(new Date(note.createdAt))}
          </time>

          {editor.editing ? null : (
            <NoteActions
              busy={editor.busy}
              confirming={editor.confirming}
              onEdit={editor.startEditing}
              onConfirming={editor.setConfirming}
              onDelete={() => void editor.remove()}
            />
          )}
        </div>
      </footer>
    </li>
  );
}
