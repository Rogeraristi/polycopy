import { useCallback, useEffect, useState } from 'react';
import { ethers } from 'ethers';
// Dummy Polymarket contract address and ABI for demonstration
const POLYMARKET_CONTRACT_ADDRESS = '0x0000000000000000000000000000000000000000'; // TODO: Replace with real address
const POLYMARKET_ABI = [
  // Replace with actual ABI
  // Example:
  // "function trade(uint256 marketId, string outcome, uint256 price, uint256 size, string side) public payable"
];
import { HeaderBar } from './components/HeaderBar';
import { LatencyBadge } from './components/LatencyBadge';
import { Leaderboard, LeaderboardEntry } from './components/Leaderboard';
import { TradeList } from './components/TradeList';
import { TraderDashboard } from './components/TraderDashboard';
import { TraderSearch } from './components/TraderSearch';
import { useTraderSearch } from './hooks/useTraderSearch';
import { useSession } from './hooks/useSession';
import { useWalletConnection } from './hooks/useWalletConnection';
import { useLiveTrades } from './hooks/useLiveTrades';
import type { Trade } from './hooks/useLiveTrades';

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

export default function App() {
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
  const [txStatus, setTxStatus] = useState<string | null>(null);

  // Function to submit the prepared order to Polymarket via MetaMask
  const handleSubmitOrder = useCallback(async () => {
    if (!copyResult || !window.ethereum) {
      setTxStatus('MetaMask not available or no order to submit.');
      return;
    }
    setTxStatus('Awaiting wallet confirmation...');
    try {
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      // TODO: Replace with actual contract and method
      const contract = new ethers.Contract(POLYMARKET_CONTRACT_ADDRESS, POLYMARKET_ABI, signer);
      // Example call - update with real method and params
      // const tx = await contract.trade(
      //   copyResult.order.marketId,
      //   copyResult.order.outcome,
      //   ethers.utils.parseUnits(String(copyResult.order.price), 6),
      //   ethers.utils.parseUnits(String(copyResult.order.size), 6),
      //   copyResult.order.side
      // );
      // await tx.wait();
      // For demo, just simulate success
      setTimeout(() => setTxStatus('Order submitted! (Demo: replace with real contract call)'), 1500);
    } catch (err) {
      setTxStatus('Transaction failed: ' + (err instanceof Error ? err.message : String(err)));
    }
  }, [copyResult]);
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
    latencyMs,
    stats
  } = useLiveTrades(selectedAddress);

  useEffect(() => {
    const controller = new AbortController();
    let isActive = true;

    setIsLeaderboardLoading(true);
    setLeaderboardError(null);

    const API_BASE = import.meta.env.VITE_API_BASE_URL;
    fetch(`${API_BASE}/api/leaderboard`, { signal: controller.signal, credentials: 'include' })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`Failed to load leaderboard (${res.status})`))))
      .then((data) => {
        if (!isActive) return;
        const rawPeriods = data?.periods && typeof data.periods === 'object' ? data.periods : {};
        const rawLabels = data?.labels && typeof data.labels === 'object' ? data.labels : {};

        const nextPeriods = Object.entries(rawPeriods).reduce<Record<string, LeaderboardEntry[]>>((acc, [key, value]) => {
          if (!Array.isArray(value)) {
            return acc;
          }
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
        const preferredPeriod = ((): string => {
          const apiDefault = typeof data?.defaultPeriod === 'string' ? data.defaultPeriod : null;
          if (apiDefault && availableKeys.includes(apiDefault)) {
            return apiDefault;
          }
          if (availableKeys.includes('weekly')) {
            return 'weekly';
          }
          return availableKeys[0] ?? activeLeaderboardPeriod;
        })();

        setLeaderboardPeriods(nextPeriods);
        setLeaderboardLabels(
          availableKeys.reduce<Record<string, string>>((acc, key) => {
            acc[key] = rawLabels[key] || key;
            return acc;
          }, {})
        );
        setActiveLeaderboardPeriod(preferredPeriod);

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

  const applySelectedAddress = useCallback(
    (address: string) => {
      const sanitized = address.trim().toLowerCase();
      const nextAddress = sanitized || null;
      setSelectedAddress(nextAddress);
      setCopyResult(null);
      setCopyError(null);
    },
    [setSelectedAddress, setCopyResult, setCopyError]
  );

  const {
    suggestions: searchedTraders,
    isLoading: isSearchLoading,
    error: traderSearchError
  } = useTraderSearch(inputAddress, {
    minimumLength: 2,
    debounceMs: 240,
    limit: 8
  });

  const trimmedQuery = inputAddress.trim();
  const queryActive = trimmedQuery.length >= 2;
  const searchSuggestions: LeaderboardEntry[] = queryActive ? searchedTraders : [];
  const activeSearchError = queryActive ? traderSearchError : null;
  const activeSearchLoading = queryActive ? isSearchLoading : false;

  const periodOrder = ['today', 'weekly', 'monthly', 'all'];
  const orderedPeriodOptions = periodOrder
    .filter((key) => Array.isArray(leaderboardPeriods[key]) && leaderboardPeriods[key].length)
    .map((key) => ({ key, label: leaderboardLabels[key] || key }));
  const additionalPeriodOptions = Object.keys(leaderboardPeriods)
    .filter((key) => !periodOrder.includes(key))
    .map((key) => ({ key, label: leaderboardLabels[key] || key }));
  const periodOptions = [...orderedPeriodOptions, ...additionalPeriodOptions];

  const shortSelectedAddress = selectedAddress ? `${selectedAddress.slice(0, 6)}…${selectedAddress.slice(-4)}` : 'No trader selected';

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
        const multiplier = sizeMultiplier > 0 ? sizeMultiplier : 1;
        const API_BASE = import.meta.env.VITE_API_BASE_URL;
        const response = await fetch(`${API_BASE}/api/copy-trade`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
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
        const payload = (await response.json()) as { order?: CopyTradeOrder; message?: string };
        if (!payload?.order) {
          throw new Error('Copy trade did not return an order payload.');
        }
        setCopyResult({
          order: payload.order,
          message: payload.message,
          sourceTrade: trade
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to prepare copy trade payload.';
        setCopyResult(null);
        setCopyError(message);
      } finally {
        setIsCopying(false);
      }
    },
    [connectedWallet, sizeMultiplier, setCopyResult, setCopyError]
  );

  const handleDisconnectWallet = useCallback(() => {
    disconnectWallet();
    setCopyResult(null);
    setCopyError(null);
  }, [disconnectWallet, setCopyResult, setCopyError]);

  const handleDismissWalletError = useCallback(() => {
    resetWalletError();
  }, [resetWalletError]);

  const activeLeaderboardEntries = leaderboardPeriods[activeLeaderboardPeriod] || [];
  const shortConnectedWallet = connectedWallet ? `${connectedWallet.slice(0, 6)}…${connectedWallet.slice(-4)}` : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <div className="mx-auto max-w-6xl px-6 py-10 space-y-12">
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

        {(sessionError || walletError) && (
          <div className="space-y-3">
            {sessionError && (
              <div className="rounded-2xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                {sessionError}
              </div>
            )}
            {walletError && (
              <div className="flex items-start justify-between gap-4 rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                <p>{walletError}</p>
                <button
                  type="button"
                  onClick={handleDismissWalletError}
                  className="rounded-full border border-rose-400/50 px-3 py-1 text-xs font-semibold text-rose-50 transition hover:border-rose-200 hover:text-rose-50/80"
                >
                  Dismiss
                </button>
              </div>
            )}
          </div>
        )}

        <section className="relative overflow-hidden rounded-3xl border border-slate-800/60 bg-slate-950/70 px-6 py-16 text-center shadow-[0_35px_120px_-40px_rgba(15,23,42,0.8)]">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.25),transparent_55%)]" />
          <div className="mx-auto flex max-w-3xl flex-col gap-10">
            <div className="space-y-5">
              <p className="text-sm uppercase tracking-[0.4em] text-primary/80">Live trade mirroring</p>
              <h2 className="text-4xl font-semibold text-white sm:text-5xl">
                Paste a Polymarket wallet to start copying instantly
              </h2>
              <p className="text-base text-slate-300">
                Track top-performing traders in real time and generate ready-to-sign orders using your own wallet.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-800/70 bg-slate-950/80 p-6 backdrop-blur">
              <TraderSearch
                value={inputAddress}
                onChange={setInputAddress}
                onSubmit={(address) => {
                  const sanitized = address.trim().toLowerCase();
                  setInputAddress(sanitized);
                  applySelectedAddress(sanitized);
                }}
                suggestions={searchSuggestions}
                isSearching={activeSearchLoading}
                searchError={activeSearchError}
                selectedAddress={selectedAddress}
              />
            </div>
          </div>
        </section>

        {/* Trader Dashboard visualization */}
        {selectedAddress && (
          <TraderDashboard address={selectedAddress} />
        )}

        <Leaderboard
          entries={activeLeaderboardEntries}
          isLoading={isLeaderboardLoading}
          error={leaderboardError}
          onSelect={(address) => {
            const sanitized = address.trim().toLowerCase();
            setInputAddress(sanitized);
            applySelectedAddress(sanitized);
          }}
          selectedAddress={selectedAddress}
          periodOptions={periodOptions}
          selectedPeriod={activeLeaderboardPeriod}
          onPeriodChange={(key) => {
            if (leaderboardPeriods[key]) {
              setActiveLeaderboardPeriod(key);
            }
          }}
        />

        <section className="grid gap-6 lg:grid-cols-[minmax(0,2fr),minmax(0,1fr)]">
          <div className="space-y-6 rounded-3xl border border-slate-800/60 bg-slate-950/70 p-6 shadow-2xl shadow-slate-950/40">
            <header>
              <p className="text-sm uppercase tracking-wide text-slate-400">Live trades</p>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-slate-100">{shortSelectedAddress}</h3>
                  {selectedAddress && (
                    <p className="text-xs text-slate-400">
                      Tracking <span className="font-mono break-all">{selectedAddress}</span>
                    </p>
                  )}
                </div>
                {selectedAddress && <LatencyBadge latencyMs={latencyMs} />}
              </div>
            </header>

            {tradesError && (
              <div className="rounded-2xl border border-rose-600/40 bg-rose-600/10 px-4 py-3 text-sm text-rose-100">
                {tradesError}
              </div>
            )}

            {isTradesLoading ? (
              <div className="rounded-2xl border border-slate-800/60 bg-slate-900/60 px-4 py-6 text-sm text-slate-400">
                Loading trades…
              </div>
            ) : (
              <TradeList
                trades={selectedAddress ? trades : []}
                onCopy={handleCopyTrade}
                isCopying={isCopying}
                canCopy={isWalletConnected}
              />
            )}
          </div>

          <div className="space-y-6 rounded-3xl border border-slate-800/60 bg-slate-950/70 p-6 shadow-2xl shadow-slate-950/40">
            <div className="space-y-3">
              <p className="text-sm uppercase tracking-wide text-slate-400">Copy settings</p>
              <div>
                <p className="text-xs uppercase text-slate-500">Wallet</p>
                <p className="mt-1 text-sm text-slate-200">
                  {isWalletConnected
                    ? `${shortConnectedWallet ?? connectedWallet} · Chain ${walletChainId ?? '—'}`
                    : walletProviderAvailable
                    ? 'Not connected'
                    : 'Wallet extension not detected'}
                </p>
              </div>
              <label className="block text-sm font-semibold text-slate-100" htmlFor="sizeMultiplier">
                Size multiplier
              </label>
              <div className="flex items-center gap-3">
                <input
                  id="sizeMultiplier"
                  type="number"
                  min={0.1}
                  step={0.1}
                  value={sizeMultiplier}
                  onChange={(event) => {
                    const nextValue = Number(event.target.value);
                    if (!Number.isFinite(nextValue)) {
                      setSizeMultiplier(1);
                      return;
                    }
                    setSizeMultiplier(nextValue > 0 ? nextValue : 1);
                  }}
                  className="w-32 rounded-xl border border-slate-700/70 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <span className="text-xs text-slate-400">× original size</span>
              </div>
            </div>

            <div>
              <p className="text-sm uppercase tracking-wide text-slate-400">Trader metrics</p>
              <dl className="mt-3 grid grid-cols-2 gap-4 text-sm text-slate-200">
                <div>
                  <dt className="text-xs uppercase text-slate-500">Win rate</dt>
                  <dd className="mt-1 text-base font-semibold">{stats.winRate === null ? '—' : `${stats.winRate}%`}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase text-slate-500">Avg size</dt>
                  <dd className="mt-1 text-base font-semibold">
                    {stats.averageSize === null ? '—' : `${stats.averageSize.toFixed(2)} shares`}
                  </dd>
                </div>
              </dl>
            </div>

            {!isWalletConnected && (
              <p className="text-sm text-slate-400">
                Connect your wallet to generate unsigned orders you can submit through the Polymarket trading API.
              </p>
            )}

            {copyError && (
              <div className="rounded-2xl border border-rose-600/40 bg-rose-600/10 px-4 py-3 text-sm text-rose-100">
                {copyError}
              </div>
            )}

            {copyResult && (
              <div className="space-y-3 rounded-2xl border border-emerald-400/40 bg-emerald-500/10 p-4 text-sm text-emerald-100">
                <div>
                  <p className="text-sm font-semibold text-emerald-200">Prepared order</p>
                  <p className="text-xs text-emerald-100/80">
                    {copyResult.message ||
                      'Sign this payload with your connected wallet and submit it to the Polymarket trading API.'}
                  </p>
                </div>
                <dl className="grid grid-cols-2 gap-3 text-xs text-emerald-100/90">
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
                    <dt className="uppercase text-emerald-300/80">Price</dt>
                    <dd className="font-semibold">
                      {typeof copyResult.order.price === 'number' && Number.isFinite(copyResult.order.price)
                        ? `$${copyResult.order.price.toFixed(3)}`
                        : 'n/a'}
                    </dd>
                  </div>
                  <div>
                    <dt className="uppercase text-emerald-300/80">Size</dt>
                    <dd className="font-semibold">
                      {typeof copyResult.order.size === 'number' && Number.isFinite(copyResult.order.size)
                        ? `${copyResult.order.size.toFixed(2)} shares`
                        : 'n/a'}
                    </dd>
                  </div>
                  <div>
                    <dt className="uppercase text-emerald-300/80">Source trader</dt>
                    <dd className="font-mono text-[13px]">{copyResult.order.copiedFrom || 'n/a'}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="uppercase text-emerald-300/80">Prepared at</dt>
                    <dd className="font-mono text-[13px]">
                      {typeof copyResult.order.timestamp === 'number'
                        ? new Date(copyResult.order.timestamp).toLocaleString()
                        : new Date().toLocaleString()}
                    </dd>
                  </div>
                </dl>
                <button
                  className="mt-4 rounded-lg bg-primary px-4 py-2 font-semibold text-white hover:bg-primary/80"
                  onClick={handleSubmitOrder}
                  disabled={!!txStatus && txStatus.startsWith('Awaiting')}
                >
                  Submit order with MetaMask
                </button>
                {txStatus && (
                  <div className="mt-2 text-xs text-emerald-200">{txStatus}</div>
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
