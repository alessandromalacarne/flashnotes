import { Link } from 'react-router';
import { Brand } from '../components/Brand';

const primaryLinkClass =
  'inline-flex min-h-12 items-center justify-center rounded-full bg-mark px-7 font-semibold text-mark-contrast transition-[filter] hover:brightness-95';

const ghostLinkClass =
  'inline-flex min-h-12 items-center justify-center rounded-full border border-line px-7 text-ink-soft transition-colors hover:border-ink-faint hover:text-ink';

function DumpPreview() {
  return (
    <div
      aria-hidden="true"
      className="rounded-2xl border border-line bg-surface p-5 shadow-[0_24px_80px_oklch(0_0_0/0.45)] sm:p-6"
    >
      <div className="flex items-center justify-between text-xs text-ink-faint">
        <span>new dump</span>
        <span className="rounded-full border border-line px-2 py-1">
          autosaved
        </span>
      </div>

      <p className="mt-6 min-h-24 text-lg leading-relaxed text-ink">
        plan the launch
        <br />
        call the dentist
        <br />
        <span className="text-ink-soft">buy coffee</span>
        <span className="text-mark"> @casa @errands</span>
      </p>

      <div className="mt-6 flex items-center gap-2 border-t border-line pt-4 text-sm text-ink-faint">
        <span>Enter sends</span>
        <span className="ml-auto rounded-full bg-mark px-5 py-2 font-semibold text-mark-contrast">
          Dump
        </span>
      </div>
    </div>
  );
}

function LandingHeader() {
  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-6 sm:px-8">
      <Brand />
      <nav aria-label="Account">
        <Link
          to="/login"
          className="inline-flex min-h-11 items-center rounded-full px-4 text-sm text-ink-soft transition-colors hover:text-ink"
        >
          sign in
        </Link>
      </nav>
    </header>
  );
}

function Hero() {
  return (
    <section>
      <p className="text-xs font-medium tracking-[0.2em] text-mark uppercase">
        notes · decks · zero friction
      </p>
      <h1 className="mt-5 text-4xl leading-[1.05] font-semibold tracking-tight text-ink sm:text-6xl">
        Capture thoughts in seconds.
        <span className="mt-2 block text-ink-soft">
          Retrieve them by deck later.
        </span>
      </h1>
      <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-soft">
        quickdump is a tiny inbox for your brain. Type a thought, end it with a{' '}
        <code className="text-mark">@deck</code>, hit Enter. Find it later
        without sorting a single folder.
      </p>

      <div className="mt-9 flex flex-wrap items-center gap-3">
        <Link to="/signup" className={primaryLinkClass}>
          start dumping
        </Link>
        <Link to="/login" className={ghostLinkClass}>
          I have an account
        </Link>
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
      <FeatureCard title="Type. Enter. Done.">
        The composer is the whole app. One field, one keystroke, and the thought
        is out of your head.
      </FeatureCard>
      <FeatureCard title="Decks, not folders">
        End a dump with @casa or @trabalho. One thought can land in more than
        one deck at once.
      </FeatureCard>
      <FeatureCard title="Plain text that lasts">
        Bodies are stored without the markers. Export a deck when you are ready
        to turn notes into writing.
      </FeatureCard>
    </ul>
  );
}

function LandingFooter() {
  return (
    <footer className="border-t border-line/70">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-3 px-5 py-6 text-xs text-ink-faint sm:px-8">
        <p>quickdump — capture now, sort later.</p>
        <p className="ml-auto">built for people who think in fragments.</p>
      </div>
    </footer>
  );
}

export function LandingPage() {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[42rem] bg-[radial-gradient(ellipse_at_top,oklch(0.8_0.14_75/0.1),transparent_65%)]"
      />

      <LandingHeader />

      <main className="mx-auto w-full max-w-6xl flex-1 px-5 pt-10 pb-20 sm:px-8 sm:pt-16">
        <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
          <Hero />
          <DumpPreview />
        </div>

        <FeatureGrid />
      </main>

      <LandingFooter />
    </div>
  );
}
