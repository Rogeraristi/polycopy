import { useEffect, useMemo, useRef, useState } from 'react';
import type { LeaderboardEntry } from '../components/Leaderboard';

interface TraderSearchOptions {
  minimumLength?: number;
  debounceMs?: number;
  limit?: number;
}

interface TraderSearchResponse {
  traders?: LeaderboardEntry[];
  error?: string | null;
}

export function useTraderSearch(query: string, options: TraderSearchOptions = {}) {
  const minimumLength = options.minimumLength ?? 2;
  const debounceMs = options.debounceMs ?? 220;
  const limit = options.limit ?? 8;

  const [suggestions, setSuggestions] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceHandle = useRef<number | null>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < minimumLength) {
      if (debounceHandle.current !== null) {
        clearTimeout(debounceHandle.current);
        debounceHandle.current = null;
      }
      setSuggestions([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    if (debounceHandle.current !== null) {
      clearTimeout(debounceHandle.current);
    }

    const controller = new AbortController();
    let isActive = true;

    debounceHandle.current = window.setTimeout(() => {
      const searchParams = new URLSearchParams({
        query: trimmed,
        limit: String(limit)
      });

      const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';
      fetch(`${API_BASE}/trader-search?${searchParams.toString()}`, {
        signal: controller.signal,
        credentials: 'include'
      })
        .then((response) => {
          if (!response.ok) {
            return response.text().then((text) => {
              throw new Error(text || `Search failed (${response.status})`);
            });
          }
          return response.json() as Promise<TraderSearchResponse>;
        })
        .then((payload) => {
          if (!isActive) return;
          const entries = Array.isArray(payload?.traders) ? payload.traders : [];
          setSuggestions(entries);
          setError(payload?.error ?? null);
        })
        .catch((fetchError) => {
          if (!isActive || fetchError?.name === 'AbortError') return;
          const message =
            fetchError instanceof Error ? fetchError.message : 'Unable to fetch trader suggestions right now.';
          setSuggestions([]);
          setError(message);
        })
        .finally(() => {
          if (isActive) {
            setIsLoading(false);
          }
        });
    }, debounceMs);

    return () => {
      isActive = false;
      controller.abort();
      if (debounceHandle.current !== null) {
        clearTimeout(debounceHandle.current);
        debounceHandle.current = null;
      }
    };
  }, [query, minimumLength, debounceMs, limit]);

  return useMemo(
    () => ({
      suggestions,
      isLoading,
      error
    }),
    [suggestions, isLoading, error]
  );
}
