import type { ReactNode } from 'react';
import { Brand } from '../components/Brand';

interface AuthShellProps {
  title: string;
  subtitle: string;
  children: ReactNode;
}

export function AuthShell({ title, subtitle, children }: AuthShellProps) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="px-5 py-6 sm:px-8">
        <Brand />
      </header>

      <main className="flex flex-1 items-start justify-center px-5 pt-6 pb-20 sm:items-center sm:pt-0">
        <section className="w-full max-w-sm">
          <h1 className="text-3xl font-semibold tracking-tight text-ink">
            {title}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            {subtitle}
          </p>

          <div className="mt-8 rounded-2xl border border-line bg-surface p-6 shadow-[0_24px_80px_oklch(0_0_0/0.35)]">
            {children}
          </div>
        </section>
      </main>
    </div>
  );
}
