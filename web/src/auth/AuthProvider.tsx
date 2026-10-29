import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  getCurrentUser,
  signIn as apiSignIn,
  signOut as apiSignOut,
  signUp as apiSignUp,
  type User,
} from '../api';
import { AuthContext, type AuthState } from './auth-context';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    getCurrentUser()
      .then((current) => {
        if (active) {
          setUser(current);
        }
      })
      .catch(() => {
        if (active) {
          setUser(null);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const signed = await apiSignIn(email, password);
    setUser(signed);
    return signed;
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const created = await apiSignUp(email, password);
    setUser(created);
    return created;
  }, []);

  const signOut = useCallback(async () => {
    try {
      await apiSignOut();
    } finally {
      setUser(null);
    }
  }, []);

  const value = useMemo<AuthState>(
    () => ({ user, loading, signIn, signUp, signOut }),
    [user, loading, signIn, signUp, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
