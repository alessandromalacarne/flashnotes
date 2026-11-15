import { MIN_PASSWORD_LENGTH } from '@flashnotes/core';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../auth/auth-context';
import { AuthForm } from '../components/AuthForm';
import { AuthShell } from '../components/AuthShell';

export function SignUpPage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();

  return (
    <AuthShell
      title="Create your flashnotes"
      subtitle="One account, one place for every loose thought."
    >
      <AuthForm
        submitLabel="Create account"
        passwordAutoComplete="new-password"
        passwordHint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
        onSubmit={async (email, password) => {
          if (password.length < MIN_PASSWORD_LENGTH) {
            throw new Error(`Use at least ${MIN_PASSWORD_LENGTH} characters`);
          }

          await signUp(email, password);
          navigate('/app', { replace: true });
        }}
        footer={
          <>
            Already have an account?{' '}
            <Link
              to="/login"
              className="text-mark underline-offset-4 hover:underline"
            >
              sign in
            </Link>
          </>
        }
      />
    </AuthShell>
  );
}
