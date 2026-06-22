'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Permission } from '@komuta/shared';
import { apiFetch, apiPublic, getToken, setToken } from './api';
import type { AuthUser, LoginResponse } from './types';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  can: (permission: Permission) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // On mount, try to restore the session. If we have a token, validate via
  // /auth/me; otherwise attempt a refresh using the httpOnly cookie.
  useEffect(() => {
    let cancelled = false;
    async function bootstrap() {
      try {
        if (getToken()) {
          const me = await apiFetch<AuthUser>('/auth/me', { redirectOn401: false });
          if (!cancelled) setUser(me);
          return;
        }
        // No access token in memory/storage — try the refresh cookie.
        const refreshed = await apiPublic<{ accessToken: string }>('/auth/refresh', {}, {
          credentials: 'include',
        }).catch(() => null);
        if (refreshed?.accessToken) {
          setToken(refreshed.accessToken);
          const me = await apiFetch<AuthUser>('/auth/me', { redirectOn401: false });
          if (!cancelled) setUser(me);
        }
      } catch {
        if (!cancelled) {
          setToken(null);
          setUser(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiPublic<LoginResponse>('/auth/login', { email, password }, {
      credentials: 'include',
    });
    setToken(res.accessToken);
    setUser(res.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiFetch('/auth/logout', { method: 'POST', redirectOn401: false });
    } catch {
      /* ignore */
    }
    setToken(null);
    setUser(null);
    router.push('/login');
  }, [router]);

  const can = useCallback(
    (permission: Permission) => !!user && user.permissions.includes(permission),
    [user],
  );

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, login, logout, can }),
    [user, loading, login, logout, can],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
