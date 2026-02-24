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
  const hasEntries = entries.length > 0;
  const activePeriodLabel = periodOptions.find((option) => option.key === selectedPeriod)?.label ?? null;
  const hasPeriodControls = periodOptions.length > 0;

  // Fallback avatar
  // Generate a simple base64 SVG avatar as fallback
  function generateAvatar(address: string) {
    const color = `hsl(${address.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360}, 70%, 55%)`;
    const initials = address.slice(2, 4).toUpperCase();
    const svg = `<svg width='64' height='64' xmlns='http://www.w3.org/2000/svg'>
      <defs>
        <filter id='shadow' x='-20%' y='-20%' width='140%' height='140%'>
          <feDropShadow dx='0' dy='2' stdDeviation='2' flood-color='#000' flood-opacity='0.18'/>
        </filter>
      </defs>
      <circle cx='32' cy='32' r='30' fill='${color}' stroke='white' stroke-width='4' filter='url(#shadow)'/>
      <text x='50%' y='54%' text-anchor='middle' font-size='28' font-family='Inter,Arial,sans-serif' font-weight='bold' fill='#fff' dy='.3em'>${initials}</text>
    </svg>`;
    return `data:image/svg+xml;base64,${btoa(svg.replace(/\n\s+/g, ''))}`;
  }
  return (
    <section className="card p-6 space-y-4">
      <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-white">Top Polymarket traders</h2>
          <p className="text-sm text-slate-400">
            {activePeriodLabel
              ? `${activePeriodLabel} performance snapshot. Select one to start mirroring instantly.`
              : 'Shortcut into the wallets with the strongest performance. Select one to start mirroring instantly.'}
          </p>
        </div>
        {hasPeriodControls && (
          <nav className="flex shrink-0 items-center gap-1 rounded-full border border-slate-800/60 bg-slate-900/60 p-1 text-xs font-medium text-slate-300">
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
                    isActive ? 'bg-primary text-white shadow shadow-primary/30' : 'hover:bg-slate-800/70'
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </nav>
        )}
      </header>

      {isLoading && (
        <p className="text-sm text-slate-400">
          Loading {activePeriodLabel ? `${activePeriodLabel.toLowerCase()} leaderboard…` : 'leaderboard…'}
        </p>
      )}
      {!isLoading && error && <p className="text-sm text-rose-300">{error}</p>}

      {!isLoading && !error && !hasEntries && (
        <p className="text-sm text-slate-400">Leaderboard data is unavailable right now. Try again shortly.</p>
      )}

      {!isLoading && !error && hasEntries && (
        <ul className="grid gap-3 md:grid-cols-2">
          {entries.map((entry) => {
            const isSelected = selectedAddress === entry.address;
            let avatar = entry.avatarUrl;
            if (!avatar) {
              avatar = generateAvatar(entry.address);
            }
            return (
              <li key={`${entry.rank}-${entry.address}`}>
                <button
                  type="button"
                  onClick={() => onSelect(entry.address)}
                  className={`w-full rounded-xl border px-4 py-4 text-left transition ${
                    isSelected
                      ? 'border-primary bg-primary/10 text-white shadow-lg'
                      : 'border-slate-700/60 bg-slate-900/40 text-slate-200 hover:border-primary/50 hover:bg-slate-900/60'
                  }`}
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="flex items-center gap-3 text-sm font-medium">
                      <span
                        className={`inline-flex h-7 w-7 items-center justify-center rounded-full border text-xs uppercase ${
                          isSelected
                            ? 'border-primary/60 bg-primary/10 text-primary'
                            : 'border-slate-700 bg-slate-900 text-slate-300'
                        }`}
                      >
                        #{entry.rank}
                      </span>
                      <span className="inline-flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-slate-800 bg-slate-900">
                        <img
                          src={avatar}
                          alt={`${entry.displayName} avatar`}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      </span>
                      <span>{entry.displayName}</span>
                    </div>
                    <span
                      className={`text-sm font-semibold ${
                        entry.roi !== null && entry.roi >= 0 ? 'text-emerald-300' : 'text-rose-300'
                      }`}
                    >
                      {formatPercent(entry.roi)}
                    </span>
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-400">
                    <div>
                      <dt className="uppercase tracking-wide">P&L</dt>
                      <dd className="font-medium text-slate-200">{formatUsd(entry.pnl)}</dd>
                    </div>
                    <div>
                      <dt className="uppercase tracking-wide">Volume</dt>
                      <dd className="font-medium text-slate-200">{formatUsd(entry.volume)}</dd>
                    </div>
                  </dl>
                  <p className="mt-3 text-xs text-slate-500 break-all">{entry.address}</p>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
