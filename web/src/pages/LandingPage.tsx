import { useCallback, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { useOptionalAuth } from '../auth/auth-context';
import { Brand } from '../components/Brand';
import { Composer } from '../components/Composer';
import { TryDemoButton } from '../components/TryDemoButton';
import { createNote } from '../local/store';

const primaryLinkClass =
  'inline-flex min-h-12 items-center justify-center rounded-full bg-mark px-7 font-semibold text-mark-contrast transition-[filter] hover:brightness-95';

const ghostLinkClass =
  'inline-flex min-h-12 items-center justify-center rounded-full border border-line px-7 text-ink-soft transition-colors hover:border-ink-faint hover:text-ink';

function LandingHeader() {
  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-6 sm:px-8">
      <Brand />
    </header>
  );
}

function LocalComposer() {
  const submit = useCallback(async (content: string) => {
    await createNote(content);
  }, []);

  return (
    <section
      id="composer"
      aria-label="Try flashnotes"
      className="mx-auto w-full max-w-4xl"
    >
      <div className="h-64 sm:h-72">
        <Composer onSubmit={submit} />
      </div>
      <p className="mt-3 text-center text-xs text-ink-faint">
        Saved on this device. Server sync is not available yet.{' '}
        <Link
          to="/app/groups"
          className="text-mark underline-offset-4 hover:underline"
        >
          browse your groups
        </Link>
      </p>
    </section>
  );
}

function Hero({ demoEntry }: { demoEntry?: ReactNode }) {
  return (
    <section>
      <p className="text-xs font-medium tracking-[0.2em] text-mark uppercase">
        notes · groups · zero friction
      </p>
      <h1 className="mt-5 text-4xl leading-[1.05] font-semibold tracking-tight text-ink sm:text-6xl">
        Capture thoughts in seconds.
        <span className="mt-2 block text-ink-soft">
          Retrieve them by group later.
        </span>
      </h1>
      <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-soft">
        flashnotes is a tiny inbox for your brain. Type a thought, end it with a{' '}
        <code className="text-mark">@group</code>, hit Shift+Enter. Find it
        later without sorting a single folder.
      </p>

      <div className="mt-9 flex flex-wrap items-center gap-3">
        <Link to="/signup" className={primaryLinkClass}>
          create an account
        </Link>
        <Link to="/login" className={ghostLinkClass}>
          sign in
        </Link>
        {demoEntry}
      </div>

      <p className="mt-4 text-sm text-ink-faint">
        No folders. No titles. No save button.
      </p>
    </section>
  );
}

function FeatureCard({ title, children }: { title: string; children: string }) {
  return (
    <li className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
      <h3 className="font-medium text-ink">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-ink-soft">{children}</p>
    </li>
  );
}

function FeatureGrid() {
  return (
    <ul className="mt-20 grid gap-3 sm:grid-cols-3">
      <FeatureCard title="Type. Shift+Enter. Done.">
        The composer is the whole app. One field, one shortcut, and the thought
        is out of your head.
      </FeatureCard>
      <FeatureCard title="Groups, not folders">
        End a note with @home or @work. One thought can land in more than one
        group at once.
      </FeatureCard>
      <FeatureCard title="Plain text that lasts">
        Bodies are stored without the markers. Export a group when you are ready
        to turn notes into writing.
      </FeatureCard>
    </ul>
  );
}

function LandingFooter() {
  return (
    <footer className="border-t border-line/70">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-3 px-5 py-6 text-xs text-ink-faint sm:px-8">
        <p>flashnotes — capture now, sort later.</p>
        <p className="ml-auto">built for people who think in fragments.</p>
      </div>
    </footer>
  );
}

export function LandingPage() {
  const auth = useOptionalAuth();
  const navigate = useNavigate();
  const canTryDemo = auth !== null && !auth.loading && auth.user === null;

  return (
    <div className="relative flex min-h-dvh flex-col">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[42rem] bg-[radial-gradient(ellipse_at_top,oklch(0.8_0.14_75/0.1),transparent_65%)]"
      />

      <LandingHeader />

      <main className="mx-auto w-full max-w-6xl flex-1 px-5 pt-5 pb-20 sm:px-8 sm:pt-8">
        <LocalComposer />

        <section className="mt-20">
          <Hero
            demoEntry={
              canTryDemo ? (
                <TryDemoButton
                  onEntered={() => navigate('/app', { replace: true })}
                />
              ) : null
            }
          />
        </section>

        <FeatureGrid />
      </main>

      <LandingFooter />
    </div>
  );
}
