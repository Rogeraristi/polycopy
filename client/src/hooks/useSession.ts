import { useCallback, useEffect, useMemo, useState } from 'react';

export interface SessionUser {
  id: string;
  name: string;
  email: string | null;
  avatar: string | null;
  provider: string;
}

interface SessionResponse {
  authenticated?: boolean;
  user?: SessionUser | null;
  error?: string | null;
}

interface UseSessionResult {
  user: SessionUser | null;
  isLoading: boolean;
  isActionPending: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  login: () => void;
  logout: () => Promise<void>;
}

const SESSION_CACHE_KEY = 'polycopy.session.cache.v1';

function extractErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === 'string' && error) {
    return error;
  }
  return fallback;
}

export function useSession(): UseSessionResult {
  const [user, setUser] = useState<SessionUser | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = window.localStorage.getItem(SESSION_CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? (parsed as SessionUser) : null;
    } catch {
      return null;
    }
  });
  const [isLoading, setIsLoading] = useState(() => (typeof window === 'undefined' ? true : !Boolean(user)));
  const [isActionPending, setIsActionPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';
  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/session`, {
        credentials: 'include'
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Session request failed (${response.status})`);
      }
      const payload = (await response.json()) as SessionResponse;
      const nextUser = payload?.user ?? null;
      setUser(nextUser);
      if (typeof window !== 'undefined') {
        if (nextUser) {
          window.localStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(nextUser));
        } else {
          window.localStorage.removeItem(SESSION_CACHE_KEY);
        }
      }
    } catch (refreshError) {
      setUser(null);
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(SESSION_CACHE_KEY);
      }
      setError(extractErrorMessage(refreshError, 'Unable to determine session state right now.'));
    } finally {
      setIsLoading(false);
    }
  }, [API_BASE]);

    const login = useCallback(() => {
      // Always redirect to homepage after login to avoid malformed URLs
      const loginUrl = `${API_BASE}/auth/google?redirect=%2F`;
      window.location.href = loginUrl;
    }, [API_BASE]);

  const logout = useCallback(async () => {
    setIsActionPending(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/logout`, {
        method: 'POST',
        credentials: 'include'
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Logout failed (${response.status})`);
      }
    } catch (logoutError) {
      setError(extractErrorMessage(logoutError, 'We could not log you out. Please try again.'));
    } finally {
      await refresh();
      setIsActionPending(false);
    }
  }, [refresh]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return useMemo(
    () => ({
      user,
      isLoading,
      isActionPending,
      error,
      refresh,
      login,
      logout
    }),
    [user, isLoading, isActionPending, error, refresh, login, logout]
  );
}
