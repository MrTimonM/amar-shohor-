import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Me } from '@amar/shared';
import { api, getToken, setToken } from './api';

interface AuthValue {
  user: Me | null;
  loading: boolean;
  signIn: (token: string, user: Me) => void;
  signOut: () => void;
  refresh: () => Promise<void>;
  /** Convenience for the nav, which shows different sections per role. */
  isStaff: boolean;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Me | null>(null);
  const [loading, setLoading] = useState(Boolean(getToken()));

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      setUser(await api.me());
    } catch {
      // A stale token is cleared by the api layer; browsing stays anonymous.
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<AuthValue>(
    () => ({
      user,
      loading,
      signIn: (token, next) => {
        setToken(token);
        setUser(next);
      },
      signOut: () => {
        setToken(null);
        setUser(null);
      },
      refresh,
      isStaff: user?.role === 'authority' || user?.role === 'admin',
    }),
    [user, loading, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
