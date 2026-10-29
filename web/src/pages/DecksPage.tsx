import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { listDecks, deleteDeck, type DeckWithCount } from '../api';
import { DeckCard } from '../components/DeckCard';

function useDeckList() {
  const [decks, setDecks] = useState<DeckWithCount[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    listDecks()
      .then((loaded) => {
        if (active) {
          setDecks(loaded);
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(
            cause instanceof Error ? cause.message : 'Could not load the decks',
          );
        }
      });

    return () => {
      active = false;
    };
  }, []);

  return { decks, error, setDecks, setError };
}

function useDecks() {
  const { decks, error, setDecks, setError } = useDeckList();

  async function remove(id: string) {
    try {
      await deleteDeck(id);
      setDecks((current) =>
        current === null ? current : current.filter((deck) => deck.id !== id),
      );
      setError(null);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Could not delete the deck',
      );
    }
  }

  return { decks, error, remove };
}

export function DecksPage() {
  const { decks, error, remove } = useDecks();

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-y-auto rounded-2xl border border-line bg-surface p-5 sm:p-8">
      <h1 className="text-sm font-medium tracking-widest text-ink-faint uppercase">
        decks
      </h1>

      {error ? (
        <p role="alert" className="mt-4 text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}

      {decks === null ? (
        <p role="status" className="mt-4 text-sm text-ink-faint">
          loading decks…
        </p>
      ) : decks.length === 0 ? (
        <p className="mt-4 text-sm text-ink-soft">
          No decks yet.{' '}
          <Link
            to="/app"
            className="text-mark underline-offset-4 hover:underline"
          >
            write a dump
          </Link>{' '}
          to create the first one.
        </p>
      ) : (
        <ul className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {decks.map((deck) => (
            <DeckCard key={deck.id} deck={deck} onDelete={remove} />
          ))}
        </ul>
      )}
    </section>
  );
}
