import { useMemo, useState } from 'react';
import GlassPanel from './effects/GlassPanel';

export interface LeaderboardEntry {
  address: string;
  displayName: string;
  rank: number;
  roi: number | null;
  pnl: number | null;
  volume: number | null;
  trades: number | null;
  avatarUrl?: string | null;
  username?: string | null;
  pseudonym?: string | null;
  displayUsernamePublic?: boolean | null;
}

interface LeaderboardProps {
  entries: LeaderboardEntry[];
  onSelect: (address: string, entry?: LeaderboardEntry) => void;
  onPrefetch?: (address: string, entry?: LeaderboardEntry) => void;
  selectedAddress: string | null;
  isLoading?: boolean;
  error?: string | null;
  periodOptions?: { key: string; label: string }[];
  selectedPeriod?: string | null;
  onPeriodChange?: (key: string) => void;
}

function formatPercent(value: number | null) {
  if (value === null) return '—';
  const capped = Math.abs(value) >= 1000 ? Math.round(value) : Math.round(value * 10) / 10;
  const display = Math.abs(value) >= 1000 ? `${capped}%` : `${capped.toFixed(1)}%`;
  return `${value > 0 ? '+' : ''}${display}`;
}

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

function formatNumber(value: number | null) {
  if (value === null) return '—';
  return value.toLocaleString();
}

function getTrophy(rank: number) {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return '🏅';
}

function getAvatar(entry: LeaderboardEntry) {
  if (entry.avatarUrl) return entry.avatarUrl;
  const address = entry.address || '';
  const color = `hsl(${address.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360}, 70%, 55%)`;
  const initials = address.slice(2, 4).toUpperCase();
  const svg = `<svg width='64' height='64' xmlns='http://www.w3.org/2000/svg'>
    <circle cx='32' cy='32' r='30' fill='${color}' stroke='white' stroke-width='4'/>
    <text x='50%' y='54%' text-anchor='middle' font-size='28' font-family='Inter,Arial,sans-serif' font-weight='bold' fill='#fff' dy='.3em'>${initials}</text>
  </svg>`;
  return `data:image/svg+xml;base64,${btoa(svg.replace(/\n\s+/g, ''))}`;
}

function getPolymarketProfileUrl(entry: LeaderboardEntry) {
  const handle =
    (typeof entry.username === 'string' && entry.username.trim()) ||
    (typeof entry.pseudonym === 'string' && entry.pseudonym.trim()) ||
    null;
  if (!handle) return null;
  return `https://polymarket.com/@${encodeURIComponent(handle.replace(/^@+/, ''))}`;
}

function PodiumCard({
  entry,
  onSelect,
  onPrefetch,
  emphasized = false,
  compact = false
}: {
  entry: LeaderboardEntry;
  onSelect: (address: string, entry?: LeaderboardEntry) => void;
  onPrefetch?: (address: string) => void;
  emphasized?: boolean;
  compact?: boolean;
}) {
  // Podium color logic
  let border = 'border-slate-700/70';
  let bg = 'bg-slate-900/80';
  let shadow = '';
  let trophy = getTrophy(entry.rank);
  let rankColor = 'text-slate-300';
  let trophyBg = '';
  if (entry.rank === 1) {
    border = 'border-yellow-400/80';
    bg = 'bg-gradient-to-b from-yellow-200/60 via-yellow-100/40 to-yellow-900/10';
    shadow = 'shadow-xl shadow-yellow-400/40';
    trophy = '🥇';
    rankColor = 'text-yellow-400';
    trophyBg = 'bg-[radial-gradient(circle,_rgba(255,215,0,0.18)_0%,_rgba(255,215,0,0)_70%)]';
  } else if (entry.rank === 2) {
    border = 'border-gray-300/80';
    bg = 'bg-gradient-to-b from-gray-200/60 via-gray-100/40 to-gray-900/10';
    shadow = 'shadow-xl shadow-gray-300/40';
    trophy = '🥈';
    rankColor = 'text-gray-300';
    trophyBg = 'bg-[radial-gradient(circle,_rgba(192,192,192,0.18)_0%,_rgba(192,192,192,0)_70%)]';
  } else if (entry.rank === 3) {
    border = 'border-amber-700/80';
    bg = 'bg-gradient-to-b from-amber-300/60 via-amber-100/40 to-amber-900/10';
    shadow = 'shadow-xl shadow-amber-700/40';
    trophy = '🥉';
    rankColor = 'text-amber-400';
    trophyBg = 'bg-[radial-gradient(circle,_rgba(205,127,50,0.18)_0%,_rgba(205,127,50,0)_70%)]';
  }
  return (
    <button
      type="button"
      onClick={() => onSelect(entry.address, entry)}
      onMouseEnter={() => onPrefetch?.(entry.address)}
      onFocus={() => onPrefetch?.(entry.address)}
      className={`relative w-full rounded-2xl border p-4 text-left transition ${border} ${bg} ${shadow} overflow-hidden`}
    >
      {/* Large faded trophy background */}
      {(entry.rank === 1 || entry.rank === 2 || entry.rank === 3) && (
        <span
          aria-hidden
          className={`pointer-events-none absolute left-1/2 top-1/2 -z-10 -translate-x-1/2 -translate-y-1/2 select-none text-[7rem] opacity-20 ${trophyBg}`}
        >
          {trophy}
        </span>
      )}
      <div className="flex items-center justify-between">
        <span className={`${emphasized ? 'text-3xl' : 'text-2xl'}`}>{trophy}</span>
        <span className={`text-xs ${rankColor}`}>Rank #{entry.rank}</span>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <img
          src={getAvatar(entry)}
          alt={`${entry.displayName} avatar`}
          className={`${emphasized ? 'h-14 w-14' : 'h-12 w-12'} rounded-full object-cover ring-2 ring-white/40`}
          loading="lazy"
        />
        <div className="min-w-0">
          <p className={`${emphasized ? 'text-lg' : 'text-base'} truncate font-semibold text-white`}>{entry.displayName}</p>
          <p className="truncate text-xs text-slate-400">{entry.address}</p>
        </div>
      </div>
      {getPolymarketProfileUrl(entry) && (
        <a
          href={getPolymarketProfileUrl(entry)!}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(event) => event.stopPropagation()}
          className="mt-2 inline-flex text-xs font-semibold text-blue-300 hover:text-blue-200 hover:underline"
        >
          View on Polymarket
        </a>
      )}
      <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <div>
          <dt className="text-slate-400">ROI</dt>
          <dd className={`${entry.roi !== null && entry.roi >= 0 ? 'text-emerald-300' : 'text-rose-300'} font-semibold`}>
            {formatPercent(entry.roi)}
          </dd>
        </div>
        <div>
          <dt className="text-slate-400">P&L</dt>
          <dd className="font-semibold text-slate-100">{formatUsd(entry.pnl)}</dd>
        </div>
      </dl>
    </button>
  );
}

export function Leaderboard({
  entries,
  onSelect,
  onPrefetch,
  selectedAddress,
  isLoading = false,
  error = null,
  periodOptions = [],
  selectedPeriod = null,
  onPeriodChange
}: LeaderboardProps) {
  const [query, setQuery] = useState('');
  const [minRoiInput, setMinRoiInput] = useState('');
  const [minPnlInput, setMinPnlInput] = useState('');

  const minRoi = minRoiInput.trim() === '' ? null : Number(minRoiInput);
  const minPnl = minPnlInput.trim() === '' ? null : Number(minPnlInput);

  const filteredEntries = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return entries.filter((entry) => {
      const matchesQuery =
        normalizedQuery.length === 0 ||
        entry.displayName.toLowerCase().includes(normalizedQuery) ||
        entry.address.toLowerCase().includes(normalizedQuery) ||
        (entry.username || '').toLowerCase().includes(normalizedQuery) ||
        (entry.pseudonym || '').toLowerCase().includes(normalizedQuery);

      const matchesRoi = minRoi === null || (entry.roi !== null && entry.roi >= minRoi);
      const matchesPnl = minPnl === null || (entry.pnl !== null && entry.pnl >= minPnl);

      return matchesQuery && matchesRoi && matchesPnl;
    });
  }, [entries, query, minRoi, minPnl]);

  const clearFilters = () => {
    setQuery('');
    setMinRoiInput('');
    setMinPnlInput('');
  };

  const hasEntries = filteredEntries.length > 0;
  const hasPeriodControls = periodOptions.length > 0;

  const sorted = [...filteredEntries].sort((a, b) => a.rank - b.rank);
  const first = sorted.find((entry) => entry.rank === 1) || sorted[0] || null;
  const second = sorted.find((entry) => entry.rank === 2) || sorted[1] || null;
  const third = sorted.find((entry) => entry.rank === 3) || sorted[2] || null;
  const rest = sorted.filter((entry) => ![first?.address, second?.address, third?.address].includes(entry.address));

  const orderedEntries = [first, second, third, ...rest].filter(Boolean) as LeaderboardEntry[];

  if (isLoading) {
    return (
      <GlassPanel className="rounded-3xl p-4 space-y-5 sm:p-6 sm:space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-8 w-56 animate-pulse rounded bg-slate-800/80" />
          <div className="h-8 w-40 animate-pulse rounded-full bg-slate-800/80" />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="h-44 animate-pulse rounded-2xl border border-slate-800/70 bg-slate-900/60" />
          <div className="h-52 animate-pulse rounded-2xl border border-slate-800/70 bg-slate-900/60" />
          <div className="h-44 animate-pulse rounded-2xl border border-slate-800/70 bg-slate-900/60" />
        </div>
      </GlassPanel>
    );
  }

  return (
    <GlassPanel className="rounded-3xl p-4 space-y-5 sm:p-6 sm:space-y-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold text-white sm:text-2xl">Top Polymarket traders</h2>
          <p className="text-sm text-slate-400">Click any trader to open their profile and inspect full metrics.</p>
        </div>
        {hasPeriodControls && (
          <div className="w-full overflow-x-auto md:w-auto md:overflow-visible">
            <nav className="flex min-w-max shrink-0 items-center gap-1 rounded-full border border-slate-800/60 bg-slate-900/60 p-1 text-xs font-medium text-slate-300">
              {periodOptions.map((option) => {
                const isActive = option.key === selectedPeriod;
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => {
                      if (onPeriodChange && !isActive) onPeriodChange(option.key);
                    }}
                    aria-pressed={isActive}
                    className={`rounded-full px-3 py-1 transition ${
                      isActive ? 'bg-blue-600 text-white shadow shadow-blue-500/30' : 'hover:bg-slate-800/70'
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </nav>
          </div>
        )}
      </header>

      <div className="grid gap-2 rounded-2xl border border-slate-800/60 bg-slate-900/40 p-3 sm:gap-3 md:grid-cols-[minmax(0,1fr),130px,130px,auto]">
        <input
          type="text"
          placeholder="Filter by trader name, username, or wallet"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="rounded-xl border border-slate-700/80 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
        />
        <input
          type="number"
          step="0.1"
          placeholder="Min ROI %"
          value={minRoiInput}
          onChange={(event) => setMinRoiInput(event.target.value)}
          className="rounded-xl border border-slate-700/80 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
        />
        <input
          type="number"
          step="1"
          placeholder="Min P&L"
          value={minPnlInput}
          onChange={(event) => setMinPnlInput(event.target.value)}
          className="rounded-xl border border-slate-700/80 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
        />
        <button
          type="button"
          onClick={clearFilters}
          className="rounded-xl border border-slate-700/80 px-3 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500 md:min-w-[90px]"
        >
          Clear
        </button>
      </div>

      {!error && !hasEntries && <p className="text-sm text-slate-400">No traders match the current filters.</p>}
      {error && <p className="text-sm text-rose-300">{error}</p>}

      {hasEntries && !error && (
        <>
          <div className="grid gap-4 md:grid-cols-3 md:items-end">
            <div className="reveal reveal-1">{second && <PodiumCard entry={second} onSelect={onSelect} onPrefetch={onPrefetch} compact />}</div>
            <div className="reveal">{first && <PodiumCard entry={first} onSelect={onSelect} onPrefetch={onPrefetch} emphasized />}</div>
            <div className="reveal reveal-2">{third && <PodiumCard entry={third} onSelect={onSelect} onPrefetch={onPrefetch} compact />}</div>
          </div>

          <div className="space-y-3 md:hidden">
            {orderedEntries.map((trader) => {
              const isSelected = selectedAddress === trader.address;
              return (
                <button
                  key={trader.address}
                  type="button"
                  onClick={() => onSelect(trader.address, trader)}
                  onMouseEnter={() => onPrefetch?.(trader.address, trader)}
                  className={`w-full rounded-2xl border p-3 text-left transition ${
                    isSelected ? 'border-blue-400/60 bg-blue-500/10' : 'border-slate-800/60 bg-slate-900/50 hover:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <img src={getAvatar(trader)} alt={`${trader.displayName} avatar`} className="h-9 w-9 rounded-full object-cover" loading="lazy" />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-100">{trader.displayName}</p>
                        <p className="truncate text-xs text-slate-500">{trader.address}</p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-slate-200">#{trader.rank}</span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <p className={`${trader.roi !== null && trader.roi >= 0 ? 'text-emerald-300' : 'text-rose-300'} font-semibold`}>ROI {formatPercent(trader.roi)}</p>
                    <p className="text-slate-200">P&L {formatUsd(trader.pnl)}</p>
                    <p className="text-slate-300">Vol {formatUsd(trader.volume)}</p>
                    <p className="text-slate-300">Trades {formatNumber(trader.trades)}</p>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="hidden overflow-x-auto rounded-2xl border border-slate-800/60 bg-slate-900/50 reveal reveal-1 md:block">
            <table className="min-w-full text-sm">
              <thead className="border-b border-slate-800/60 text-left text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-3">Rank</th>
                  <th className="px-4 py-3">Trader</th>
                  <th className="px-4 py-3 text-right">ROI</th>
                  <th className="px-4 py-3 text-right">P&L</th>
                  <th className="px-4 py-3 text-right">Volume</th>
                  <th className="px-4 py-3 text-right">Trades</th>
                </tr>
              </thead>
              <tbody>
                {orderedEntries.map((trader) => {
                  const isSelected = selectedAddress === trader.address;
                  // Color rows for 1st, 2nd, 3rd
                  let rowColor = '';
                  if (trader.rank === 1) rowColor = 'bg-gradient-to-r from-yellow-400/20 to-yellow-200/10';
                  else if (trader.rank === 2) rowColor = 'bg-gradient-to-r from-slate-200/10 to-slate-400/10';
                  else if (trader.rank === 3) rowColor = 'bg-gradient-to-r from-amber-700/20 to-amber-400/10';
                  return (
                    <tr
                      key={trader.address}
                      onClick={() => onSelect(trader.address, trader)}
                      onMouseEnter={() => onPrefetch?.(trader.address, trader)}
                      className={`cursor-pointer border-b border-slate-800/40 transition last:border-b-0 ${
                        isSelected ? 'bg-blue-500/10' : rowColor || 'hover:bg-slate-800/50'
                      }`}
                    >
                      <td className="px-4 py-3 font-semibold text-slate-200">#{trader.rank}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <img
                            src={getAvatar(trader)}
                            alt={`${trader.displayName} avatar`}
                            className="h-8 w-8 rounded-full object-cover"
                            loading="lazy"
                          />
                          <div>
                            <p className="font-medium text-slate-100">{trader.displayName}</p>
                            <div className="flex items-center gap-2">
                              <p className="text-xs text-slate-500">{trader.address}</p>
                              {getPolymarketProfileUrl(trader) && (
                                <a
                                  href={getPolymarketProfileUrl(trader)!}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(event) => event.stopPropagation()}
                                  className="text-[11px] font-semibold text-blue-300 hover:text-blue-200 hover:underline"
                                >
                                  Polymarket
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className={`px-4 py-3 text-right font-semibold ${trader.roi !== null && trader.roi >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                        {formatPercent(trader.roi)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-slate-100">{formatUsd(trader.pnl)}</td>
                      <td className="px-4 py-3 text-right text-slate-200">{formatUsd(trader.volume)}</td>
                      <td className="px-4 py-3 text-right text-slate-200">{formatNumber(trader.trades)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </GlassPanel>
  );
}
