import { useEffect, useMemo, useState } from 'react';
import type { LeaderboardEntry } from './Leaderboard';

interface TraderSearchProps {
  value: string;
  onChange: (nextValue: string) => void;
  onSubmit: (nextValue: string) => void;
  suggestions: LeaderboardEntry[];
  selectedAddress?: string | null;
  isSearching?: boolean;
  searchError?: string | null;
}

type RenderableSuggestion = LeaderboardEntry;

function formatUsd(value: number | null) {
  if (value === null) return '—';
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) {
    return `${value < 0 ? '-' : ''}$${(abs / 1_000_000_000).toFixed(1)}B`;
  }
  if (abs >= 1_000_000) {
    return `${value < 0 ? '-' : ''}$${(abs / 1_000_000).toFixed(1)}M`;
  }
  if (abs >= 1_000) {
    return `${value < 0 ? '-' : ''}$${(abs / 1_000).toFixed(1)}K`;
  }
  return `${value < 0 ? '-' : ''}$${abs.toFixed(0)}`;
}

export function TraderSearch({
  value,
  onChange: onValueChange,
  onSubmit,
  suggestions,
  selectedAddress = null,
  isSearching = false,
  searchError = null
}: TraderSearchProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null);

  const filteredSuggestions = useMemo<RenderableSuggestion[]>(() => {
    const normalizedQuery = value.trim().toLowerCase();
    if (normalizedQuery.length < 2) {
      return [];
    }

    const base = Array.isArray(suggestions) ? suggestions : [];
    const unique = new Map<string, RenderableSuggestion>();

    base.forEach((entry) => {
      if (!entry || typeof entry.address !== 'string') {
        return;
      }
      const addressKey = entry.address.toLowerCase();
      if (unique.has(addressKey)) {
        return;
      }

      const displayValue = entry.displayName?.toLowerCase?.() ?? '';
      const usernameValue = entry.username?.toLowerCase?.() ?? '';
      const pseudonymValue = entry.pseudonym?.toLowerCase?.() ?? '';

      const matchesQuery =
        displayValue.includes(normalizedQuery) ||
        usernameValue.includes(normalizedQuery) ||
        pseudonymValue.includes(normalizedQuery) ||
        addressKey.includes(normalizedQuery);

      if (matchesQuery) {
        unique.set(addressKey, entry);
      }
    });

    return Array.from(unique.values()).slice(0, 12);
  }, [suggestions, value]);

  useEffect(() => {
    setHighlightedIndex(null);
  }, [value, filteredSuggestions.length]);

  const selectSuggestion = (entry: RenderableSuggestion) => {
    onValueChange(entry.address);
    onSubmit(entry.address);
    setIsFocused(false);
    setHighlightedIndex(null);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(event.key)) {
      return;
    }

    if (event.key === 'Escape') {
      setIsFocused(false);
      setHighlightedIndex(null);
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      if (highlightedIndex !== null && filteredSuggestions[highlightedIndex]) {
        selectSuggestion(filteredSuggestions[highlightedIndex]);
        return;
      }
      onSubmit(value);
      setIsFocused(false);
      return;
    }

    event.preventDefault();
    if (!filteredSuggestions.length) {
      return;
    }

    setIsFocused(true);
    setHighlightedIndex((previous) => {
      if (previous === null) {
        return event.key === 'ArrowDown' ? 0 : filteredSuggestions.length - 1;
      }
      if (event.key === 'ArrowDown') {
        return (previous + 1) % filteredSuggestions.length;
      }
      if (event.key === 'ArrowUp') {
        return (previous - 1 + filteredSuggestions.length) % filteredSuggestions.length;
      }
      return previous;
    });
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (highlightedIndex !== null && filteredSuggestions[highlightedIndex]) {
      selectSuggestion(filteredSuggestions[highlightedIndex]);
      return;
    }
    onSubmit(value);
    setIsFocused(false);
  };

  const trimmedValue = value.trim();
  const hasQuery = trimmedValue.length >= 2;
  const showSuggestions = isFocused && hasQuery;

  return (
    <form onSubmit={handleSubmit} className="relative z-[200] group flex flex-col gap-3">
      <div className="relative flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
        <div className="relative flex-1">
          <input
            type="text"
            value={value}
            onChange={(event) => {
              const nextValue = event.target.value;
              onValueChange(nextValue);
              if (!isFocused) {
                setIsFocused(true);
              }
            }}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setTimeout(() => setIsFocused(false), 120)}
            onKeyDown={handleKeyDown}
            placeholder="Search by wallet or username"
            className="w-full rounded-2xl border border-[#2b4068] bg-[#0c1730cc] px-5 py-4 text-base text-[#e5efff] placeholder:text-[#6f88b2] focus:border-[#21c4c4] focus:outline-none focus:ring-4 focus:ring-[#21c4c444]"
          />
          {showSuggestions && (
            <div className="absolute left-0 right-0 top-full z-[210] mt-2 overflow-hidden rounded-2xl border border-[#2b4068] bg-[#0b152ae8] shadow-xl shadow-slate-950/40 backdrop-blur">
              {filteredSuggestions.length > 0 ? (
                <>
                  <ul className="divide-y divide-[#26395f]">
                    {filteredSuggestions.map((entry, index) => {
                      const isHighlighted = index === highlightedIndex;
                      const isSelected = selectedAddress ? entry.address === selectedAddress : false;
                      const normalizedDisplay = (entry.displayName || entry.address).toLowerCase();
                      const rankLabel = Number.isFinite(Number(entry.rank)) ? Number(entry.rank) : null;
                      const usernameLabel =
                        entry.username &&
                        entry.username.toLowerCase() !== normalizedDisplay
                          ? entry.username
                          : null;
                      const pseudonymLabel =
                        entry.pseudonym &&
                        entry.pseudonym.toLowerCase() !== normalizedDisplay &&
                        (!usernameLabel || entry.pseudonym.toLowerCase() !== usernameLabel.toLowerCase())
                          ? entry.pseudonym
                          : null;
                      return (
                        <li key={entry.address}>
                          <button
                            type="button"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => selectSuggestion(entry)}
                            className={`flex w-full flex-col gap-1 px-4 py-3 text-left transition ${
                              isHighlighted
                                ? 'bg-[#18345e] text-white'
                                : isSelected
                                ? 'bg-[#13223d] text-white'
                                : 'bg-transparent text-[#d8e6ff] hover:bg-[#15233f]'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-3">
                                {entry.avatarUrl && (
                                  <span className="inline-flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-slate-800 bg-slate-900">
                                    <img
                                      src={entry.avatarUrl}
                                      alt={`${entry.displayName} avatar`}
                                      className="h-full w-full object-cover"
                                      loading="lazy"
                                    />
                                  </span>
                                )}
                                <div className="flex flex-col">
                                  <span className="text-sm font-medium text-[#e5efff]">{entry.displayName}</span>
                                  {usernameLabel && (
                                    <span className="text-xs text-[#8fa5cb]">@{usernameLabel}</span>
                                  )}
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-1 text-right">
                                {rankLabel !== null && (
                                  <span className="text-xs uppercase tracking-wide text-[#8fa5cb]">#{rankLabel}</span>
                                )}
                                <span
                                  className={`text-xs font-semibold ${
                                    entry.pnl === null
                                      ? 'text-slate-400'
                                      
                                      : entry.pnl >= 0
                                      ? 'text-emerald-300'
                                      : 'text-rose-300'
                                  }`}
                                >
                                  {formatUsd(entry.pnl)}
                                </span>
                              </div>
                            </div>
                            <div className="flex flex-col gap-0.5">
                              {pseudonymLabel && (
                                <span className="text-xs text-[#8fa5cb]">AKA {pseudonymLabel}</span>
                              )}
                              <span className="text-xs text-[#6f88b2] break-all">{entry.address}</span>
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  {searchError && (
                    <div className="border-t border-[#26395f] px-4 py-2 text-xs text-rose-300">
                      Trader lookup is temporarily unavailable.
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-1 px-4 py-3 text-sm text-[#8fa5cb]">
                  <p>
                    {isSearching
                      ? 'Searching traders…'
                      : searchError
                      ? 'Trader lookup is temporarily unavailable.'
                      : 'No users found.'}
                  </p>
                  {searchError && (
                    <p className="text-xs text-rose-300">
                      Try again in a few moments or paste a wallet address directly.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        <button
          type="submit"
          className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-[#21c4c4] to-[#0dd3a8] px-6 py-4 text-sm font-semibold text-[#032021] shadow-lg shadow-[#21c4c444] transition hover:brightness-105"
        >
          Track trader
        </button>
      </div>
      <p className="text-sm text-[#8fa5cb]">Paste a Polymarket wallet or start typing to search for traders.</p>
    </form>
  );
}
