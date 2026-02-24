import { useEffect, useMemo, useState } from 'react';
import MetallicLogo from '../components/MetallicLogo';
import { Link, useParams } from 'react-router-dom';
import type { Trade } from '../hooks/useLiveTrades';
import BreakingNewsBanner from '../components/BreakingNewsBanner';
import GlassPanel from '../components/effects/GlassPanel';

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

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

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
  const [trades, setTrades] = useState<Trade[]>([]);
  const [pnl, setPnl] = useState<PnlPayload | null>(null);
  const [portfolio, setPortfolio] = useState<PortfolioPayload | null>(null);
  const [openOrders, setOpenOrders] = useState<OpenOrdersPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    const controller = new AbortController();

    setLoading(true);
    setError(null);

    Promise.all([
      fetch(`${API_BASE}/users/${address}/trades`, { signal: controller.signal, credentials: 'include' }),
      fetch(`${API_BASE}/users/${address}/pnl`, { signal: controller.signal, credentials: 'include' }),
      fetch(`${API_BASE}/users/${address}/portfolio`, { signal: controller.signal, credentials: 'include' }),
      fetch(`${API_BASE}/users/${address}/open-orders`, { signal: controller.signal, credentials: 'include' })
    ])
      .then(async ([tradesRes, pnlRes, portfolioRes, ordersRes]) => {
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
          pnl: typeof pnlData?.pnl === 'number' ? pnlData.pnl : null,
          calculation: typeof pnlData?.calculation === 'string' ? pnlData.calculation : undefined,
          tradeCount: typeof pnlData?.tradeCount === 'number' ? pnlData.tradeCount : undefined
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
  }, [address]);

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
