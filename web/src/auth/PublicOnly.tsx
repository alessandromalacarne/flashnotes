import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useAuth } from './auth-context';
import { returnTo } from './return-to';

export function PublicOnly({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <p role="status" className="p-6 text-sm text-ink-faint">
        loading…
      </p>
    );
  }

  if (user) {
    return <Navigate to={returnTo(location.state)} replace />;
  }

  return <>{children}</>;
}
