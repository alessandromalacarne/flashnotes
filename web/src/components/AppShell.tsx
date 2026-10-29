import { NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { useAuth } from '../auth/auth-context';

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  isActive ? 'text-ink' : 'text-ink-faint transition-colors hover:text-ink';

export function AppShell() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const onDeckArea =
    pathname === '/app/decks' || pathname.startsWith('/app/deck/');

  async function handleSignOut() {
    await signOut().catch(() => undefined);
    navigate('/login', { replace: true });
  }

  return (
    <div className="flex h-dvh flex-col p-3 sm:p-5">
      <nav
        aria-label="Main"
        className="flex shrink-0 items-center gap-4 pb-2 text-sm"
      >
        <span className="mr-auto truncate text-xs text-ink-faint">
          {user?.email}
        </span>
        <NavLink to="/app" end className={navLinkClass}>
          dump
        </NavLink>
        <NavLink
          to="/app/decks"
          className={() => navLinkClass({ isActive: onDeckArea })}
        >
          decks
        </NavLink>
        <button
          type="button"
          onClick={() => void handleSignOut()}
          className="text-ink-faint transition-colors hover:text-ink"
        >
          sign out
        </button>
      </nav>

      <main className="flex min-h-0 flex-1 flex-col">
        <Outlet />
      </main>
    </div>
  );
}
