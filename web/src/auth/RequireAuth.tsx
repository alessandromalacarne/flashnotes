import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useAuth } from './auth-context';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <p role="status" className="p-6 text-sm text-ink-faint">
        loading…
      </p>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
