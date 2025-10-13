import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LatencyBadge } from './components/LatencyBadge';
import { MarketsGrid } from './components/MarketsGrid';
import { TradeList } from './components/TradeList';
import { Trade, useLiveTrades } from './hooks/useLiveTrades';

interface MarketSummary {
  id: string;
  question: string;
  liquidity: number;
  volume24h: number;
  outcomes: any[];
}

function getTradeKey(trade: Trade) {
  return [
    trade.id,
    trade.transaction_hash,
    trade.txid,
    trade.created_at,
    trade.createdAt,
    trade.timestamp,
    trade.price,
    trade.outcome ?? trade.outcomeToken
  ]
    .filter(Boolean)
    .join(':');
}

export default function App() {
  const [inputAddress, setInputAddress] = useState('');
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
  const [targetWallet, setTargetWallet] = useState('');
  const [sizeMultiplier, setSizeMultiplier] = useState(1);
  const [autoCopy, setAutoCopy] = useState(false);
  const [copyResult, setCopyResult] = useState<string | null>(null);
  const [markets, setMarkets] = useState<MarketSummary[]>([]);
  const [isCopying, setIsCopying] = useState(false);
  const lastCopiedTradeKey = useRef<string | null>(null);
  const pendingCopyKey = useRef<string | null>(null);

  const { trades, isLoading, error, latencyMs, stats } = useLiveTrades(selectedAddress);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/markets', { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((data) => setMarkets(data.markets ?? []))
      .catch(() => setMarkets([]));
    return () => controller.abort();
  }, []);

  const copyTrade = useCallback(
    async (trade: Trade) => {
      if (!targetWallet) {
        setCopyResult('Set your execution wallet before copying trades.');
        return;
      }

      setIsCopying(true);
      setCopyResult(null);
      try {
        const res = await fetch('/api/copy-trade', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ trade, targetWallet, sizeMultiplier })
        });
        if (!res.ok) {
          throw new Error(`Failed to create order (${res.status})`);
        }
        const data = await res.json();
        const order = data.order;
        const sizeDisplay = Number.isFinite(Number(order?.size)) ? Number(order.size).toFixed(2) : 'n/a';
        const priceDisplay = Number.isFinite(Number(order?.price)) ? Number(order.price).toFixed(3) : 'n/a';
        const summary = order
          ? `${data.message ?? 'Order prepared.'} Size ${sizeDisplay} @ ${priceDisplay}.`
          : data.message ?? 'Order prepared.';
        setCopyResult(summary);
        return data;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to copy trade';
        setCopyResult(message);
        throw err;
      } finally {
        setIsCopying(false);
      }
    },
    [sizeMultiplier, targetWallet]
  );

  useEffect(() => {
    if (!autoCopy || trades.length === 0) return;
    const newest = trades[0];
    const key = getTradeKey(newest);
    if (!key || key === lastCopiedTradeKey.current || key === pendingCopyKey.current) return;
    pendingCopyKey.current = key;
    copyTrade(newest)
      .then(() => {
        lastCopiedTradeKey.current = key;
      })
      .catch(() => {
        lastCopiedTradeKey.current = null;
      })
      .finally(() => {
        pendingCopyKey.current = null;
      });
  }, [autoCopy, copyTrade, trades]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const sanitized = inputAddress.trim().toLowerCase();
    setSelectedAddress(sanitized || null);
    lastCopiedTradeKey.current = null;
    pendingCopyKey.current = null;
  };

  const heroTitle = useMemo(() => {
    if (!selectedAddress) {
      return 'Copy top Polymarket traders instantly';
    }
    return `Tracking ${selectedAddress}`;
  }, [selectedAddress]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <div className="mx-auto max-w-6xl px-6 py-12 space-y-10">
        <header className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-3xl font-bold tracking-tight text-white md:text-4xl">PolyCopy</h1>
            <LatencyBadge latencyMs={latencyMs} />
          </div>
          <p className="text-lg text-slate-400 max-w-2xl">
            {heroTitle}. Plug in a profitable trader’s wallet, see their live flow and queue mirrored orders with your desired
            sizing.
          </p>
        </header>

        <section className="card p-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 md:flex-row md:items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-300">Trader wallet to mirror</label>
              <input
                type="text"
                placeholder="0xabc…"
                value={inputAddress}
                onChange={(event) => setInputAddress(event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900/70 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div className="grid flex-1 grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300">Your execution wallet</label>
                <input
                  type="text"
                  placeholder="0xyourwallet…"
                  value={targetWallet}
                  onChange={(event) => setTargetWallet(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900/70 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300">Size multiplier</label>
                <input
                  type="number"
                  min={0.1}
                  step={0.1}
                  value={sizeMultiplier}
                  onChange={(event) => {
                    const next = Number(event.target.value);
                    setSizeMultiplier(Number.isFinite(next) && next > 0 ? next : 1);
                  }}
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900/70 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </div>
            <button
              type="submit"
              className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-primary/90"
            >
              Start mirroring
            </button>
          </form>

          <div className="mt-6 flex items-center justify-between gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={autoCopy}
                onChange={(event) => setAutoCopy(event.target.checked)}
                className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-primary focus:ring-primary/60"
              />
              Auto-copy newest trade
            </label>
            {stats.winRate !== null && (
              <div className="flex items-center gap-6 text-sm text-slate-400">
                <span>Buy ratio: {stats.winRate}%</span>
                {stats.averageSize !== null && <span>Avg size: {stats.averageSize.toFixed(2)} shares</span>}
              </div>
            )}
          </div>
        </section>

        {error && <p className="text-sm text-rose-300">{error}</p>}
        {isLoading && <p className="text-sm text-slate-400">Loading trader activity…</p>}

        <TradeList trades={trades} onCopy={(trade) => copyTrade(trade)} isCopying={isCopying} />

        {copyResult && (
          <div className="card border-primary/30 bg-primary/10 p-4 text-sm text-primary">
            <p>{copyResult}</p>
          </div>
        )}

        <MarketsGrid markets={markets.slice(0, 6)} />
      </div>
    </div>
  );
}
