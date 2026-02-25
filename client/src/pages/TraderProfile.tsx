import { useEffect, useMemo, useState } from 'react';
import MetallicLogo from '../components/MetallicLogo';
import { Link, useLocation, useParams } from 'react-router-dom';
import type { Trade } from '../hooks/useLiveTrades';
import BreakingNewsBanner from '../components/BreakingNewsBanner';
import GlassPanel from '../components/effects/GlassPanel';
import { Brush, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

type PnlPayload = {
  pnl: number | null;
  calculation?: string;
  tradeCount?: number;
};

type PortfolioPayload = {
  portfolioValue: number | null;
};

type OpenOrdersPayload = {
  openOrders?: Array<{
    market?: string;
    side?: string;
    size?: number;
    price?: number | null;
    status?: string;
  }>;
  note?: string;
};

type LeaderboardContextEntry = {
  displayName?: string | null;
  rank?: number | null;
  roi?: number | null;
  pnl?: number | null;
  volume?: number | null;
  trades?: number | null;
  avatarUrl?: string | null;
};

type TraderProfileSummary = {
  address: string;
  displayName: string;
  username?: string | null;
  pseudonym?: string | null;
  polymarketUrl?: string | null;
  avatarUrl?: string | null;
  rank?: number | null;
  roi?: number | null;
  pnl?: number | null;
  volume?: number | null;
  trades?: number | null;
};

type AnalyticsHistoryEntry = {
  timestamp: number;
  isoTimestamp?: string;
  pnl: number | null;
  tradeCount: number;
  notionalVolume: number;
  marketCount: number;
  openPositions: number;
  tradesLoaded: number;
};

type AnalyticsHistoryDeltas = {
  pnl24h: number | null;
  pnl7d: number | null;
  volume24h: number | null;
  volume7d: number | null;
  tradeCount24h: number | null;
  tradeCount7d: number | null;
};

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';
const OVERVIEW_CACHE_TTL_MS = 1000 * 60 * 3;

function getOverviewCacheKey(address: string, period: string) {
  return `trader_overview_${address.toLowerCase()}_${period}`;
}

function formatUsd(value: number | null) {
  if (value === null || !Number.isFinite(value)) return '—';
  return value.toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2
  });
}

export default function TraderProfile() {
  const { address } = useParams<{ address: string }>();
  const location = useLocation();
  const navigationEntry = (location.state as { leaderboardEntry?: LeaderboardContextEntry } | null)?.leaderboardEntry || null;
  const [trades, setTrades] = useState<Trade[]>([]);
  const [pnl, setPnl] = useState<PnlPayload | null>(null);
  const [portfolio, setPortfolio] = useState<PortfolioPayload | null>(null);
  const [openOrders, setOpenOrders] = useState<OpenOrdersPayload | null>(null);
  const [leaderboardContext, setLeaderboardContext] = useState<LeaderboardContextEntry | null>(navigationEntry);
  const [profileSummary, setProfileSummary] = useState<TraderProfileSummary | null>(null);
  const [analyticsHistory, setAnalyticsHistory] = useState<AnalyticsHistoryEntry[]>([]);
  const [analyticsDeltas, setAnalyticsDeltas] = useState<AnalyticsHistoryDeltas | null>(null);
  const [period, setPeriod] = useState<'today' | 'weekly' | 'monthly' | 'all'>('all');
  const [projectionEnabled, setProjectionEnabled] = useState(true);
  const [projectionMode, setProjectionMode] = useState<'conservative' | 'base' | 'aggressive'>('base');
  const [zoomPreset, setZoomPreset] = useState<'1m' | '1y' | 'ytd' | 'max' | 'custom'>('1y');
  const [performanceView, setPerformanceView] = useState<'current' | 'average'>('current');
  const [brushRange, setBrushRange] = useState<{ startIndex: number; endIndex: number }>({ startIndex: 0, endIndex: 0 });
  const [refreshTick, setRefreshTick] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLeaderboardContext(navigationEntry);
  }, [navigationEntry, address]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setRefreshTick((previous) => previous + 1);
    }, 45_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    const controller = new AbortController();
    const normalizedAddress = address.toLowerCase();
    const applyOverviewPayload = (overview: any) => {
      const overviewProfile = overview?.profile && typeof overview.profile === 'object' ? overview.profile : null;
      const nextTrades = Array.isArray(overview?.trades) ? overview.trades : [];
      const nextPnl =
        typeof overview?.pnl?.pnl === 'number'
          ? overview.pnl.pnl
          : typeof overviewProfile?.pnl === 'number'
          ? overviewProfile.pnl
          : typeof leaderboardContext?.pnl === 'number'
          ? leaderboardContext.pnl
          : null;
      const nextPortfolio =
        typeof overview?.portfolio?.portfolioValue === 'number' ? overview.portfolio.portfolioValue : null;

      setTrades(nextTrades);
      setPnl({
        pnl: nextPnl,
        calculation: typeof overview?.pnl?.calculation === 'string' ? overview.pnl.calculation : undefined,
        tradeCount:
          typeof overview?.pnl?.tradeCount === 'number'
            ? overview.pnl.tradeCount
            : typeof overviewProfile?.trades === 'number'
            ? overviewProfile.trades
            : typeof leaderboardContext?.trades === 'number'
            ? leaderboardContext.trades
            : undefined
      });
      setPortfolio({ portfolioValue: nextPortfolio });
      setOpenOrders({
        openOrders: Array.isArray(overview?.openOrders?.openOrders) ? overview.openOrders.openOrders : [],
        note: typeof overview?.openOrders?.note === 'string' ? overview.openOrders.note : undefined
      });
      setProfileSummary(overviewProfile || null);
      if (overviewProfile) {
        setLeaderboardContext((previous) => ({
          displayName:
            (typeof overviewProfile.displayName === 'string' && overviewProfile.displayName.trim()) ||
            previous?.displayName ||
            navigationEntry?.displayName ||
            null,
          rank:
            typeof overviewProfile.rank === 'number'
              ? overviewProfile.rank
              : typeof previous?.rank === 'number'
              ? previous.rank
              : navigationEntry?.rank ?? null,
          roi:
            typeof overviewProfile.roi === 'number'
              ? overviewProfile.roi
              : typeof previous?.roi === 'number'
              ? previous.roi
              : navigationEntry?.roi ?? null,
          pnl:
            typeof overviewProfile.pnl === 'number'
              ? overviewProfile.pnl
              : typeof previous?.pnl === 'number'
              ? previous.pnl
              : navigationEntry?.pnl ?? null,
          volume:
            typeof overviewProfile.volume === 'number'
              ? overviewProfile.volume
              : typeof previous?.volume === 'number'
              ? previous.volume
              : navigationEntry?.volume ?? null,
          trades:
            typeof overviewProfile.trades === 'number'
              ? overviewProfile.trades
              : typeof previous?.trades === 'number'
              ? previous.trades
              : navigationEntry?.trades ?? null,
          avatarUrl:
            (typeof overviewProfile.avatarUrl === 'string' && overviewProfile.avatarUrl) ||
            previous?.avatarUrl ||
            navigationEntry?.avatarUrl ||
            null
        }));
      }
    };

    let hydratedFromCache = false;
    if (typeof window !== 'undefined') {
      try {
        const raw = window.sessionStorage.getItem(getOverviewCacheKey(normalizedAddress, period));
        if (raw) {
          const parsed = JSON.parse(raw);
          const savedAt = Number(parsed?.savedAt || 0);
          if (savedAt > 0 && Date.now() - savedAt <= OVERVIEW_CACHE_TTL_MS && parsed?.payload) {
            applyOverviewPayload(parsed.payload);
            hydratedFromCache = true;
          }
        }
      } catch {}
    }

    setLoading(!hydratedFromCache);
    setError(null);

    const overviewQuery = new URLSearchParams({
      period,
      limit: '500'
    });

    fetch(`${API_BASE}/users/${address}/overview?${overviewQuery.toString()}`, {
      signal: controller.signal,
      credentials: 'include'
    })
      .then(async (overviewRes) => {
        if (overviewRes.ok) {
          const overview = await overviewRes.json();
          if (cancelled) return;
          applyOverviewPayload(overview);
          if (typeof window !== 'undefined') {
            try {
              window.sessionStorage.setItem(
                getOverviewCacheKey(normalizedAddress, period),
                JSON.stringify({ savedAt: Date.now(), payload: overview })
              );
            } catch {}
          }
          return;
        }

        // Fallback for older backend versions without overview endpoint.
        const [tradesRes, pnlRes, portfolioRes, ordersRes] = await Promise.all([
          fetch(`${API_BASE}/users/${address}/trades?${overviewQuery.toString()}`, {
            signal: controller.signal,
            credentials: 'include'
          }),
          fetch(`${API_BASE}/users/${address}/pnl?${overviewQuery.toString()}`, {
            signal: controller.signal,
            credentials: 'include'
          }),
          fetch(`${API_BASE}/users/${address}/portfolio`, { signal: controller.signal, credentials: 'include' }),
          fetch(`${API_BASE}/users/${address}/open-orders?${overviewQuery.toString()}`, {
            signal: controller.signal,
            credentials: 'include'
          })
        ]);

        if (!tradesRes.ok) throw new Error(`Failed to load trades (${tradesRes.status})`);
        if (!pnlRes.ok) throw new Error(`Failed to load pnl (${pnlRes.status})`);
        if (!portfolioRes.ok) throw new Error(`Failed to load portfolio (${portfolioRes.status})`);
        if (!ordersRes.ok) throw new Error(`Failed to load open orders (${ordersRes.status})`);

        const [tradesData, pnlData, portfolioData, ordersData] = await Promise.all([
          tradesRes.json(),
          pnlRes.json(),
          portfolioRes.json(),
          ordersRes.json()
        ]);

        if (cancelled) return;

        setTrades(Array.isArray(tradesData?.trades) ? tradesData.trades : []);
        setPnl({
          pnl:
            typeof pnlData?.pnl === 'number'
              ? pnlData.pnl
              : typeof leaderboardContext?.pnl === 'number'
              ? leaderboardContext.pnl
              : null,
          calculation: typeof pnlData?.calculation === 'string' ? pnlData.calculation : undefined,
          tradeCount:
            typeof pnlData?.tradeCount === 'number'
              ? pnlData.tradeCount
              : typeof leaderboardContext?.trades === 'number'
              ? leaderboardContext.trades
              : undefined
        });
        setPortfolio({
          portfolioValue: typeof portfolioData?.portfolioValue === 'number' ? portfolioData.portfolioValue : null
        });
        setOpenOrders({
          openOrders: Array.isArray(ordersData?.openOrders) ? ordersData.openOrders : [],
          note: typeof ordersData?.note === 'string' ? ordersData.note : undefined
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load trader profile');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [address, period, refreshTick, navigationEntry]);

  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    const controller = new AbortController();

    fetch(`${API_BASE}/analytics/trader/${address}/history`, {
      signal: controller.signal,
      credentials: 'include'
    })
      .then(async (response) => {
        if (!response.ok) return null;
        return response.json();
      })
      .then((payload) => {
        if (cancelled || !payload) return;
        const history = Array.isArray(payload?.history) ? payload.history : [];
        const normalized = history
          .map((entry: any) => ({
            timestamp: Number(entry?.timestamp),
            isoTimestamp: typeof entry?.isoTimestamp === 'string' ? entry.isoTimestamp : undefined,
            pnl: typeof entry?.pnl === 'number' ? entry.pnl : null,
            tradeCount: Number(entry?.tradeCount || 0),
            notionalVolume: Number(entry?.notionalVolume || 0),
            marketCount: Number(entry?.marketCount || 0),
            openPositions: Number(entry?.openPositions || 0),
            tradesLoaded: Number(entry?.tradesLoaded || 0)
          }))
          .filter((entry) => Number.isFinite(entry.timestamp) && entry.timestamp > 0);
        setAnalyticsHistory(normalized);
        setAnalyticsDeltas(payload?.deltas || null);
      })
      .catch(() => {
        if (!cancelled) {
          setAnalyticsHistory([]);
          setAnalyticsDeltas(null);
        }
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [address, refreshTick]);

  const tradeRows = useMemo(() => {
    return trades.map((trade, i) => ({
      id:
        trade.id ||
        trade.transaction_hash ||
        trade.txid ||
        `${trade.created_at || trade.createdAt || trade.timestamp || 't'}-${i}`,
      date: trade.created_at || trade.createdAt || trade.timestamp || null,
      market:
        (typeof trade.market === 'string' ? trade.market : trade.market?.question || trade.market?.title) ||
        trade.marketId ||
        trade.market_id ||
        'Unknown market',
      side: (trade.side || trade.type || '').toUpperCase() || '—',
      size: Number(trade.amount || trade.size || trade.shares || 0),
      price: Number(trade.price || 0)
    }));
  }, [trades]);

  const derivedMetrics = useMemo(() => {
    if (!trades.length) {
      return {
        totalNotional: 0,
        buyCount: 0,
        sellCount: 0,
        marketCount: 0,
        avgTradeSize: 0,
        lastTradeAt: null as string | null
      };
    }

    let totalNotional = 0;
    let totalSize = 0;
    let buyCount = 0;
    let sellCount = 0;
    const markets = new Set<string>();
    let latestTimestamp = 0;

    trades.forEach((trade) => {
      const size = Number(trade.amount || trade.size || trade.shares || 0);
      const price = Number(trade.price || 0);
      if (Number.isFinite(size) && Number.isFinite(price)) {
        totalNotional += Math.abs(size * price);
      }
      if (Number.isFinite(size)) {
        totalSize += Math.abs(size);
      }

      const side = String(trade.side || trade.type || '').toLowerCase();
      if (side === 'buy') buyCount += 1;
      if (side === 'sell') sellCount += 1;

      const market =
        (typeof trade.market === 'string' ? trade.market : trade.market?.question || trade.market?.title) ||
        trade.marketId ||
        trade.market_id ||
        'Unknown market';
      markets.add(String(market));

      const ts = new Date((trade.created_at || trade.createdAt || trade.timestamp || 0) as any).getTime();
      if (Number.isFinite(ts)) {
        latestTimestamp = Math.max(latestTimestamp, ts);
      }
    });

    return {
      totalNotional,
      buyCount,
      sellCount,
      marketCount: markets.size,
      avgTradeSize: trades.length > 0 ? totalSize / trades.length : 0,
      lastTradeAt: latestTimestamp > 0 ? new Date(latestTimestamp).toLocaleString() : null
    };
  }, [trades]);

  const baseSeries = useMemo(() => {
    if (analyticsHistory.length > 0) {
      return [...analyticsHistory]
        .sort((a, b) => a.timestamp - b.timestamp)
        .map((entry) => ({
          ts: entry.timestamp,
          label: new Date(entry.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
          actualPnl: entry.pnl,
          projectedPnl: null as number | null
        }));
    }

    const withTimes = trades
      .map((trade, index) => {
        const rawTime = trade.created_at || trade.createdAt || trade.timestamp || null;
        const ts = rawTime ? new Date(rawTime).getTime() : NaN;
        if (!Number.isFinite(ts)) return null;
        const side = String(trade.side || trade.type || '').toLowerCase();
        const size = Number(trade.amount || trade.size || trade.shares || 0);
        const price = Number(trade.price || 0);
        const signedCashflow = Number.isFinite(size) && Number.isFinite(price) ? (side === 'sell' ? 1 : -1) * size * price : 0;
        return { ts, signedCashflow, index };
      })
      .filter(Boolean) as Array<{ ts: number; signedCashflow: number; index: number }>;

    if (withTimes.length === 0) {
      return [];
    }

    withTimes.sort((a, b) => a.ts - b.ts || a.index - b.index);

    let runningPnl = 0;
    const actualPoints = withTimes.map((point) => {
      runningPnl += point.signedCashflow;
      return {
        ts: point.ts,
        label: new Date(point.ts).toLocaleDateString(),
        actualPnl: Number(runningPnl.toFixed(2)),
        projectedPnl: null as number | null
      };
    });

    return actualPoints;
  }, [analyticsHistory, trades]);

  const chartSeries = useMemo(() => {
    if (baseSeries.length === 0) return [];
    if (!projectionEnabled || baseSeries.length < 2) return baseSeries;

    // Linear trend projection for 180 days from the latest known point.
    const lookbackMs = 90 * 24 * 60 * 60 * 1000;
    const latestTs = baseSeries[baseSeries.length - 1].ts;
    const windowed = baseSeries.filter((point) => point.ts >= latestTs - lookbackMs);
    const basis = windowed.length >= 2 ? windowed : baseSeries.slice(-Math.min(baseSeries.length, 30));

    const n = basis.length;
    const xs = basis.map((point) => point.ts);
    const ys = basis.map((point) => point.actualPnl ?? 0);
    const meanX = xs.reduce((acc, value) => acc + value, 0) / n;
    const meanY = ys.reduce((acc, value) => acc + value, 0) / n;
    let numerator = 0;
    let denominator = 0;
    for (let i = 0; i < n; i += 1) {
      const dx = xs[i] - meanX;
      numerator += dx * (ys[i] - meanY);
      denominator += dx * dx;
    }
    const slopePerMs = denominator === 0 ? 0 : numerator / denominator;
    const projectionFactor = projectionMode === 'conservative' ? 0.7 : projectionMode === 'aggressive' ? 1.3 : 1;
    const adjustedSlopePerMs = slopePerMs * projectionFactor;
    const intercept = meanY - slopePerMs * meanX;

    const projectionDays = 180;
    const dayMs = 24 * 60 * 60 * 1000;
    const projection = Array.from({ length: projectionDays }, (_, i) => {
      const ts = latestTs + (i + 1) * dayMs;
      const projectedPnl = Number((adjustedSlopePerMs * ts + intercept).toFixed(2));
      return {
        ts,
        label: new Date(ts).toLocaleDateString(),
        actualPnl: null as number | null,
        projectedPnl
      };
    });

    return [...baseSeries, ...projection];
  }, [baseSeries, projectionEnabled, projectionMode]);

  const usesAnalyticsHistory = analyticsHistory.length > 0;

  const actualSeries = useMemo(
    () =>
      chartSeries
        .filter((point) => Number.isFinite(Number(point.actualPnl)))
        .map((point) => ({ ts: Number(point.ts), pnl: Number(point.actualPnl) }))
        .sort((a, b) => a.ts - b.ts),
    [chartSeries]
  );

  const performanceStats = useMemo(() => {
    if (actualSeries.length < 2) {
      return { d1: null, w1: null, m1: null, ytd: null, y1: null, max: null } as Record<string, number | null>;
    }
    const latest = actualSeries[actualSeries.length - 1];
    const latestTs = latest.ts;
    const latestPnl = latest.pnl;
    const oneDayMs = 24 * 60 * 60 * 1000;
    const findBaseline = (targetTs: number) =>
      actualSeries.find((entry) => entry.ts >= targetTs)?.pnl ?? actualSeries[0].pnl;
    const startOfYearTs = new Date(new Date(latestTs).getFullYear(), 0, 1).getTime();
    const maxBaseline = actualSeries[0].pnl;

    const current = {
      d1: latestPnl - findBaseline(latestTs - oneDayMs),
      w1: latestPnl - findBaseline(latestTs - oneDayMs * 7),
      m1: latestPnl - findBaseline(latestTs - oneDayMs * 30),
      ytd: latestPnl - findBaseline(startOfYearTs),
      y1: latestPnl - findBaseline(latestTs - oneDayMs * 365),
      max: latestPnl - maxBaseline
    } as Record<string, number>;

    if (performanceView === 'current') {
      return current;
    }

    const avg = (delta: number, days: number) => delta / days;
    return {
      d1: avg(current.d1, 1),
      w1: avg(current.w1, 7),
      m1: avg(current.m1, 30),
      ytd: avg(current.ytd, Math.max(1, Math.floor((latestTs - startOfYearTs) / oneDayMs))),
      y1: avg(current.y1, 365),
      max: avg(current.max, Math.max(1, Math.floor((latestTs - actualSeries[0].ts) / oneDayMs)))
    } as Record<string, number>;
  }, [actualSeries, performanceView]);

  useEffect(() => {
    if (chartSeries.length === 0) {
      setBrushRange({ startIndex: 0, endIndex: 0 });
      return;
    }

    const endIndex = chartSeries.length - 1;
    const latestTs = Number(chartSeries[endIndex]?.ts || 0);
    const oneDayMs = 24 * 60 * 60 * 1000;
    const startOfYearTs = new Date(new Date(latestTs).getFullYear(), 0, 1).getTime();
    const thresholdTs =
      zoomPreset === '1m'
        ? latestTs - oneDayMs * 30
        : zoomPreset === '1y'
        ? latestTs - oneDayMs * 365
        : zoomPreset === 'ytd'
        ? startOfYearTs
        : Number.NEGATIVE_INFINITY;
    const startIndex =
      zoomPreset === 'max'
        ? 0
        : Math.max(
            0,
            chartSeries.findIndex((point) => Number(point.ts) >= thresholdTs)
          );
    setBrushRange({ startIndex, endIndex });
  }, [chartSeries.length, zoomPreset]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <div className="mx-auto max-w-6xl px-6 py-10 space-y-6">
        <GlassPanel className="overflow-hidden rounded-2xl">
          <BreakingNewsBanner />
        </GlassPanel>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MetallicLogo size={32} />
            <h1 className="text-2xl font-semibold">Trader Profile</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/" className="rounded-full border border-slate-700 px-4 py-2 text-sm hover:border-slate-500">
              Dashboard
            </Link>
            <Link to="/leaderboard" className="rounded-full border border-slate-700 px-4 py-2 text-sm hover:border-slate-500">
              Leaderboard
            </Link>
          </div>
        </div>

        <GlassPanel className="rounded-2xl p-4 text-sm text-slate-300">
          Address: <span className="font-mono break-all text-slate-100">{address}</span>
        </GlassPanel>

        {profileSummary && (
          <GlassPanel className="rounded-2xl p-4">
            <div className="flex flex-wrap items-center gap-4">
              {profileSummary.avatarUrl && (
                <img
                  src={profileSummary.avatarUrl}
                  alt={`${profileSummary.displayName} avatar`}
                  className="h-12 w-12 rounded-full object-cover border border-slate-700"
                  loading="lazy"
                />
              )}
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold text-slate-100">{profileSummary.displayName}</p>
                <p className="truncate text-xs text-slate-400">
                  {profileSummary.username ? `@${profileSummary.username}` : profileSummary.address}
                </p>
                {profileSummary.polymarketUrl && (
                  <a
                    href={profileSummary.polymarketUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-flex text-xs font-semibold text-blue-300 hover:text-blue-200 hover:underline"
                  >
                    View on Polymarket
                  </a>
                )}
              </div>
              <div className="ml-auto flex flex-wrap items-center gap-3 text-xs text-slate-400">
                {typeof profileSummary.rank === 'number' && <span>Rank #{profileSummary.rank}</span>}
                {typeof profileSummary.roi === 'number' && <span>ROI {profileSummary.roi.toFixed(1)}%</span>}
                {typeof profileSummary.pnl === 'number' && <span>PnL {formatUsd(profileSummary.pnl)}</span>}
              </div>
            </div>
          </GlassPanel>
        )}

        <GlassPanel className="rounded-2xl p-3">
          <div className="flex flex-wrap items-center gap-2">
            {[
              { key: 'today', label: 'Today' },
              { key: 'weekly', label: 'This Week' },
              { key: 'monthly', label: 'This Month' },
              { key: 'all', label: 'All Time' }
            ].map((option) => {
              const active = period === option.key;
              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setPeriod(option.key as 'today' | 'weekly' | 'monthly' | 'all')}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    active
                      ? 'bg-blue-600 text-white shadow shadow-blue-500/30'
                      : 'border border-slate-700 text-slate-300 hover:border-slate-500'
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </GlassPanel>

        {leaderboardContext && (
          <GlassPanel className="rounded-2xl p-4">
            <div className="flex flex-wrap items-center gap-4 text-sm text-slate-300">
              <span className="font-semibold text-slate-100">
                {leaderboardContext.displayName || 'Trader'}
              </span>
              {typeof leaderboardContext.rank === 'number' && <span>Rank #{leaderboardContext.rank}</span>}
              {typeof leaderboardContext.roi === 'number' && <span>ROI {leaderboardContext.roi.toFixed(1)}%</span>}
              {typeof leaderboardContext.pnl === 'number' && <span>P&L {formatUsd(leaderboardContext.pnl)}</span>}
              {typeof leaderboardContext.volume === 'number' && <span>Volume {formatUsd(leaderboardContext.volume)}</span>}
            </div>
          </GlassPanel>
        )}

        {loading && <GlassPanel className="rounded-2xl p-4">Loading…</GlassPanel>}
        {error && <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 text-rose-200">{error}</div>}

        {!loading && !error && (
          <>
            <section className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
              <div className="rounded-2xl border border-slate-800/60 bg-slate-950/70 p-4">
                <p className="text-xs uppercase text-slate-500">PnL</p>
                <p className={`mt-2 text-xl font-semibold ${(pnl?.pnl ?? 0) >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                  {formatUsd(pnl?.pnl ?? null)}
                </p>
                {pnl?.calculation && <p className="mt-1 text-xs text-slate-500">Method: {pnl.calculation}</p>}
              </div>
              <div className="rounded-2xl border border-slate-800/60 bg-slate-950/70 p-4">
                <p className="text-xs uppercase text-slate-500">Portfolio Value</p>
                <p className="mt-2 text-xl font-semibold text-slate-100">{formatUsd(portfolio?.portfolioValue ?? null)}</p>
              </div>
              <div className="rounded-2xl border border-slate-800/60 bg-slate-950/70 p-4">
                <p className="text-xs uppercase text-slate-500">Trades Loaded</p>
                <p className="mt-2 text-xl font-semibold text-slate-100">{pnl?.tradeCount ?? trades.length}</p>
              </div>
              <div className="rounded-2xl border border-slate-800/60 bg-slate-950/70 p-4">
                <p className="text-xs uppercase text-slate-500">Total Notional</p>
                <p className="mt-2 text-xl font-semibold text-slate-100">{formatUsd(derivedMetrics.totalNotional)}</p>
              </div>
              <div className="rounded-2xl border border-slate-800/60 bg-slate-950/70 p-4">
                <p className="text-xs uppercase text-slate-500">Markets Traded</p>
                <p className="mt-2 text-xl font-semibold text-slate-100">{derivedMetrics.marketCount}</p>
                <p className="mt-1 text-xs text-slate-500">
                  Buys {derivedMetrics.buyCount} · Sells {derivedMetrics.sellCount}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-800/60 bg-slate-950/70 p-4">
                <p className="text-xs uppercase text-slate-500">Avg Trade Size</p>
                <p className="mt-2 text-xl font-semibold text-slate-100">
                  {Number.isFinite(derivedMetrics.avgTradeSize) ? derivedMetrics.avgTradeSize.toFixed(2) : '—'}
                </p>
                <p className="mt-1 text-xs text-slate-500">{derivedMetrics.lastTradeAt ? `Last trade: ${derivedMetrics.lastTradeAt}` : 'No recency data'}</p>
              </div>
            </section>

            <section className="space-y-3 rounded-2xl border border-slate-800/60 bg-slate-950/70 p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Performance Curve</h2>
                <p className="text-xs text-slate-400">
                  {usesAnalyticsHistory ? 'Analytics history from cached leaderboard snapshots' : 'Trade-derived PnL from fill history'}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-slate-400">Portfolio Performance</span>
                <button
                  type="button"
                  onClick={() => setPerformanceView('current')}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                    performanceView === 'current' ? 'bg-blue-600 text-white' : 'border border-slate-700 text-slate-300 hover:border-slate-500'
                  }`}
                >
                  Current
                </button>
                <button
                  type="button"
                  onClick={() => setPerformanceView('average')}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                    performanceView === 'average' ? 'bg-blue-600 text-white' : 'border border-slate-700 text-slate-300 hover:border-slate-500'
                  }`}
                >
                  Average
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs sm:grid-cols-6">
                {[
                  { key: 'd1', label: '1D' },
                  { key: 'w1', label: '1W' },
                  { key: 'm1', label: '1M' },
                  { key: 'ytd', label: 'YTD' },
                  { key: 'y1', label: '1Y' },
                  { key: 'max', label: 'MAX' }
                ].map((entry) => {
                  const value = performanceStats[entry.key];
                  return (
                    <div key={entry.key} className="rounded-xl border border-slate-800/70 bg-slate-900/50 px-2 py-2">
                      <p className="uppercase text-slate-500">{entry.label}</p>
                      <p className={`mt-1 font-semibold ${value !== null && value >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                        {value === null ? '—' : `${formatUsd(value)}${performanceView === 'average' ? '/day' : ''}`}
                      </p>
                    </div>
                  );
                })}
              </div>
              {usesAnalyticsHistory && analyticsDeltas && (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full border border-slate-700 px-2 py-1 text-slate-300">
                    24h PnL {formatUsd(analyticsDeltas.pnl24h)}
                  </span>
                  <span className="rounded-full border border-slate-700 px-2 py-1 text-slate-300">
                    7d PnL {formatUsd(analyticsDeltas.pnl7d)}
                  </span>
                  <span className="rounded-full border border-slate-700 px-2 py-1 text-slate-300">
                    24h Vol {formatUsd(analyticsDeltas.volume24h)}
                  </span>
                  <span className="rounded-full border border-slate-700 px-2 py-1 text-slate-300">
                    7d Vol {formatUsd(analyticsDeltas.volume7d)}
                  </span>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2">
                {[
                  { key: '1m', label: '1M' },
                  { key: '1y', label: '1Y' },
                  { key: 'ytd', label: 'YTD' },
                  { key: 'max', label: 'Max' }
                ].map((option) => {
                  const active = zoomPreset === option.key;
                  return (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => setZoomPreset(option.key as '1m' | '1y' | 'ytd' | 'max')}
                      className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                        active ? 'bg-blue-600 text-white' : 'border border-slate-700 text-slate-300 hover:border-slate-500'
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
                <div className="ml-auto flex flex-wrap items-center gap-2">
                  <span className="text-xs text-slate-400">Projection</span>
                  <button
                    type="button"
                    onClick={() => setProjectionEnabled((prev) => !prev)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                      projectionEnabled ? 'bg-blue-600 text-white' : 'border border-slate-700 text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    {projectionEnabled ? '180D On' : '180D Off'}
                  </button>
                  {projectionEnabled &&
                    [
                      { key: 'conservative', label: 'Conservative' },
                      { key: 'base', label: 'Base' },
                      { key: 'aggressive', label: 'Aggressive' }
                    ].map((option) => {
                      const active = projectionMode === option.key;
                      return (
                        <button
                          key={option.key}
                          type="button"
                          onClick={() => setProjectionMode(option.key as 'conservative' | 'base' | 'aggressive')}
                          className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                            active ? 'bg-slate-200 text-slate-900' : 'border border-slate-700 text-slate-300 hover:border-slate-500'
                          }`}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                </div>
              </div>
              {chartSeries.length > 1 ? (
                <div className="h-[360px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartSeries}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                      <XAxis dataKey="label" minTickGap={24} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                      <YAxis
                        tick={{ fill: '#94a3b8', fontSize: 11 }}
                        tickFormatter={(value) =>
                          Number(value).toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
                        }
                      />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#020617', border: '1px solid #334155', borderRadius: 10 }}
                        labelStyle={{ color: '#cbd5e1' }}
                        formatter={(value: number | null) =>
                          value === null
                            ? '—'
                            : value.toLocaleString(undefined, {
                                style: 'currency',
                                currency: 'USD',
                                maximumFractionDigits: 2
                              })
                        }
                      />
                      <Legend />
                      <Line type="monotone" dataKey="actualPnl" stroke="#22c55e" strokeWidth={2.3} dot={false} name="Actual PnL" />
                      <Line
                        type="monotone"
                        dataKey="projectedPnl"
                        stroke="#60a5fa"
                        strokeWidth={2}
                        strokeDasharray="8 5"
                        dot={false}
                        name="Projected (180d)"
                      />
                      <Brush
                        dataKey="label"
                        startIndex={brushRange.startIndex}
                        endIndex={brushRange.endIndex}
                        onChange={(next) => {
                          const startIndex = Number.isFinite(Number(next?.startIndex)) ? Number(next.startIndex) : 0;
                          const endIndex = Number.isFinite(Number(next?.endIndex))
                            ? Number(next.endIndex)
                            : Math.max(0, chartSeries.length - 1);
                          setBrushRange({ startIndex, endIndex });
                          setZoomPreset('custom');
                        }}
                        height={24}
                        stroke="#334155"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-sm text-slate-400">Not enough trade points to render performance curve.</p>
              )}
            </section>

            <section className="space-y-3 rounded-2xl border border-slate-800/60 bg-slate-950/70 p-4">
              <h2 className="text-lg font-semibold">Open Positions (Derived)</h2>
              {openOrders?.note && <p className="text-xs text-slate-500">{openOrders.note}</p>}
              {openOrders?.openOrders?.length ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-slate-400">
                        <th className="px-3 py-2">Market</th>
                        <th className="px-3 py-2">Side</th>
                        <th className="px-3 py-2 text-right">Size</th>
                        <th className="px-3 py-2 text-right">Avg Price</th>
                        <th className="px-3 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {openOrders.openOrders.map((order, index) => (
                        <tr key={`${order.market || 'market'}-${index}`} className="border-t border-slate-800/60">
                          <td className="px-3 py-2">{order.market || 'Unknown'}</td>
                          <td className="px-3 py-2 uppercase">{order.side || '—'}</td>
                          <td className="px-3 py-2 text-right">{typeof order.size === 'number' ? order.size.toFixed(4) : '—'}</td>
                          <td className="px-3 py-2 text-right">{typeof order.price === 'number' ? order.price.toFixed(4) : '—'}</td>
                          <td className="px-3 py-2">{order.status || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-slate-400">No open positions found.</p>
              )}
            </section>

            <section className="space-y-3 rounded-2xl border border-slate-800/60 bg-slate-950/70 p-4">
              <h2 className="text-lg font-semibold">Trade History</h2>
              {tradeRows.length ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-slate-400">
                        <th className="px-3 py-2">Date</th>
                        <th className="px-3 py-2">Market</th>
                        <th className="px-3 py-2">Side</th>
                        <th className="px-3 py-2 text-right">Size</th>
                        <th className="px-3 py-2 text-right">Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tradeRows.map((row) => (
                        <tr key={row.id} className="border-t border-slate-800/60">
                          <td className="px-3 py-2">{row.date ? new Date(row.date).toLocaleString() : '—'}</td>
                          <td className="px-3 py-2">{row.market}</td>
                          <td className="px-3 py-2">{row.side}</td>
                          <td className="px-3 py-2 text-right">{Number.isFinite(row.size) ? row.size.toFixed(4) : '—'}</td>
                          <td className="px-3 py-2 text-right">{Number.isFinite(row.price) ? row.price.toFixed(4) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-slate-400">No trades found.</p>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
