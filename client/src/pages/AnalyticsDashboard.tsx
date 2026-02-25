import { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import GlassPanel from '../components/effects/GlassPanel';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';

type AnalyticsSnapshot = {
  periods: Record<string, Array<{ address: string; rank?: number; displayName?: string }>>;
  defaultPeriod?: string;
};

type TraderHistoryEntry = {
  timestamp: number;
  pnl: number | null;
  tradeCount: number;
  notionalVolume: number;
  marketCount: number;
  openPositions: number;
};

export default function AnalyticsDashboard() {
  const [analyticsData, setAnalyticsData] = useState<{ snapshot: AnalyticsSnapshot; fetchedAt: number } | null>(
    null
  );
  const [history, setHistory] = useState<TraderHistoryEntry[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/analytics/leaderboard')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load analytics leaderboard');
        return res.json();
      })
      .then((payload) => {
        if (!cancelled) {
          setAnalyticsData(payload);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load analytics data');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedAddress) {
      setHistory([]);
      return;
    }
    let cancelled = false;
    setIsHistoryLoading(true);
    fetch(`/api/analytics/trader/${selectedAddress}/history`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load trader history');
        return res.json();
      })
      .then((payload) => {
        if (!cancelled) {
          setHistory(payload.history || []);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load trader history');
      })
      .finally(() => {
        if (!cancelled) setIsHistoryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedAddress]);

  const defaultPeriod = analyticsData?.snapshot.defaultPeriod || 'weekly';
  const leaderboardEntries = useMemo(() => {
    const periodData = analyticsData?.snapshot.periods?.[defaultPeriod] || [];
    return Array.isArray(periodData) ? periodData.slice(0, 12) : [];
  }, [analyticsData, defaultPeriod]);

  const chartData = useMemo(
    () =>
      history
        .slice(0, 12)
        .map((entry) => ({
          ...entry,
          label: new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }))
        .reverse(),
    [history]
  );

  return (
    <div className="min-h-screen bg-[#040712] text-slate-100">
      <div className="relative z-10 mx-auto max-w-6xl px-3 pb-20 pt-8 space-y-6 sm:px-6">
        <GlassPanel className="rounded-3xl p-6 space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-blue-300">Analytics</p>
              <h1 className="text-2xl font-semibold text-white">Live leaderboard insights</h1>
            </div>
            <RouterLink
              to="/leaderboard"
              className="rounded-full border border-slate-600 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-200 transition hover:border-white"
            >
              Back to leaderboard
            </RouterLink>
          </div>
          {analyticsData?.fetchedAt && (
            <p className="text-xs text-slate-400">
              Snapshot taken {new Date(analyticsData.fetchedAt).toLocaleTimeString()} from Polymarket.
            </p>
          )}
          {error && <p className="text-sm text-rose-300">{error}</p>}
        </GlassPanel>

        <GlassPanel className="rounded-3xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Top analytics leaderboard</h2>
            <span className="text-xs text-slate-400 uppercase tracking-[0.3em]">{defaultPeriod}</span>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {leaderboardEntries.map((entry) => (
              <button
                key={entry.address}
                type="button"
                onClick={() => setSelectedAddress(entry.address)}
                className={`flex flex-col gap-1 rounded-2xl border px-3 py-3 text-left transition ${
                  selectedAddress === entry.address
                    ? 'border-blue-500/60 bg-blue-500/10'
                    : 'border-slate-800/60 bg-slate-900/60 hover:border-slate-500'
                }`}
              >
                <span className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                  Rank {entry.rank || '—'}
                </span>
                <span className="text-base font-semibold text-white">{entry.displayName || entry.address}</span>
                <span className="text-xs text-slate-500">{entry.address}</span>
              </button>
            ))}
          </div>
        </GlassPanel>

        {selectedAddress && (
          <GlassPanel className="rounded-3xl p-4 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Trader history</p>
                <h2 className="text-xl font-semibold text-white">{selectedAddress}</h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAddress(null)}
                className="text-xs font-semibold text-slate-400 underline-offset-4 hover:text-slate-100"
              >
                Clear selection
              </button>
            </div>
            {isHistoryLoading && <p className="text-sm text-slate-400">Loading history…</p>}
            {!isHistoryLoading && history.length === 0 && (
              <p className="text-sm text-slate-400">No history captured yet for this trader.</p>
            )}
            {history.length > 0 && (
              <div className="space-y-4">
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
                      <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                      <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#020617', border: '1px solid #334155' }}
                        labelStyle={{ color: '#cbd5e1' }}
                      />
                      <Line type="monotone" dataKey="pnl" stroke="#22c55e" strokeWidth={2} dot={false} name="PnL" />
                      <Line type="monotone" dataKey="tradeCount" stroke="#60a5fa" strokeWidth={2} dot={false} name="Trades" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs text-slate-300 sm:grid-cols-4">
                  <div>
                    <p className="text-[11px] uppercase text-slate-500">Last PnL</p>
                    <p className="mt-1 text-sm font-semibold text-emerald-300">
                      {history[0].pnl === null ? '—' : `$${history[0].pnl.toFixed(2)}`}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase text-slate-500">Trades</p>
                    <p className="mt-1 text-sm font-semibold text-slate-100">{history[0].tradeCount}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase text-slate-500">Market Count</p>
                    <p className="mt-1 text-sm font-semibold text-slate-100">{history[0].marketCount}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase text-slate-500">Open Positions</p>
                    <p className="mt-1 text-sm font-semibold text-slate-100">{history[0].openPositions}</p>
                  </div>
                </div>
              </div>
            )}
          </GlassPanel>
        )}
      </div>
    </div>
  );
}
