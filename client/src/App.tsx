import { useCallback, useEffect, useMemo, useState } from 'react';
import { BrowserRouter as Router, Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { Leaderboard, type LeaderboardEntry } from './components/Leaderboard';
import BreakingNewsBanner from './components/BreakingNewsBanner';
import { TraderDashboard } from './components/TraderDashboard';
import { TraderSearch } from './components/TraderSearch';
import MetallicLogo from './components/MetallicLogo';
import Beams from './components/effects/Beams';
import GlassPanel from './components/effects/GlassPanel';
import { useSession } from './hooks/useSession';
import { useTraderSearch } from './hooks/useTraderSearch';
import { useWalletConnection } from './hooks/useWalletConnection';
import TraderProfile from './pages/TraderProfile';
import MetallicLogoPreviewPage from './pages/MetallicLogoPreviewPage';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';
const OVERVIEW_PREFETCH_TTL_MS = 1000 * 60 * 3;
const overviewPrefetchCache = new Map<
  string,
  { expiresAt: number; promise: Promise<any> | null; data: any | null }
>();

function getOverviewCacheKey(address: string) {
  return `trader_overview_${address.toLowerCase()}`;
}

function persistOverview(address: string, payload: any) {
  const key = getOverviewCacheKey(address);
  const now = Date.now();
  overviewPrefetchCache.set(address.toLowerCase(), {
    expiresAt: now + OVERVIEW_PREFETCH_TTL_MS,
    promise: null,
    data: payload
  });
  if (typeof window !== 'undefined') {
    try {
      window.sessionStorage.setItem(key, JSON.stringify({ savedAt: now, payload }));
    } catch {}
  }
}

function prefetchTraderOverview(address: string) {
  const normalized = String(address || '').trim().toLowerCase();
  if (!normalized) return;
  const now = Date.now();
  const cached = overviewPrefetchCache.get(normalized);
  if (cached && cached.expiresAt > now) return;

  const promise = fetch(`${API_BASE}/users/${normalized}/overview`, { credentials: 'include' })
    .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`overview ${res.status}`))))
    .then((payload) => {
      persistOverview(normalized, payload);
      return payload;
    })
    .catch(() => null)
    .finally(() => {
      const current = overviewPrefetchCache.get(normalized);
      if (current && current.promise) {
        overviewPrefetchCache.set(normalized, { ...current, promise: null });
      }
    });

  overviewPrefetchCache.set(normalized, {
    expiresAt: now + OVERVIEW_PREFETCH_TTL_MS,
    promise,
    data: cached?.data || null
  });
}

function shortAddress(address: string | null) {
  if (!address) return 'Not connected';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function getUserInitials(name: string | null | undefined) {
  if (!name) return null;
  const parts = name.trim().split(/\s+/).slice(0, 2);
  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
}

function useLeaderboardData() {
  const [leaderboardPeriods, setLeaderboardPeriods] = useState<Record<string, LeaderboardEntry[]>>({});
  const [leaderboardLabels, setLeaderboardLabels] = useState<Record<string, string>>({});
  const [activeLeaderboardPeriod, setActiveLeaderboardPeriod] = useState<string>('weekly');
  const [isLeaderboardLoading, setIsLeaderboardLoading] = useState(true);
  const [leaderboardError, setLeaderboardError] = useState<string | null>(null);

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

  const periodOptions = useMemo(() => {
    return Object.keys(leaderboardPeriods).map((key) => ({ key, label: leaderboardLabels[key] || key }));
  }, [leaderboardPeriods, leaderboardLabels]);

  const activeEntries = leaderboardPeriods[activeLeaderboardPeriod] || [];

  return {
    activeEntries,
    periodOptions,
    selectedPeriod: activeLeaderboardPeriod,
    onPeriodChange: setActiveLeaderboardPeriod,
    isLoading: isLeaderboardLoading,
    error: leaderboardError
  };
}

interface TopNavProps {
  currentPath: '/' | '/leaderboard';
  advancedGlass?: boolean;
  user: ReturnType<typeof useSession>['user'];
  isSessionLoading: boolean;
  isSessionActionPending: boolean;
  login: () => void;
  logout: () => Promise<void>;
  connectedWallet: string | null;
  walletChainId: string | null;
  isWalletConnecting: boolean;
  isWalletConnected: boolean;
  walletProviderAvailable: boolean;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
}

function TopNav({
  currentPath,
  advancedGlass = false,
  user,
  isSessionLoading,
  isSessionActionPending,
  login,
  logout,
  connectedWallet,
  walletChainId,
  isWalletConnecting,
  isWalletConnected,
  walletProviderAvailable,
  connectWallet,
  disconnectWallet
}: TopNavProps) {
  const initials = getUserInitials(user?.name);

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
      disconnectWallet();
    } else {
      void connectWallet();
    }
  }, [walletProviderAvailable, isWalletConnected, disconnectWallet, connectWallet]);

  return (
    <GlassPanel advanced={advancedGlass} className="px-6 py-4">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center gap-3">
            <MetallicLogo size={36} animated={currentPath === '/'} />
            <div>
              <p className="text-sm font-semibold tracking-wide text-white">PolyCopy</p>
              <p className="text-xs text-slate-400">Built for Polymarket</p>
            </div>
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm text-slate-300">
            <Link
              to="/"
              className={`transition ${currentPath === '/' ? 'text-white' : 'hover:text-white text-slate-300'}`}
            >
              Home
            </Link>
            <Link
              to="/leaderboard"
              className={`transition ${currentPath === '/leaderboard' ? 'text-white' : 'hover:text-white text-slate-300'}`}
            >
              Leaderboard
            </Link>
          </nav>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleSessionClick}
            disabled={(Boolean(user) && (isSessionLoading || isSessionActionPending)) || isSessionActionPending}
            className="rounded-full border border-slate-700/80 bg-slate-900/80 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-slate-500 disabled:opacity-60"
          >
            {isSessionLoading ? (
              'Loading...'
            ) : user ? (
              <span className="inline-flex items-center gap-2">
                {initials && (
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-800/80 text-xs font-semibold">
                    {initials}
                  </span>
                )}
                <span>Sign out</span>
              </span>
            ) : (
              'Sign in'
            )}
          </button>
          <button
            type="button"
            onClick={handleWalletClick}
            disabled={isWalletConnecting || !walletProviderAvailable}
            className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60"
          >
            {isWalletConnecting ? 'Connecting...' : isWalletConnected ? shortAddress(connectedWallet) : 'Connect Wallet'}
          </button>
          {isWalletConnected && walletChainId && <span className="text-xs text-slate-400">Chain {walletChainId}</span>}
        </div>
      </header>
    </GlassPanel>
  );
}

function HomePage() {
  const [inputAddress, setInputAddress] = useState('');
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);

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
    disconnect: disconnectWallet
  } = useWalletConnection();

  const { suggestions, isLoading: isSearchingTraders, error: traderSearchError } = useTraderSearch(inputAddress, {
    minimumLength: 2,
    debounceMs: 140,
    limit: 12
  });

  const applySelectedAddress = useCallback((address: string) => {
    const sanitized = address.trim().toLowerCase();
    setSelectedAddress(sanitized || null);
  }, []);

  const combinedTopError = sessionError || walletError;

  return (
    <div className="min-h-screen bg-[#040712] text-slate-100">
      <div className="pointer-events-none fixed inset-0 z-0 opacity-65">
        <Beams beamWidth={2.1} beamHeight={25} beamNumber={50} noiseIntensity={0.15} scale={0.27} rotation={39} speed={1.4} />
      </div>
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top,rgba(49,114,255,0.22),transparent_52%)]" />
      <div className="relative z-10 mx-auto max-w-7xl px-6 pb-20 pt-8 space-y-14">
        <TopNav
          currentPath="/"
          advancedGlass
          user={user}
          isSessionLoading={isSessionLoading}
          isSessionActionPending={isSessionActionPending}
          login={login}
          logout={logout}
          connectedWallet={connectedWallet}
          walletChainId={walletChainId}
          isWalletConnecting={isWalletConnecting}
          isWalletConnected={isWalletConnected}
          walletProviderAvailable={walletProviderAvailable}
          connectWallet={connectWallet}
          disconnectWallet={disconnectWallet}
        />

        <section className="text-center space-y-5 reveal">
          <p className="inline-flex rounded-full border border-blue-400/30 bg-blue-500/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-blue-200">
            Polymarket Intelligence
          </p>
          <h1 className="mx-auto max-w-4xl text-2xl font-semibold leading-tight text-white sm:text-4xl">
            Discover top traders and track your own portfolio with confidence
          </h1>
          <p className="mx-auto max-w-2xl text-base text-slate-300 sm:text-lg">
            Track your own portfolio and analyze other traders before deciding who to follow.
          </p>
          <div className="flex justify-center gap-3">
            <Link to="/leaderboard" className="rounded-full bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-500">
              View Top Traders
            </Link>
            <a href="#search" className="rounded-full border border-slate-600 px-6 py-3 text-sm font-semibold text-slate-100 transition hover:border-slate-400">
              Search Traders
            </a>
          </div>
        </section>

        {combinedTopError && (
          <GlassPanel className="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {combinedTopError}
          </GlassPanel>
        )}

        <section className="grid gap-5 lg:grid-cols-3">
          <GlassPanel className="rounded-3xl p-6 reveal reveal-1">
            <article>
            <p className="text-xs uppercase tracking-wide text-blue-200">Leaderboard</p>
            <h2 className="mt-3 text-2xl font-semibold text-white">Follow the most successful traders</h2>
            <p className="mt-3 text-sm text-slate-300">Open the leaderboard to compare PnL, ROI, and volume at a glance.</p>
            <Link to="/leaderboard" className="mt-5 inline-flex rounded-full bg-white px-5 py-2 text-sm font-semibold text-slate-900">
              Open Leaderboard
            </Link>
            </article>
          </GlassPanel>

          <GlassPanel className="rounded-3xl p-6 reveal reveal-2">
            <article id="search">
            <p className="text-xs uppercase tracking-wide text-blue-200">Search Traders</p>
            <h2 className="mt-3 text-2xl font-semibold text-white">Analyze any wallet</h2>
            <p className="mt-3 text-sm text-slate-300">Search by wallet or username and inspect the trader profile instantly.</p>
            <div className="mt-5">
              <TraderSearch
                value={inputAddress}
                onChange={setInputAddress}
                onSubmit={(nextValue) => {
                  setInputAddress(nextValue.trim().toLowerCase());
                  applySelectedAddress(nextValue);
                }}
                suggestions={suggestions}
                isSearching={isSearchingTraders}
                searchError={traderSearchError}
                selectedAddress={selectedAddress}
              />
            </div>
            </article>
          </GlassPanel>

          <GlassPanel className="rounded-3xl p-6 reveal reveal-3">
            <article>
            <p className="text-xs uppercase tracking-wide text-blue-200">Portfolio View</p>
            <h2 className="mt-3 text-2xl font-semibold text-white">Track your own edge</h2>
            <p className="mt-3 text-sm text-slate-300">Compare your process with top traders and refine your strategy over time.</p>
            <GlassPanel className="mt-5 rounded-2xl p-4">
              <p className="text-xs uppercase text-slate-400">Selected trader</p>
              <p className="mt-1 font-mono text-sm text-slate-100 break-all">{selectedAddress || 'No trader selected yet'}</p>
              {selectedAddress && (
                <Link
                  to={`/profile/${selectedAddress}`}
                  className="mt-3 inline-flex rounded-full border border-blue-400/50 px-4 py-2 text-xs font-semibold text-blue-200"
                >
                  View trader profile
                </Link>
              )}
            </GlassPanel>
            </article>
          </GlassPanel>
        </section>

        {selectedAddress && <TraderDashboard address={selectedAddress} />}
      </div>
    </div>
  );
}

function LeaderboardPage() {
  const navigate = useNavigate();
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);

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

  const { activeEntries, periodOptions, selectedPeriod, onPeriodChange, isLoading, error } = useLeaderboardData();
  const handlePrefetch = useCallback((address: string) => {
    prefetchTraderOverview(address);
  }, []);

  return (
    <div className="min-h-screen bg-[#040712] text-slate-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top,rgba(49,114,255,0.22),transparent_52%)]" />
      <div className="relative z-10 mx-auto max-w-7xl px-6 pb-20 pt-8 space-y-10">
        <TopNav
          currentPath="/leaderboard"
          user={user}
          isSessionLoading={isSessionLoading}
          isSessionActionPending={isSessionActionPending}
          login={login}
          logout={logout}
          connectedWallet={connectedWallet}
          walletChainId={walletChainId}
          isWalletConnecting={isWalletConnecting}
          isWalletConnected={isWalletConnected}
          walletProviderAvailable={walletProviderAvailable}
          connectWallet={connectWallet}
          disconnectWallet={disconnectWallet}
        />

        <GlassPanel className="overflow-hidden rounded-2xl">
          <BreakingNewsBanner />
        </GlassPanel>

        {(sessionError || walletError) && (
          <GlassPanel className="flex items-start justify-between gap-3 rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            <p>{sessionError || walletError}</p>
            {walletError && (
              <button
                type="button"
                onClick={resetWalletError}
                className="rounded-full border border-rose-400/50 px-3 py-1 text-xs font-semibold text-rose-50 transition hover:border-rose-200"
              >
                Dismiss
              </button>
            )}
          </GlassPanel>
        )}

        <section className="space-y-3">
          <p className="text-xs uppercase tracking-[0.2em] text-blue-200">Leaderboard</p>
          <h1 className="text-3xl font-semibold text-white sm:text-4xl">Top Polymarket Traders</h1>
          <p className="max-w-2xl text-sm text-slate-300">
            Browse ranked traders by key metrics and click any wallet to inspect full profile details.
          </p>
        </section>

        <Leaderboard
          entries={activeEntries}
          isLoading={isLoading}
          error={error}
          selectedAddress={selectedAddress}
          periodOptions={periodOptions}
          selectedPeriod={selectedPeriod}
          onPeriodChange={(next) => {
            if (periodOptions.some((option) => option.key === next)) {
              onPeriodChange(next);
            }
          }}
          onSelect={(address, entry) => {
            setSelectedAddress(address);
            navigate(`/profile/${address}`, {
              state: {
                leaderboardEntry: entry || null
              }
            });
          }}
          onPrefetch={(address) => handlePrefetch(address)}
        />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/leaderboard" element={<LeaderboardPage />} />
        <Route path="/profile/:address" element={<TraderProfile />} />
        <Route path="/logo-preview" element={<MetallicLogoPreviewPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
