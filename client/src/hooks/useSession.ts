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
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
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
      setUser(payload?.user ?? null);
    } catch (refreshError) {
      setUser(null);
      setError(extractErrorMessage(refreshError, 'Unable to determine session state right now.'));
    } finally {
      setIsLoading(false);
    }
  }, []);

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
