import { Link, useLocation, useNavigate } from 'react-router';
import { useAuth } from '../auth/auth-context';
import { returnTo } from '../auth/return-to';
import { AuthForm } from '../components/AuthForm';
import { AuthShell } from '../components/AuthShell';

export function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = returnTo(location.state);

  return (
    <AuthShell
      title="Sign in to flashnotes"
      subtitle="Your notes are one keystroke away."
    >
      <AuthForm
        submitLabel="Sign in"
        passwordAutoComplete="current-password"
        onSubmit={async (email, password) => {
          await signIn(email, password);
          navigate(from, { replace: true });
        }}
        footer={
          <>
            New here?{' '}
            <Link
              to="/signup"
              className="text-mark underline-offset-4 hover:underline"
            >
              create an account
            </Link>
          </>
        }
      />
    </AuthShell>
  );
}
