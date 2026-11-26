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
  startDemo as apiStartDemo,
  type User,
} from '../api';
import { AuthContext, type AuthState } from './auth-context';
import { clearDemoData, prepareDemoData, setLocalUser } from '../local/store';

function useCurrentUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    getCurrentUser()
      .then((current) => {
        if (active) {
          setUser(current);
          setLocalUser(current?.id ?? null);
        }
      })
      .catch(() => {
        if (active) {
          setUser(null);
          setLocalUser(null);
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

  return { user, setUser, loading };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { user, setUser, loading } = useCurrentUser();

  const signIn = useCallback(async (email: string, password: string) => {
    const signed = await apiSignIn(email, password);
    setLocalUser(signed.id);
    setUser(signed);
    return signed;
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const created = await apiSignUp(email, password);
    setLocalUser(created.id);
    setUser(created);
    return created;
  }, []);

  const startDemo = useCallback(async () => {
    const demo = await apiStartDemo();
    setLocalUser(demo.id);
    await prepareDemoData(demo.id);
    setUser(demo);
    return demo;
  }, []);

  const signOut = useCallback(async () => {
    try {
      if (user?.isDemo) {
        await clearDemoData(user.id);
      }
      await apiSignOut();
    } finally {
      setLocalUser(null);
      setUser(null);
    }
  }, [user]);

  const value = useMemo<AuthState>(
    () => ({ user, loading, signIn, signUp, startDemo, signOut }),
    [user, loading, signIn, signUp, startDemo, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
