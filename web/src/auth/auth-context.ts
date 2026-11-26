import { createContext, useContext } from 'react';
import type { User } from '../api';

export interface AuthState {
  user: User | null;
  loading: boolean;
  signIn(email: string, password: string): Promise<User>;
  signUp(email: string, password: string): Promise<User>;
  startDemo(): Promise<User>;
  signOut(): Promise<void>;
}

export const AuthContext = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const auth = useContext(AuthContext);
  if (!auth) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return auth;
}

// For pages that also render outside the provider, such as the landing page in
// isolation tests; the demo entry simply stays hidden without a session.
export function useOptionalAuth(): AuthState | null {
  return useContext(AuthContext);
}
