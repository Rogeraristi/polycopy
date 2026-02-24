import { useMemo, useState } from 'react';

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
  onSelect: (address: string) => void;
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

function PodiumCard({
  entry,
  onSelect,
  emphasized = false,
  compact = false
}: {
  entry: LeaderboardEntry;
  onSelect: (address: string) => void;
  emphasized?: boolean;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(entry.address)}
      className={`w-full rounded-2xl border p-4 text-left transition ${
        emphasized
          ? 'border-amber-300/60 bg-gradient-to-b from-amber-400/20 to-[#0c1324] shadow-lg shadow-amber-500/20'
          : compact
          ? 'border-[#2b4068] bg-[#0c1730cc] hover:border-[#4d709e]'
          : 'border-[#2b4068] bg-[#0c1730b3] hover:border-[#4d709e]'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className={`${emphasized ? 'text-3xl' : 'text-2xl'}`}>{getTrophy(entry.rank)}</span>
        <span className={`text-xs ${emphasized ? 'text-amber-200' : 'text-slate-300'}`}>Rank #{entry.rank}</span>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <img
          src={getAvatar(entry)}
          alt={`${entry.displayName} avatar`}
          className={`${emphasized ? 'h-12 w-12' : 'h-10 w-10'} rounded-full object-cover`}
        />
        <div className="min-w-0">
          <p className={`${emphasized ? 'text-base' : 'text-sm'} truncate font-semibold text-white`}>{entry.displayName}</p>
          <p className="truncate text-xs text-[#8fa5cb]">{entry.address}</p>
        </div>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <div>
          <dt className="text-[#8fa5cb]">ROI</dt>
          <dd className={`${entry.roi !== null && entry.roi >= 0 ? 'text-emerald-300' : 'text-rose-300'} font-semibold`}>
            {formatPercent(entry.roi)}
          </dd>
        </div>
        <div>
          <dt className="text-[#8fa5cb]">P&L</dt>
          <dd className="font-semibold text-slate-100">{formatUsd(entry.pnl)}</dd>
        </div>
      </dl>
    </button>
  );
}

export function Leaderboard({
  entries,
  onSelect,
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

  if (isLoading) {
    return (
      <section className="card p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-8 w-56 animate-pulse rounded bg-[#15233f]" />
          <div className="h-8 w-40 animate-pulse rounded-full bg-[#15233f]" />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="h-44 animate-pulse rounded-2xl border border-[#26395f] bg-[#101c35cc]" />
          <div className="h-52 animate-pulse rounded-2xl border border-[#26395f] bg-[#101c35cc]" />
          <div className="h-44 animate-pulse rounded-2xl border border-[#26395f] bg-[#101c35cc]" />
        </div>
        <div className="overflow-hidden rounded-2xl border border-[#26395f] bg-[#101c35cc]">
          <div className="grid grid-cols-6 gap-2 border-b border-[#26395f] p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={`s-head-${i}`} className="h-3 animate-pulse rounded bg-[#15233f]" />
            ))}
          </div>
          <div className="space-y-3 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={`s-row-${i}`} className="h-8 animate-pulse rounded bg-[#15233f]" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="card p-6 space-y-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <h2 className="brand-heading text-2xl font-semibold text-white">Top Polymarket traders</h2>
          <p className="text-sm text-[#8fa5cb]">Click any trader to open their profile and inspect full metrics.</p>
        </div>
        {hasPeriodControls && (
          <nav className="flex shrink-0 items-center gap-1 rounded-full border border-[#26395f] bg-[#101c35cc] p-1 text-xs font-medium text-[#9bb0d5]">
            {periodOptions.map((option) => {
              const isActive = option.key === selectedPeriod;
              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => {
                    if (onPeriodChange && !isActive) {
                      onPeriodChange(option.key);
                    }
                  }}
                  aria-pressed={isActive}
                  className={`rounded-full px-3 py-1 transition ${
                    isActive ? 'bg-gradient-to-r from-[#21c4c4] to-[#0dd3a8] text-[#032021] shadow shadow-[#21c4c455]' : 'hover:bg-[#15233f]'
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </nav>
        )}
      </header>

      <div className="grid gap-3 rounded-2xl border border-[#26395f] bg-[#101c35b3] p-3 md:grid-cols-[minmax(0,1fr),130px,130px,auto]">
        <input
          type="text"
          placeholder="Filter by trader name, username, or wallet"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="rounded-xl border border-[#2b4068] bg-[#0c1730cc] px-3 py-2 text-sm text-[#e5efff] placeholder:text-[#6f88b2]"
        />
        <input
          type="number"
          step="0.1"
          placeholder="Min ROI %"
          value={minRoiInput}
          onChange={(event) => setMinRoiInput(event.target.value)}
          className="rounded-xl border border-[#2b4068] bg-[#0c1730cc] px-3 py-2 text-sm text-[#e5efff] placeholder:text-[#6f88b2]"
        />
        <input
          type="number"
          step="1"
          placeholder="Min P&L"
          value={minPnlInput}
          onChange={(event) => setMinPnlInput(event.target.value)}
          className="rounded-xl border border-[#2b4068] bg-[#0c1730cc] px-3 py-2 text-sm text-[#e5efff] placeholder:text-[#6f88b2]"
        />
        <button
          type="button"
          onClick={clearFilters}
          className="rounded-xl border border-[#2b4068] bg-[#0c1730cc] px-3 py-2 text-sm font-semibold text-[#d8e6ff] transition hover:border-[#4d709e]"
        >
          Clear
        </button>
      </div>

      {!isLoading && error && <p className="text-sm text-rose-300">{error}</p>}
      {!isLoading && !error && !hasEntries && <p className="text-sm text-[#8fa5cb]">No traders match the current filters.</p>}

      {!isLoading && !error && hasEntries && (
        <>
          <div className="grid gap-4 md:grid-cols-3 md:items-end">
            <div className="reveal reveal-1">{second && <PodiumCard entry={second} onSelect={onSelect} compact />}</div>
            <div className="reveal">{first && <PodiumCard entry={first} onSelect={onSelect} emphasized />}</div>
            <div className="reveal reveal-2">{third && <PodiumCard entry={third} onSelect={onSelect} compact />}</div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-[#26395f] bg-[#101c35b3] reveal reveal-1">
            <table className="min-w-full text-sm">
              <thead className="border-b border-[#26395f] text-left text-xs uppercase tracking-wide text-[#8fa5cb]">
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
                {[first, second, third, ...rest].filter(Boolean).map((entry) => {
                  const trader = entry as LeaderboardEntry;
                  const isSelected = selectedAddress === entry.address;
                  return (
                    <tr
                      key={trader.address}
                      onClick={() => onSelect(trader.address)}
                      className={`cursor-pointer border-b border-[#26395f] transition last:border-b-0 ${
                        isSelected ? 'bg-[#14325a]' : 'hover:bg-[#15233f]'
                      }`}
                    >
                      <td className="px-4 py-3 font-semibold text-[#d8e6ff]">#{trader.rank}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <img
                            src={getAvatar(trader)}
                            alt={`${trader.displayName} avatar`}
                            className="h-8 w-8 rounded-full object-cover"
                          />
                          <div>
                            <p className="font-medium text-slate-100">{trader.displayName}</p>
                            <p className="text-xs text-[#8fa5cb]">{trader.address}</p>
                          </div>
                        </div>
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-semibold ${
                          trader.roi !== null && trader.roi >= 0 ? 'text-emerald-300' : 'text-rose-300'
                        }`}
                      >
                        {formatPercent(trader.roi)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-slate-100">{formatUsd(trader.pnl)}</td>
                      <td className="px-4 py-3 text-right text-[#d8e6ff]">{formatUsd(trader.volume)}</td>
                      <td className="px-4 py-3 text-right text-[#d8e6ff]">{formatNumber(trader.trades)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
