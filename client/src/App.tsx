import { useCallback, useEffect, useMemo, useState } from 'react';
import { BrowserRouter as Router, Link, Navigate, Route, Routes } from 'react-router-dom';
import { LatencyBadge } from './components/LatencyBadge';
import { Leaderboard, type LeaderboardEntry } from './components/Leaderboard';
import { TradeList } from './components/TradeList';
import { TraderDashboard } from './components/TraderDashboard';
import { TraderSearch } from './components/TraderSearch';
import { useLiveTrades, type Trade } from './hooks/useLiveTrades';
import { useSession } from './hooks/useSession';
import { useTraderSearch } from './hooks/useTraderSearch';
import { useWalletConnection } from './hooks/useWalletConnection';
import TraderProfile from './pages/TraderProfile';

interface CopyTradeOrder {
  marketId?: string;
  outcome?: string;
  price?: number;
  size?: number;
  side?: string;
  copiedFrom?: string;
  timestamp?: number;
}

interface CopyTradeResult {
  order: CopyTradeOrder;
  message?: string;
  sourceTrade: Trade;
}

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';
const REAL_COPY_EXECUTION_ENABLED = String(import.meta.env.VITE_FEATURE_REAL_COPY_EXECUTION || '').toLowerCase() === 'true';

function shortAddress(address: string | null) {
  if (!address) return 'Not connected';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function DashboardPage() {
  const [inputAddress, setInputAddress] = useState('');
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
  const [leaderboardPeriods, setLeaderboardPeriods] = useState<Record<string, LeaderboardEntry[]>>({});
  const [leaderboardLabels, setLeaderboardLabels] = useState<Record<string, string>>({});
  const [activeLeaderboardPeriod, setActiveLeaderboardPeriod] = useState<string>('weekly');
  const [isLeaderboardLoading, setIsLeaderboardLoading] = useState(true);
  const [leaderboardError, setLeaderboardError] = useState<string | null>(null);
  const [sizeMultiplier, setSizeMultiplier] = useState<number>(1);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [copyResult, setCopyResult] = useState<CopyTradeResult | null>(null);
  const [isCopying, setIsCopying] = useState(false);
  const [isExecutingCopy, setIsExecutingCopy] = useState(false);
  const [executeCopyError, setExecuteCopyError] = useState<string | null>(null);
  const [executeCopyResult, setExecuteCopyResult] = useState<string | null>(null);

  const {
    user,
    isLoading: isSessionLoading,
    isActionPending: isSessionActionPending,
    error: sessionError,
    login,
    logout
  } = useSession();

  const {
    address: connectedWallet,
    chainId: walletChainId,
    isConnecting: isWalletConnecting,
    isConnected: isWalletConnected,
    providerAvailable: walletProviderAvailable,
    error: walletError,
    connect: connectWallet,
    disconnect: disconnectWallet,
    resetError: resetWalletError
  } = useWalletConnection();

  const { trades, isLoading: isTradesLoading, error: tradesError, latencyMs } = useLiveTrades(selectedAddress);

  const {
    suggestions: searchedTraders,
    isLoading: isSearchingTraders,
    error: traderSearchError
  } = useTraderSearch(inputAddress, {
    minimumLength: 2,
    debounceMs: 240,
    limit: 8
  });

  useEffect(() => {
    const controller = new AbortController();
    let isActive = true;

    setIsLeaderboardLoading(true);
    setLeaderboardError(null);

    fetch(`${API_BASE}/leaderboard`, { signal: controller.signal, credentials: 'include' })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`Failed to load leaderboard (${res.status})`))))
      .then((data) => {
        if (!isActive) return;

        const rawPeriods = data?.periods && typeof data.periods === 'object' ? data.periods : {};
        const rawLabels = data?.labels && typeof data.labels === 'object' ? data.labels : {};

        const nextPeriods = Object.entries(rawPeriods).reduce<Record<string, LeaderboardEntry[]>>((acc, [key, value]) => {
          if (!Array.isArray(value)) return acc;
          const filtered = value
            .filter((entry) => entry && typeof entry.address === 'string')
            .map((entry, index) => ({
              ...entry,
              rank: Number.isFinite(Number(entry.rank)) ? Number(entry.rank) : index + 1,
              address: entry.address.toLowerCase()
            }));
          if (filtered.length > 0) {
            acc[key] = filtered;
          }
          return acc;
        }, {});

        const availableKeys = Object.keys(nextPeriods);
        const preferred =
          (typeof data?.defaultPeriod === 'string' && availableKeys.includes(data.defaultPeriod) && data.defaultPeriod) ||
          (availableKeys.includes('weekly') && 'weekly') ||
          availableKeys[0] ||
          'weekly';

        setLeaderboardPeriods(nextPeriods);
        setLeaderboardLabels(
          availableKeys.reduce<Record<string, string>>((acc, key) => {
            acc[key] = rawLabels[key] || key;
            return acc;
          }, {})
        );
        setActiveLeaderboardPeriod(preferred);

        if (!selectedAddress && availableKeys.length > 0 && nextPeriods[preferred]?.[0]?.address) {
          const topAddress = nextPeriods[preferred][0].address;
          setSelectedAddress(topAddress);
          setInputAddress(topAddress);
        }
      })
      .catch((err) => {
        if (!isActive) return;
        setLeaderboardPeriods({});
        setLeaderboardLabels({});
        setLeaderboardError(err instanceof Error ? err.message : 'Failed to load leaderboard');
      })
      .finally(() => {
        if (!isActive) return;
        setIsLeaderboardLoading(false);
      });

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [selectedAddress]);

  const applySelectedAddress = useCallback((address: string) => {
    const sanitized = address.trim().toLowerCase();
    setSelectedAddress(sanitized || null);
    setCopyResult(null);
    setCopyError(null);
    setExecuteCopyError(null);
    setExecuteCopyResult(null);
  }, []);

  const handleCopyTrade = useCallback(
    async (trade: Trade) => {
      if (!connectedWallet) {
        setCopyError('Connect your wallet to mirror this trade.');
        setCopyResult(null);
        return;
      }

      setIsCopying(true);
      setCopyError(null);

      try {
        const multiplier = Number(sizeMultiplier) > 0 ? Number(sizeMultiplier) : 1;
        const response = await fetch(`${API_BASE}/copy-trade`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            trade,
            targetWallet: connectedWallet,
            sizeMultiplier: multiplier
          })
        });

        if (!response.ok) {
          const text = await response.text();
          throw new Error(text || `Copy trade failed (${response.status})`);
        }

        const payload = await response.json();
        if (!payload?.order) {
          throw new Error('Copy trade did not return an order payload.');
        }

        setCopyResult({
          order: payload.order,
          message: payload.message,
          sourceTrade: trade
        });
        setExecuteCopyError(null);
        setExecuteCopyResult(null);
      } catch (err) {
        setCopyResult(null);
        setCopyError(err instanceof Error ? err.message : 'Failed to prepare copy trade payload.');
      } finally {
        setIsCopying(false);
      }
    },
    [connectedWallet, sizeMultiplier]
  );

  const handleDisconnectWallet = useCallback(() => {
    disconnectWallet();
    setCopyResult(null);
    setCopyError(null);
    setExecuteCopyError(null);
    setExecuteCopyResult(null);
  }, [disconnectWallet]);

  const handleExecuteCopyTrade = useCallback(async () => {
    if (!copyResult) {
      setExecuteCopyError('No prepared order found.');
      return;
    }
    if (!connectedWallet) {
      setExecuteCopyError('Connect your wallet before executing.');
      return;
    }

    setIsExecutingCopy(true);
    setExecuteCopyError(null);
    setExecuteCopyResult(null);

    try {
      const response = await fetch(`${API_BASE}/copy-trade/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          order: copyResult.order,
          targetWallet: connectedWallet,
          sourceTrade: copyResult.sourceTrade
        })
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const message =
          (payload && (payload.error || payload.details?.error || payload.details?.message)) ||
          `Execution failed (${response.status})`;
        throw new Error(typeof message === 'string' ? message : 'Execution failed');
      }

      const summary =
        payload?.result?.status ||
        payload?.result?.id ||
        payload?.result?.orderId ||
        payload?.result?.txHash ||
        'Copy order sent to executor successfully.';
      setExecuteCopyResult(String(summary));
    } catch (err) {
      setExecuteCopyError(err instanceof Error ? err.message : 'Execution failed');
    } finally {
      setIsExecutingCopy(false);
    }
  }, [copyResult, connectedWallet]);

  const handleSessionClick = useCallback(() => {
    if (user) {
      void logout();
    } else {
      login();
    }
  }, [user, logout, login]);

  const handleWalletClick = useCallback(() => {
    if (!walletProviderAvailable) return;
    if (isWalletConnected) {
      handleDisconnectWallet();
    } else {
      void connectWallet();
    }
  }, [walletProviderAvailable, isWalletConnected, handleDisconnectWallet, connectWallet]);

  const periodOptions = useMemo(() => {
    return Object.keys(leaderboardPeriods).map((key) => ({ key, label: leaderboardLabels[key] || key }));
  }, [leaderboardPeriods, leaderboardLabels]);

  const activeEntries = leaderboardPeriods[activeLeaderboardPeriod] || [];
  const combinedTopError = sessionError || walletError;

  return (
    <div className="min-h-screen bg-[#040712] text-slate-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top,rgba(49,114,255,0.22),transparent_52%)]" />
      <div className="relative mx-auto max-w-7xl px-6 pb-20 pt-8 space-y-16">
        <header className="rounded-2xl border border-slate-800/70 bg-slate-950/70 px-6 py-4 backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400" />
                <div>
                  <p className="text-sm font-semibold tracking-wide text-white">PolyCopy</p>
                  <p className="text-xs text-slate-400">Built for Polymarket</p>
                </div>
              </div>
              <nav className="hidden md:flex items-center gap-6 text-sm text-slate-300">
                <a href="#top-traders" className="hover:text-white transition">Top Traders</a>
                <a href="#search" className="hover:text-white transition">Search Traders</a>
                <a href="#analyze" className="hover:text-white transition">Analyze Trader</a>
              </nav>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleSessionClick}
                disabled={isSessionLoading || isSessionActionPending}
                className="rounded-full border border-slate-700/80 bg-slate-900/80 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-slate-500 disabled:opacity-60"
              >
                {isSessionLoading ? 'Loading...' : user ? 'Sign out' : 'Sign in'}
              </button>
              <button
                type="button"
                onClick={handleWalletClick}
                disabled={isWalletConnecting || !walletProviderAvailable}
                className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60"
              >
                {isWalletConnecting ? 'Connecting...' : isWalletConnected ? shortAddress(connectedWallet) : 'Connect Wallet'}
              </button>
            </div>
          </div>
        </header>

        <section className="text-center space-y-6">
          <p className="inline-flex rounded-full border border-blue-400/30 bg-blue-500/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-blue-200">
            Risk-first copy trading
          </p>
          <h1 className="mx-auto max-w-4xl text-4xl font-semibold leading-tight text-white sm:text-6xl">
            Discover top traders and copy their moves in seconds
          </h1>
          <p className="mx-auto max-w-2xl text-base text-slate-300 sm:text-lg">
            Follow the same flow as PredictFolio: find profitable wallets, inspect behavior, then mirror with your size rules.
          </p>
          <div className="flex justify-center gap-3">
            <a href="#top-traders" className="rounded-full bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-500">
              View Top Traders
            </a>
            <a href="#search" className="rounded-full border border-slate-600 px-6 py-3 text-sm font-semibold text-slate-100 transition hover:border-slate-400">
              Search Traders
            </a>
          </div>
        </section>

        {combinedTopError && (
          <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{combinedTopError}</div>
        )}

        <section className="grid gap-5 lg:grid-cols-3">
          <article id="top-traders" className="rounded-3xl border border-slate-800/60 bg-slate-950/70 p-6">
            <p className="text-xs uppercase tracking-wide text-blue-200">View Top Traders</p>
            <h2 className="mt-3 text-2xl font-semibold text-white">Find high-performing wallets quickly</h2>
            <p className="mt-3 text-sm text-slate-300">Browse ranked traders by ROI and PnL, then select one to start analysis.</p>
            <a href="#leaderboard" className="mt-5 inline-flex rounded-full bg-white px-5 py-2 text-sm font-semibold text-slate-900">Open Leaderboard</a>
          </article>

          <article id="search" className="rounded-3xl border border-slate-800/60 bg-slate-950/70 p-6">
            <p className="text-xs uppercase tracking-wide text-blue-200">Search Traders</p>
            <h2 className="mt-3 text-2xl font-semibold text-white">Find any wallet or username</h2>
            <p className="mt-3 text-sm text-slate-300">Use direct search when you already know the trader you want to track.</p>
            <div className="mt-5">
              <TraderSearch
                value={inputAddress}
                onChange={setInputAddress}
                onSubmit={(nextValue) => {
                  setInputAddress(nextValue.trim().toLowerCase());
                  applySelectedAddress(nextValue);
                }}
                suggestions={searchedTraders}
                isSearching={isSearchingTraders}
                searchError={traderSearchError}
                selectedAddress={selectedAddress}
              />
            </div>
          </article>

          <article id="analyze" className="rounded-3xl border border-slate-800/60 bg-slate-950/70 p-6">
            <p className="text-xs uppercase tracking-wide text-blue-200">Analyze Traders</p>
            <h2 className="mt-3 text-2xl font-semibold text-white">Drill into portfolio and history</h2>
            <p className="mt-3 text-sm text-slate-300">Inspect each trader profile before mirroring their positions.</p>
            <div className="mt-5 rounded-2xl border border-slate-700/70 bg-slate-900/60 p-4">
              <p className="text-xs uppercase text-slate-400">Selected trader</p>
              <p className="mt-1 font-mono text-sm text-slate-100 break-all">{selectedAddress || 'No trader selected yet'}</p>
              {selectedAddress && (
                <Link
                  to={`/profile/${selectedAddress}`}
                  className="mt-3 inline-flex rounded-full border border-blue-400/50 px-4 py-2 text-xs font-semibold text-blue-200"
                >
                  Open profile
                </Link>
              )}
            </div>
          </article>
        </section>

        <section id="leaderboard" className="grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
          <div className="space-y-5">
            <Leaderboard
              entries={activeEntries}
              isLoading={isLeaderboardLoading}
              error={leaderboardError}
              selectedAddress={selectedAddress}
              onSelect={(address) => {
                setInputAddress(address);
                applySelectedAddress(address);
              }}
              periodOptions={periodOptions}
              selectedPeriod={activeLeaderboardPeriod}
              onPeriodChange={(next) => {
                if (leaderboardPeriods[next]) {
                  setActiveLeaderboardPeriod(next);
                }
              }}
            />
          </div>

          <div className="space-y-5">
            <section className="rounded-3xl border border-slate-800/60 bg-slate-950/70 p-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">Live Trade Feed</h3>
                <LatencyBadge latencyMs={latencyMs} />
              </div>
              <div className="mt-4 flex items-center gap-3">
                <label htmlFor="sizeMultiplier" className="text-sm text-slate-300">Size multiplier</label>
                <input
                  id="sizeMultiplier"
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={sizeMultiplier}
                  onChange={(event) => {
                    const parsed = Number(event.target.value);
                    setSizeMultiplier(Number.isFinite(parsed) && parsed > 0 ? parsed : 1);
                  }}
                  className="w-24 rounded-xl border border-slate-700/70 bg-slate-900/70 px-3 py-2 text-sm text-slate-100"
                />
              </div>
              {copyError && <p className="mt-3 text-sm text-rose-300">{copyError}</p>}
              {tradesError && <p className="mt-3 text-sm text-rose-300">{tradesError}</p>}
              {isTradesLoading && <p className="mt-3 text-sm text-slate-400">Loading trades...</p>}
              <div className="mt-4">
                <TradeList trades={selectedAddress ? trades : []} onCopy={handleCopyTrade} isCopying={isCopying} canCopy={isWalletConnected} />
              </div>
            </section>

            {copyResult && (
              <section className="rounded-3xl border border-emerald-400/30 bg-emerald-500/10 p-6 text-sm text-emerald-100">
                <p className="font-semibold text-emerald-200">Prepared order</p>
                <p className="mt-1 text-emerald-100/80">{copyResult.message || 'Order payload generated successfully.'}</p>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <dt className="uppercase text-emerald-300/80">Market</dt>
                    <dd className="font-mono text-[13px]">{copyResult.order.marketId || 'n/a'}</dd>
                  </div>
                  <div>
                    <dt className="uppercase text-emerald-300/80">Outcome</dt>
                    <dd className="font-semibold">{copyResult.order.outcome || 'n/a'}</dd>
                  </div>
                  <div>
                    <dt className="uppercase text-emerald-300/80">Side</dt>
                    <dd className="font-semibold">{(copyResult.order.side || '').toUpperCase() || 'n/a'}</dd>
                  </div>
                  <div>
                    <dt className="uppercase text-emerald-300/80">Size</dt>
                    <dd className="font-semibold">{copyResult.order.size ?? 'n/a'}</dd>
                  </div>
                </dl>

                {REAL_COPY_EXECUTION_ENABLED ? (
                  <div className="mt-4 space-y-2">
                    <button
                      type="button"
                      onClick={handleExecuteCopyTrade}
                      disabled={isExecutingCopy || !isWalletConnected}
                      className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60"
                    >
                      {isExecutingCopy ? 'Executing...' : 'Execute Copy Order'}
                    </button>
                    {executeCopyError && <p className="text-sm text-rose-200">{executeCopyError}</p>}
                    {executeCopyResult && <p className="text-sm text-emerald-100">{executeCopyResult}</p>}
                  </div>
                ) : (
                  <p className="mt-4 text-xs text-emerald-200/80">Enable VITE_FEATURE_REAL_COPY_EXECUTION=true for live execution.</p>
                )}
              </section>
            )}
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <article className="rounded-2xl border border-slate-800/60 bg-slate-950/70 p-5">
            <h3 className="text-lg font-semibold text-white">Copy Trades Instantly</h3>
            <p className="mt-2 text-sm text-slate-300">Mirror top wallet executions with your configured position multiplier.</p>
          </article>
          <article className="rounded-2xl border border-slate-800/60 bg-slate-950/70 p-5">
            <h3 className="text-lg font-semibold text-white">Analyze Trader Performance</h3>
            <p className="mt-2 text-sm text-slate-300">Inspect profiles, activity, and derived positions before you copy.</p>
          </article>
          <article className="rounded-2xl border border-slate-800/60 bg-slate-950/70 p-5">
            <h3 className="text-lg font-semibold text-white">Manage Risk Better</h3>
            <p className="mt-2 text-sm text-slate-300">Apply sizing rules and review each order payload before submission.</p>
          </article>
        </section>

        <section className="rounded-3xl border border-slate-800/60 bg-slate-950/70 p-6">
          <h3 className="text-xl font-semibold text-white">Platform stats</h3>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-700/70 bg-slate-900/70 p-4">
              <p className="text-xs uppercase text-slate-400">Tracked traders</p>
              <p className="mt-1 text-2xl font-semibold text-white">{activeEntries.length}</p>
            </div>
            <div className="rounded-xl border border-slate-700/70 bg-slate-900/70 p-4">
              <p className="text-xs uppercase text-slate-400">Live trades loaded</p>
              <p className="mt-1 text-2xl font-semibold text-white">{trades.length}</p>
            </div>
            <div className="rounded-xl border border-slate-700/70 bg-slate-900/70 p-4">
              <p className="text-xs uppercase text-slate-400">Wallet status</p>
              <p className="mt-1 text-2xl font-semibold text-white">{isWalletConnected ? 'Connected' : 'Offline'}</p>
            </div>
            <div className="rounded-xl border border-slate-700/70 bg-slate-900/70 p-4">
              <p className="text-xs uppercase text-slate-400">Chain</p>
              <p className="mt-1 text-2xl font-semibold text-white">{walletChainId || '-'}</p>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-blue-400/30 bg-gradient-to-r from-blue-600/20 to-cyan-500/10 p-8 text-center">
          <h3 className="text-3xl font-semibold text-white">Ready to mirror smarter?</h3>
          <p className="mt-3 text-slate-200">Track, analyze, and copy top Polymarket traders in one interface.</p>
          <div className="mt-5 flex justify-center gap-3">
            <a href="#top-traders" className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-slate-900">Start Tracking</a>
            <a href="#search" className="rounded-full border border-white/50 px-6 py-3 text-sm font-semibold text-white">Search Trader</a>
          </div>
        </section>

        {selectedAddress && <TraderDashboard address={selectedAddress} />}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/profile/:address" element={<TraderProfile />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
