import { Link } from 'react-router';

export function Brand() {
  return (
    <Link
      to="/"
      className="flex items-center gap-2 text-lg font-semibold tracking-tight text-ink"
    >
      <span
        aria-hidden="true"
        className="flex h-8 w-8 items-center justify-center rounded-lg bg-mark font-bold text-mark-contrast"
      >
        #
      </span>
      flashnotes
    </Link>
  );
}
