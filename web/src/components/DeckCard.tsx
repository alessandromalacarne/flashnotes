import { Link } from 'react-router';
import type { DeckWithCount } from '../api';

interface DeckCardProps {
  deck: DeckWithCount;
  onDelete: (id: string) => void;
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

export function DeckCard({ deck, onDelete }: DeckCardProps) {
  const dumps = deck.count === 1 ? '1 dump' : `${deck.count} dumps`;

  return (
    <li
      aria-label={`@${deck.name} (${dumps})`}
      className="group flex w-40 flex-col items-center justify-self-center gap-3 rounded-2xl border border-transparent p-4 transition-colors hover:bg-surface-raised focus-within:bg-surface-raised"
    >
      <Link
        to={`/app/deck/${encodeURIComponent(deck.name)}`}
        className="flex flex-col items-center gap-3 rounded-xl"
      >
        <p className="flex flex-col items-center">
          <span className="font-medium text-ink">@{deck.name}</span>
          <span className="text-xs text-ink-faint">{dumps}</span>
        </p>

        <span
          aria-hidden="true"
          className="relative block h-20 w-28 transition-transform duration-200 group-hover:scale-105"
        >
          <span className="absolute top-0 left-0 block h-12 w-20 -rotate-10 rounded-lg border border-note-edge/60 bg-note-soft" />
          <span className="absolute top-2 left-3 block h-12 w-20 -rotate-2 rounded-lg border border-note-edge/60 bg-note-soft" />
          <span className="absolute top-4 left-6 block h-12 w-20 rotate-8 rounded-lg border border-note-edge bg-note shadow-[0_4px_10px_oklch(0_0_0/0.4)]" />
        </span>
      </Link>

      <button
        type="button"
        onClick={() => onDelete(deck.id)}
        aria-label={`Delete deck @${deck.name}`}
        className="flex h-10 w-10 items-center justify-center rounded-full text-ink-faint opacity-0 transition-[color,opacity,background-color] hover:bg-paper hover:text-danger focus-visible:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100"
      >
        <TrashIcon />
      </button>
    </li>
  );
}
