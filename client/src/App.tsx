import { useCallback, useEffect, useMemo, useState } from 'react';
import { BrowserRouter as Router, Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { Leaderboard, type LeaderboardEntry } from './components/Leaderboard';
import BreakingNewsBanner from './components/BreakingNewsBanner';
import { TraderDashboard } from './components/TraderDashboard';
import { TraderSearch } from './components/TraderSearch';
import { useSession } from './hooks/useSession';
import { useTraderSearch } from './hooks/useTraderSearch';
import { useWalletConnection } from './hooks/useWalletConnection';
import TraderProfile from './pages/TraderProfile';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

function shortAddress(address: string | null) {
  if (!address) return 'Not connected';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
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
    <header className="rounded-2xl border border-[#1f2d4d] bg-[#0a1122cc] px-6 py-4 backdrop-blur">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center gap-3">
            <img src="/polycopy-logo3.png" alt="PolyCopy logo" className="h-10 w-10 rounded-xl border border-[#2a3f66] bg-[#0a1226] p-1" />
            <div>
              <p className="brand-heading text-sm font-semibold tracking-wide text-white">POLYCOPY</p>
              <p className="text-xs text-[#8fa5cb]">Copy smarter on Polymarket</p>
            </div>
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm text-[#9bb0d5]">
            <Link
              to="/"
              className={`transition ${currentPath === '/' ? 'text-white' : 'hover:text-white text-[#9bb0d5]'}`}
            >
              Home
            </Link>
            <Link
              to="/leaderboard"
              className={`transition ${currentPath === '/leaderboard' ? 'text-white' : 'hover:text-white text-[#9bb0d5]'}`}
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
            className="rounded-full border border-[#2b4068] bg-[#0c1730cc] px-4 py-2 text-sm font-semibold text-[#d8e6ff] transition hover:border-[#4d709e] disabled:opacity-60"
          >
            {user ? (isSessionLoading ? 'Loading...' : 'Sign out') : 'Sign in'}
          </button>
          <button
            type="button"
            onClick={handleWalletClick}
            disabled={isWalletConnecting || !walletProviderAvailable}
            className="rounded-full bg-gradient-to-r from-[#21c4c4] to-[#0dd3a8] px-4 py-2 text-sm font-semibold text-[#032021] transition hover:brightness-105 disabled:opacity-60"
          >
            {isWalletConnecting ? 'Connecting...' : isWalletConnected ? shortAddress(connectedWallet) : 'Connect Wallet'}
          </button>
          {isWalletConnected && walletChainId && <span className="text-xs text-[#8fa5cb]">Chain {walletChainId}</span>}
        </div>
      </div>
    </header>
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
    <div className="brand-grid min-h-screen text-slate-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top,rgba(33,196,196,0.2),transparent_55%)]" />
      <div className="relative mx-auto max-w-7xl px-6 pb-20 pt-8 space-y-14">
        <TopNav
          currentPath="/"
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
          <p className="inline-flex rounded-full border border-[#2f4e7a] bg-[#13325e66] px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[#9ed8e8]">
            New Brand Experience
          </p>
          <h1 className="brand-heading mx-auto max-w-4xl text-2xl font-semibold leading-tight text-white sm:text-4xl">
            Track elite conviction and build your edge with PolyCopy
          </h1>
          <p className="mx-auto max-w-2xl text-base text-[#a8bbdf] sm:text-lg">
            Follow verified market leaders, audit your own performance, and execute with higher confidence.
          </p>
          <div className="flex justify-center gap-3">
            <Link to="/leaderboard" className="brand-button px-6 py-3">
              View Top Traders
            </Link>
            <a href="#search" className="brand-outline-button px-6 py-3">
              Search Traders
            </a>
          </div>
        </section>

        {combinedTopError && (
          <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{combinedTopError}</div>
        )}

        <section className="grid gap-5 lg:grid-cols-3">
          <article className="card p-6 reveal reveal-1">
            <p className="text-xs uppercase tracking-wide text-[#9ed8e8]">Leaderboard</p>
            <h2 className="brand-heading mt-3 text-2xl font-semibold text-white">Follow the most successful traders</h2>
            <p className="mt-3 text-sm text-[#a8bbdf]">Open the leaderboard to compare PnL, ROI, and volume at a glance.</p>
            <Link to="/leaderboard" className="brand-button mt-5 inline-flex">
              Open Leaderboard
            </Link>
          </article>

          <article id="search" className="card p-6 reveal reveal-2">
            <p className="text-xs uppercase tracking-wide text-[#9ed8e8]">Search Traders</p>
            <h2 className="brand-heading mt-3 text-2xl font-semibold text-white">Analyze any wallet</h2>
            <p className="mt-3 text-sm text-[#a8bbdf]">Search by wallet or username and inspect the trader profile instantly.</p>
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

          <article className="card p-6 reveal reveal-3">
            <p className="text-xs uppercase tracking-wide text-[#9ed8e8]">Portfolio View</p>
            <h2 className="brand-heading mt-3 text-2xl font-semibold text-white">Track your own edge</h2>
            <p className="mt-3 text-sm text-[#a8bbdf]">Compare your process with top traders and refine your strategy over time.</p>
            <div className="mt-5 rounded-2xl border border-[#2b4068] bg-[#0c1730aa] p-4">
              <p className="text-xs uppercase text-[#86a2cf]">Selected trader</p>
              <p className="mt-1 font-mono text-sm text-[#e5efff] break-all">{selectedAddress || 'No trader selected yet'}</p>
              {selectedAddress && (
                <Link
                  to={`/profile/${selectedAddress}`}
                  className="brand-outline-button mt-3 inline-flex px-4 py-2 text-xs"
                >
                  View trader profile
                </Link>
              )}
            </div>
          </article>
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

  return (
    <div className="brand-grid min-h-screen text-slate-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top,rgba(33,196,196,0.2),transparent_55%)]" />
      <div className="relative mx-auto max-w-7xl px-6 pb-20 pt-8 space-y-10">
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

        <div className="overflow-hidden rounded-2xl border border-[#1f2d4d]">
          <BreakingNewsBanner />
        </div>

        {(sessionError || walletError) && (
          <div className="flex items-start justify-between gap-3 rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
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
          </div>
        )}

        <section className="space-y-3">
          <p className="text-xs uppercase tracking-[0.2em] text-[#9ed8e8]">Leaderboard</p>
          <h1 className="brand-heading text-3xl font-semibold text-white sm:text-4xl">Top Polymarket Traders</h1>
          <p className="max-w-2xl text-sm text-[#a8bbdf]">
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
          onSelect={(address) => {
            setSelectedAddress(address);
            navigate(`/profile/${address}`);
          }}
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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
