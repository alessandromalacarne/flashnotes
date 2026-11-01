import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { Link, useParams } from 'react-router';
import {
  createNote,
  deleteNote,
  listNotes,
  updateNote,
  type Note,
} from '../api';
import { Composer } from '../components/Composer';
import { NoteCard } from '../components/NoteCard';

function useGroupNotes(group: string) {
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    listNotes(group)
      .then((loaded) => {
        if (active) {
          setNotes(loaded);
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(
            cause instanceof Error ? cause.message : 'Could not load the notes',
          );
        }
      });

    return () => {
      active = false;
    };
  }, [group]);

  return { notes, error, setNotes };
}

function carriesGroup(note: Note, group: string): boolean {
  return note.groups.some((groupEntry) => groupEntry.name === group);
}

function useNoteActions(
  group: string,
  setNotes: Dispatch<SetStateAction<Note[] | null>>,
) {
  const target = group.toLowerCase();

  async function create(content: string) {
    const created = await createNote(content);

    if (carriesGroup(created, target)) {
      setNotes((current) =>
        current === null ? current : [created, ...current],
      );
    }
  }

  async function update(id: string, content: string) {
    const updated = await updateNote(id, content);

    setNotes((current) => {
      if (current === null) {
        return current;
      }
      if (!carriesGroup(updated, target)) {
        return current.filter((note) => note.id !== id);
      }

      return current.map((note) => (note.id === id ? updated : note));
    });
  }

  async function remove(id: string) {
    await deleteNote(id);
    setNotes((current) =>
      current === null ? current : current.filter((note) => note.id !== id),
    );
  }

  return { create, update, remove };
}

export function GroupNotesPage() {
  const { group = '' } = useParams();
  const { notes, error, setNotes } = useGroupNotes(group);
  const { create, update, remove } = useNoteActions(group, setNotes);
  const countLabel =
    notes === null
      ? null
      : notes.length === 1
        ? '1 note'
        : `${notes.length} notes`;

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-y-auto rounded-2xl border border-line bg-surface p-5 sm:p-8">
      <header className="flex shrink-0 items-baseline gap-3">
        <h1 className="text-sm font-medium tracking-widest text-ink-faint uppercase">
          @{group}
        </h1>
        {countLabel === null ? null : (
          <p className="text-xs text-ink-faint">{countLabel}</p>
        )}
      </header>

      <div className="mt-6 h-44 shrink-0">
        <Composer onSubmit={create} />
      </div>

      {error ? (
        <p role="alert" className="mt-4 text-sm font-medium text-danger">
          {error}
        </p>
      ) : notes === null ? (
        <p role="status" className="mt-4 text-sm text-ink-faint">
          loading notes…
        </p>
      ) : notes.length === 0 ? (
        <p className="mt-4 text-sm text-ink-soft">
          No notes with @{group} yet.{' '}
          <Link
            to="/app"
            className="text-mark underline-offset-4 hover:underline"
          >
            write a note
          </Link>{' '}
          to add the first one.
        </p>
      ) : (
        <ul className="mt-6 grid list-none gap-3">
          {notes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              onUpdate={update}
              onDelete={remove}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
