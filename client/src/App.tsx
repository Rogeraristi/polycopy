import { useCallback, useEffect, useMemo, useState } from 'react';
import { BrowserRouter as Router, Link, Navigate, Route, Routes } from 'react-router-dom';
import { HeaderBar } from './components/HeaderBar';
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

  const {
    trades,
    isLoading: isTradesLoading,
    error: tradesError,
    latencyMs
  } = useLiveTrades(selectedAddress);

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
  }, []);

  const applySelectedAddress = useCallback((address: string) => {
    const sanitized = address.trim().toLowerCase();
    setSelectedAddress(sanitized || null);
    setCopyResult(null);
    setCopyError(null);
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
  }, [disconnectWallet]);

  const periodOptions = useMemo(() => {
    return Object.keys(leaderboardPeriods).map((key) => ({
      key,
      label: leaderboardLabels[key] || key
    }));
  }, [leaderboardPeriods, leaderboardLabels]);

  const activeEntries = leaderboardPeriods[activeLeaderboardPeriod] || [];
  const combinedTopError = sessionError || walletError;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <div className="mx-auto max-w-6xl px-6 py-10 space-y-8">
        <HeaderBar
          user={user}
          isSessionLoading={isSessionLoading}
          isSessionActionPending={isSessionActionPending}
          onLogin={login}
          onLogout={logout}
          walletAddress={connectedWallet}
          walletChainId={walletChainId}
          isWalletConnecting={isWalletConnecting}
          isWalletConnected={isWalletConnected}
          walletProviderAvailable={walletProviderAvailable}
          onConnectWallet={connectWallet}
          onDisconnectWallet={handleDisconnectWallet}
        />

        {combinedTopError && (
          <div className="flex items-start justify-between gap-3 rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            <p>{combinedTopError}</p>
            {walletError && (
              <button
                type="button"
                onClick={resetWalletError}
                className="rounded-full border border-rose-400/50 px-3 py-1 text-xs font-semibold text-rose-50 transition hover:border-rose-200"
              >
                Dismiss
              </button>
            )}
          </div>
        )}

        <section className="rounded-3xl border border-slate-800/60 bg-slate-950/70 p-6">
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
        </section>

        {selectedAddress && (
          <div className="flex items-center justify-between rounded-2xl border border-slate-800/60 bg-slate-950/70 px-4 py-3 text-sm">
            <div className="text-slate-300">
              Selected trader: <span className="font-mono text-slate-100">{selectedAddress}</span>
            </div>
            <Link
              to={`/profile/${selectedAddress}`}
              className="rounded-full border border-primary/60 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary transition hover:border-primary hover:bg-primary/20"
            >
              Open Profile
            </Link>
          </div>
        )}

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

        <section className="space-y-4 rounded-3xl border border-slate-800/60 bg-slate-950/70 p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-lg font-semibold text-slate-100">Live trade feed</h3>
            <LatencyBadge latencyMs={latencyMs} />
          </div>

          <div className="flex items-center gap-3">
            <label htmlFor="sizeMultiplier" className="text-sm text-slate-300">
              Size multiplier
            </label>
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
              className="w-28 rounded-xl border border-slate-700/70 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {copyError && <p className="text-sm text-rose-300">{copyError}</p>}
          {tradesError && <p className="text-sm text-rose-300">{tradesError}</p>}
          {isTradesLoading && <p className="text-sm text-slate-400">Loading trades…</p>}

          <TradeList trades={selectedAddress ? trades : []} onCopy={handleCopyTrade} isCopying={isCopying} canCopy={isWalletConnected} />
        </section>

        {copyResult && (
          <section className="rounded-2xl border border-emerald-400/40 bg-emerald-500/10 p-4 text-sm text-emerald-100">
            <p className="font-semibold text-emerald-200">Prepared order</p>
            <p className="mt-1 text-emerald-100/80">{copyResult.message || 'Order payload generated successfully.'}</p>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-xs text-emerald-100/90">
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
          </section>
        )}

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
