import { useState, type FormEvent, type ReactNode } from 'react';

const inputClass =
  'mt-2 min-h-11 w-full rounded-xl border border-line bg-paper px-3 text-ink placeholder:text-ink-faint focus:border-mark focus:outline-none disabled:opacity-60';

interface AuthFormProps {
  submitLabel: string;
  passwordAutoComplete: 'current-password' | 'new-password';
  passwordHint?: string;
  footer: ReactNode;
  onSubmit: (email: string, password: string) => Promise<void>;
}

type Submit = (email: string, password: string) => Promise<void>;

function useAuthForm(onSubmit: Submit) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setBusy(true);

    try {
      await onSubmit(email.trim(), password);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  return { email, password, error, busy, setEmail, setPassword, submit };
}

interface AuthFieldsProps {
  email: string;
  password: string;
  busy: boolean;
  passwordAutoComplete: 'current-password' | 'new-password';
  passwordHint?: string;
  error: string | null;
  onEmail: (value: string) => void;
  onPassword: (value: string) => void;
}

function AuthFields({
  email,
  password,
  busy,
  passwordAutoComplete,
  passwordHint,
  error,
  onEmail,
  onPassword,
}: AuthFieldsProps) {
  return (
    <>
      <label htmlFor="email" className="text-sm text-ink-soft">
        Email
      </label>
      <input
        id="email"
        type="email"
        autoComplete="email"
        autoFocus
        required
        disabled={busy}
        value={email}
        onChange={(event) => onEmail(event.target.value)}
        className={inputClass}
      />

      <label htmlFor="password" className="mt-5 block text-sm text-ink-soft">
        Password
      </label>
      <input
        id="password"
        type="password"
        autoComplete={passwordAutoComplete}
        required
        disabled={busy}
        value={password}
        onChange={(event) => onPassword(event.target.value)}
        className={inputClass}
      />

      {passwordHint ? (
        <p className="mt-2 text-xs text-ink-faint">{passwordHint}</p>
      ) : null}

      {error ? (
        <p role="alert" className="mt-4 text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
    </>
  );
}

export function AuthForm({
  submitLabel,
  passwordAutoComplete,
  passwordHint,
  footer,
  onSubmit,
}: AuthFormProps) {
  const form = useAuthForm(onSubmit);

  return (
    <form onSubmit={form.submit}>
      <AuthFields
        email={form.email}
        password={form.password}
        busy={form.busy}
        passwordAutoComplete={passwordAutoComplete}
        passwordHint={passwordHint}
        error={form.error}
        onEmail={form.setEmail}
        onPassword={form.setPassword}
      />

      <button
        type="submit"
        disabled={form.busy}
        className="mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-full bg-mark font-semibold text-mark-contrast transition-[filter] hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitLabel}
      </button>

      <p className="mt-5 text-center text-sm text-ink-faint">{footer}</p>
    </form>
  );
}
