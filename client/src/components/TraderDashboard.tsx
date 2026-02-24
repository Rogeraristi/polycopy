
import React, { useEffect, useMemo, useState } from 'react';
import type { Trade } from '../hooks/useLiveTrades';



export function TraderDashboard({ address }: { address: string }) {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!address) {
      setTrades([]);
      setError(null);
      return;
    }
    let isCancelled = false;
    const abort = new AbortController();
    async function fetchTrades() {
      setIsLoading(true);
      setError(null);
      try {
        // Use import.meta as any to avoid TS error in Vite
        const API_BASE = (import.meta as any).env.VITE_API_BASE_URL;
        const res = await fetch(`${API_BASE}/api/users/${address}/trades`, {
          signal: abort.signal,
          credentials: 'include',
        });
        if (!res.ok) throw new Error(`Failed to fetch trades: ${res.status}`);
        const data = await res.json();
        if (!isCancelled) {
          setTrades(Array.isArray(data?.trades) ? data.trades : []);
        }
      } catch (err) {
        if (!isCancelled) setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    }
    fetchTrades();
    return () => {
      isCancelled = true;
      abort.abort();
    };
  }, [address]);

  // Derive portfolio, orders, and history from trades (simple logic for demo)
  const { openPositions, closedPositions, openOrders, tradeHistory, totalPnl } = useMemo(() => {
    let openPositions: any[] = [];
    let closedPositions: any[] = [];
    let openOrders: any[] = [];
    let tradeHistory: any[] = [];
    let totalPnl = 0;
    if (Array.isArray(trades)) {
      // For demo: treat all trades as history, and open/closed positions as a count by market
      tradeHistory = trades.map((t) => ({
        date: t.created_at || t.createdAt || t.timestamp || '',
        market: typeof t.market === 'string' ? t.market : t.market?.question || t.market?.title || t.marketId || t.market_id || '',
        side: t.side || t.type || '',
        size: t.amount || t.size || t.shares || '',
        price: t.price,
        pnl: 0, // No pnl field in Trade, set to 0 or compute if available
      }));
      // Fake logic: open positions = unique markets with at least one trade
      const marketMap: Record<string, any> = {};
      trades.forEach((t) => {
        const market = typeof t.market === 'string' ? t.market : t.market?.question || t.market?.title || t.marketId || t.market_id || '';
        if (!marketMap[market]) {
          marketMap[market] = { market, position: 0, pnl: 0, status: 'Open' };
        }
        marketMap[market].position += Number(t.amount || t.size || t.shares || 0);
        // No pnl field in Trade, so skip
      });
      openPositions = Object.values(marketMap);
      closedPositions = [];
      openOrders = [];
      totalPnl = 0; // No pnl field, so set to 0
    }
    return { openPositions, closedPositions, openOrders, tradeHistory, totalPnl };
  }, [trades]);

  const totalOpenPositions = openPositions.length;
  const totalClosedPositions = closedPositions.length;
  const totalOpenOrders = openOrders.length;
  const totalTrades = tradeHistory.length;

  return (
    <section className="card p-6 space-y-10 mt-6">
      <h2 className="text-lg font-semibold text-white">Trader Dashboard</h2>
      <p className="text-sm text-slate-400 mb-4">Portfolio and PnL for <span className="font-mono">{address}</span></p>

      {/* Summary Stats */}
      <div className="flex flex-wrap gap-6 mb-2">
        <div className="flex flex-col items-center">
          <span className="text-2xl font-bold text-emerald-400">{totalPnl}</span>
          <span className="text-xs text-slate-400">Total PnL</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-2xl font-bold">{totalOpenPositions}</span>
          <span className="text-xs text-slate-400">Open Positions</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-2xl font-bold">{totalClosedPositions}</span>
          <span className="text-xs text-slate-400">Closed Positions</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-2xl font-bold">{totalOpenOrders}</span>
          <span className="text-xs text-slate-400">Open Orders</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-2xl font-bold">{totalTrades}</span>
          <span className="text-xs text-slate-400">Trade History</span>
        </div>
      </div>

      <hr className="border-slate-800 my-2" />

      {/* Open Positions */}
      <div>
        <h3 className="font-semibold text-slate-200 mb-2">Open Positions</h3>
        <div className="overflow-x-auto max-h-64">
          <table className="min-w-full text-sm mb-4 border-separate border-spacing-y-1">
            <thead>
              <tr className="text-slate-400 bg-slate-800">
                <th className="px-3 py-2 text-left">Market</th>
                <th className="px-3 py-2 text-right">Position</th>
                <th className="px-3 py-2 text-right">PnL</th>
                <th className="px-3 py-2 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {openPositions.map((pos: any, i: number) => (
                <tr key={i} className="text-slate-100 even:bg-slate-900/60">
                  <td className="px-3 py-2">{pos.market}</td>
                  <td className="px-3 py-2 text-right">{pos.position}</td>
                  <td className={`px-3 py-2 text-right font-semibold ${pos.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{pos.pnl}</td>
                  <td className="px-3 py-2 text-center">{pos.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <hr className="border-slate-800 my-2" />

      {/* Open Orders */}
      <div>
        <h3 className="font-semibold text-slate-200 mb-2">Open Orders</h3>
        <div className="overflow-x-auto max-h-64">
          <table className="min-w-full text-sm mb-4 border-separate border-spacing-y-1">
            <thead>
              <tr className="text-slate-400 bg-slate-800">
                <th className="px-3 py-2 text-left">Market</th>
                <th className="px-3 py-2 text-center">Side</th>
                <th className="px-3 py-2 text-right">Size</th>
                <th className="px-3 py-2 text-right">Price</th>
                <th className="px-3 py-2 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {openOrders.length === 0 ? (
                <tr><td colSpan={5} className="text-center text-slate-500 py-2">No open orders</td></tr>
              ) : (
                openOrders.map((order: any, i: number) => (
                  <tr key={i} className="text-slate-100 even:bg-slate-900/60">
                    <td className="px-3 py-2">{order.market}</td>
                    <td className="px-3 py-2 text-center">{order.side}</td>
                    <td className="px-3 py-2 text-right">{order.size}</td>
                    <td className="px-3 py-2 text-right">{order.price}</td>
                    <td className="px-3 py-2 text-center">{order.status}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <hr className="border-slate-800 my-2" />

      {/* Trade History */}
      <div>
        <h3 className="font-semibold text-slate-200 mb-2">Trade History</h3>
        <div className="overflow-x-auto max-h-64">
          <table className="min-w-full text-sm border-separate border-spacing-y-1">
            <thead>
              <tr className="text-slate-400 bg-slate-800">
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-left">Market</th>
                <th className="px-3 py-2 text-center">Side</th>
                <th className="px-3 py-2 text-right">Size</th>
                <th className="px-3 py-2 text-right">Price</th>
                <th className="px-3 py-2 text-right">PnL</th>
              </tr>
            </thead>
            <tbody>
              {tradeHistory.length === 0 ? (
                <tr><td colSpan={6} className="text-center text-slate-500 py-2">No trade history</td></tr>
              ) : (
                tradeHistory.map((trade: any, i: number) => (
                  <tr key={i} className="text-slate-100 even:bg-slate-900/60">
                    <td className="px-3 py-2">{typeof trade.date === 'number' ? new Date(trade.date).toLocaleString() : trade.date}</td>
                    <td className="px-3 py-2">{trade.market}</td>
                    <td className="px-3 py-2 text-center">{trade.side}</td>
                    <td className="px-3 py-2 text-right">{trade.size}</td>
                    <td className="px-3 py-2 text-right">{trade.price}</td>
                    <td className={`px-3 py-2 text-right font-semibold ${trade.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{trade.pnl}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      {/* TODO: Add charts/visualizations here */}
      {isLoading && <div className="text-slate-400 text-center">Loading…</div>}
      {error && <div className="text-rose-400 text-center">{error}</div>}
    </section>
  );
}

  return (
    <section className="card p-6 space-y-10 mt-6">
      <h2 className="text-lg font-semibold text-white">Trader Dashboard</h2>
      <p className="text-sm text-slate-400 mb-4">Portfolio and PnL for <span className="font-mono">{address}</span></p>

      {/* Summary Stats */}
      <div className="flex flex-wrap gap-6 mb-2">
        <div className="flex flex-col items-center">
          <span className="text-2xl font-bold text-emerald-400">{totalPnl}</span>
          <span className="text-xs text-slate-400">Total PnL</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-2xl font-bold">{totalOpenPositions}</span>
          <span className="text-xs text-slate-400">Open Positions</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-2xl font-bold">{totalClosedPositions}</span>
          <span className="text-xs text-slate-400">Closed Positions</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-2xl font-bold">{totalOpenOrders}</span>
          <span className="text-xs text-slate-400">Open Orders</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-2xl font-bold">{totalTrades}</span>
          <span className="text-xs text-slate-400">Trade History</span>
        </div>
      </div>

      <hr className="border-slate-800 my-2" />

      {/* Open Positions */}
      <div>
        <h3 className="font-semibold text-slate-200 mb-2">Open Positions</h3>
        <div className="overflow-x-auto max-h-64">
          <table className="min-w-full text-sm mb-4 border-separate border-spacing-y-1">
            <thead>
              <tr className="text-slate-400 bg-slate-800">
                <th className="px-3 py-2 text-left">Market</th>
                <th className="px-3 py-2 text-right">Position</th>
                <th className="px-3 py-2 text-right">PnL</th>
                <th className="px-3 py-2 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {mockPortfolio.map((pos, i) => (
                <tr key={i} className="text-slate-100 even:bg-slate-900/60">
                  <td className="px-3 py-2">{pos.market}</td>
                  <td className="px-3 py-2 text-right">{pos.position}</td>
                  <td className={`px-3 py-2 text-right font-semibold ${pos.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{pos.pnl}</td>
                  <td className="px-3 py-2 text-center">{pos.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <hr className="border-slate-800 my-2" />

      {/* Open Orders */}
      <div>
        <h3 className="font-semibold text-slate-200 mb-2">Open Orders</h3>
        <div className="overflow-x-auto max-h-64">
          <table className="min-w-full text-sm mb-4 border-separate border-spacing-y-1">
            <thead>
              <tr className="text-slate-400 bg-slate-800">
                <th className="px-3 py-2 text-left">Market</th>
                <th className="px-3 py-2 text-center">Side</th>
                <th className="px-3 py-2 text-right">Size</th>
                <th className="px-3 py-2 text-right">Price</th>
                <th className="px-3 py-2 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {mockOrders.map((order, i) => (
                <tr key={i} className="text-slate-100 even:bg-slate-900/60">
                  <td className="px-3 py-2">{order.market}</td>
                  <td className="px-3 py-2 text-center">{order.side}</td>
                  <td className="px-3 py-2 text-right">{order.size}</td>
                  <td className="px-3 py-2 text-right">{order.price}</td>
                  <td className="px-3 py-2 text-center">{order.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <hr className="border-slate-800 my-2" />

      {/* Trade History */}
      <div>
        <h3 className="font-semibold text-slate-200 mb-2">Trade History</h3>
        <div className="overflow-x-auto max-h-64">
          <table className="min-w-full text-sm border-separate border-spacing-y-1">
            <thead>
              <tr className="text-slate-400 bg-slate-800">
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-left">Market</th>
                <th className="px-3 py-2 text-center">Side</th>
                <th className="px-3 py-2 text-right">Size</th>
                <th className="px-3 py-2 text-right">Price</th>
                <th className="px-3 py-2 text-right">PnL</th>
              </tr>
            </thead>
            <tbody>
              {mockHistory.map((trade, i) => (
                <tr key={i} className="text-slate-100 even:bg-slate-900/60">
                  <td className="px-3 py-2">{trade.date}</td>
                  <td className="px-3 py-2">{trade.market}</td>
                  <td className="px-3 py-2 text-center">{trade.side}</td>
                  <td className="px-3 py-2 text-right">{trade.size}</td>
                  <td className="px-3 py-2 text-right">{trade.price}</td>
                  <td className={`px-3 py-2 text-right font-semibold ${trade.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{trade.pnl}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {/* TODO: Add charts/visualizations here */}
    </section>
  );
}
