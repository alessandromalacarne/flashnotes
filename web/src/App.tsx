import { useCallback } from 'react';
import { NavLink, Route, Routes, useLocation } from 'react-router';
import { createDump } from './api';
import { Composer } from './components/Composer';
import { DecksPage } from './pages/DecksPage';
import { DeckDumpsPage } from './pages/DeckDumpsPage';

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  isActive ? 'text-ink' : 'text-ink-faint transition-colors hover:text-ink';

function App() {
  const handleSubmit = useCallback(async (content: string) => {
    await createDump(content);
  }, []);

  const { pathname } = useLocation();
  const onDeckArea = pathname === '/decks' || pathname.startsWith('/deck/');

  return (
    <div className="flex h-dvh flex-col p-3 sm:p-5">
      <nav
        aria-label="Main"
        className="flex shrink-0 items-center justify-end gap-4 pb-2 text-sm"
      >
        <NavLink to="/" end className={navLinkClass}>
          dump
        </NavLink>
        <NavLink
          to="/decks"
          className={() => navLinkClass({ isActive: onDeckArea })}
        >
          decks
        </NavLink>
      </nav>

      <main className="flex min-h-0 flex-1 flex-col">
        <Routes>
          <Route
            path="/"
            element={
              <>
                <h1 className="sr-only">quickdump</h1>
                <Composer onSubmit={handleSubmit} />
              </>
            }
          />
          <Route path="/decks" element={<DecksPage />} />
          <Route path="/deck/:deck" element={<DeckDumpsPage />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
