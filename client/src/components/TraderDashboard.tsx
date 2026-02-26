
import React, { useEffect, useMemo, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, Legend
} from 'recharts';
import type { Trade } from '../hooks/useLiveTrades';
import PolymarketLoading from './PolymarketLoading';




export function TraderDashboard({ address }: { address: string }) {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [portfolioValue, setPortfolioValue] = useState<number | null>(null);
  const [pnl, setPnl] = useState<number | null>(null);
  const [openOrders, setOpenOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!address) {
      setTrades([]);
      setPortfolioValue(null);
      setPnl(null);
      setOpenOrders([]);
      setError(null);
      return;
    }
    let isCancelled = false;
    const abort = new AbortController();
    async function fetchAll() {
      setIsLoading(true);
      setError(null);
      try {
        const API_BASE = (import.meta as any).env.VITE_API_BASE_URL || '/api';
        // Fetch trades
        const tradesRes = await fetch(`${API_BASE}/users/${address}/trades`, {
          signal: abort.signal,
          credentials: 'include',
        });
        const tradesData = await tradesRes.json();
        if (!isCancelled) setTrades(Array.isArray(tradesData?.trades) ? tradesData.trades : []);

        // Fetch portfolio value
        const portfolioRes = await fetch(`${API_BASE}/users/${address}/portfolio`, { signal: abort.signal, credentials: 'include' });
        const portfolioData = await portfolioRes.json();
        if (!isCancelled) setPortfolioValue(typeof portfolioData?.portfolioValue === 'number' ? portfolioData.portfolioValue : null);

        // Fetch PnL
        const pnlRes = await fetch(`${API_BASE}/users/${address}/pnl`, { signal: abort.signal, credentials: 'include' });
        const pnlData = await pnlRes.json();
        if (!isCancelled) setPnl(typeof pnlData?.pnl === 'number' ? pnlData.pnl : null);

        // Fetch open orders
        const ordersRes = await fetch(`${API_BASE}/users/${address}/open-orders`, { signal: abort.signal, credentials: 'include' });
        const ordersData = await ordersRes.json();
        if (!isCancelled) setOpenOrders(Array.isArray(ordersData?.openOrders) ? ordersData.openOrders : []);
      } catch (err) {
        if (!isCancelled) setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    }
    fetchAll();
    return () => {
      isCancelled = true;
      abort.abort();
    };
  }, [address]);

  // Derive portfolio, orders, and history from trades (simple logic for demo)
  // Derive open positions and trade history from trades
  const { openPositions, tradeHistory } = useMemo(() => {
    let openPositions: any[] = [];
    let tradeHistory: any[] = [];
    if (Array.isArray(trades)) {
      tradeHistory = trades.map((t) => ({
        date: t.created_at || t.createdAt || t.timestamp || '',
        market: typeof t.market === 'string' ? t.market : t.market?.question || t.market?.title || t.marketId || t.market_id || '',
        side: t.side || t.type || '',
        size: t.amount || t.size || t.shares || '',
        price: t.price,
        pnl: 0,
      }));
      const marketMap: Record<string, any> = {};
      trades.forEach((t) => {
        const market = typeof t.market === 'string' ? t.market : t.market?.question || t.market?.title || t.marketId || t.market_id || '';
        if (!marketMap[market]) {
          marketMap[market] = { market, position: 0, pnl: 0, status: 'Open' };
        }
        marketMap[market].position += Number(t.amount || t.size || t.shares || 0);
      });
      openPositions = Object.values(marketMap);
    }
    return { openPositions, tradeHistory };
  }, [trades]);

  const totalOpenPositions = openPositions.length;
  const totalOpenOrders = openOrders.length;
  const totalTrades = tradeHistory.length;

  // Helper for formatting numbers
  function fmt(val: number | null, opts: Intl.NumberFormatOptions = { maximumFractionDigits: 2 }) {
    if (val === null || val === undefined || isNaN(val)) return '—';
    return val.toLocaleString(undefined, opts);
  }

  // Tooltip component
  const Tooltip = ({ text, children }: { text: string, children: React.ReactNode }) => (
    <span className="relative group cursor-help">
      {children}
      <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover:block bg-slate-800 text-xs text-slate-100 px-2 py-1 rounded shadow-lg z-10 whitespace-nowrap">
        {text}
      </span>
    </span>
  );


  // Build PnL over time data (mock logic: cumulative trade count as PnL)
  const pnlChartData = useMemo(() => {
    let cumPnl = 0;
    return trades.map((t, i) => {
      // Replace with real PnL logic if available
      cumPnl += 0; // No real PnL in trade, so stays flat
      return {
        date: t.created_at || t.createdAt || t.timestamp || i,
        pnl: cumPnl,
      };
    });
  }, [trades]);

  // Trade volume per day (mock logic)
  const tradeVolumeData = useMemo(() => {
    const volumeMap: Record<string, number> = {};
    trades.forEach((t) => {
      const d = t.created_at || t.createdAt || t.timestamp;
      const day = d ? new Date(d).toLocaleDateString() : 'Unknown';
      volumeMap[day] = (volumeMap[day] || 0) + Number(t.amount || t.size || t.shares || 0);
    });
    return Object.entries(volumeMap).map(([day, volume]) => ({ day, volume }));
  }, [trades]);

  // PnL Over Time Chart
  const PnLChart = () => (
    <div className="w-full h-48 bg-slate-900/60 rounded mb-4 p-2">
      <h4 className="text-xs text-slate-400 mb-1">PnL Over Time</h4>
      <ResponsiveContainer width="100%" height="90%">
        <LineChart data={pnlChartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} />
          <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
          <RechartsTooltip contentStyle={{ background: '#1e293b', border: 'none', color: '#fff' }} />
          <Line type="monotone" dataKey="pnl" stroke="#34d399" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );

  // Trade Volume Bar Chart
  const TradeVolumeChart = () => (
    <div className="w-full h-48 bg-slate-900/60 rounded mb-4 p-2">
      <h4 className="text-xs text-slate-400 mb-1">Trade Volume Per Day</h4>
      <ResponsiveContainer width="100%" height="90%">
        <BarChart data={tradeVolumeData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#94a3b8' }} />
          <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
          <RechartsTooltip contentStyle={{ background: '#1e293b', border: 'none', color: '#fff' }} />
          <Bar dataKey="volume" fill="#60a5fa" />
          <Legend />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );

  return (
    <section className="card p-6 space-y-10 mt-6 shadow-2xl border border-slate-800 bg-gradient-to-b from-slate-900/80 to-slate-900/60">
      <h2 className="text-lg font-semibold text-white">Trader Dashboard</h2>
      <p className="text-sm text-slate-400 mb-4">Portfolio and PnL for <span className="font-mono">{address}</span></p>

      {/* Summary Stats */}
      <div className="flex flex-wrap gap-6 mb-2">
        <Tooltip text="Total realized and unrealized profit/loss">
          <div className="flex flex-col items-center">
            <span className={`text-2xl font-bold ${pnl !== null && pnl < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>{fmt(pnl)}</span>
            <span className="text-xs text-slate-400">Total PnL</span>
          </div>
        </Tooltip>
        <Tooltip text="Number of markets with open positions">
          <div className="flex flex-col items-center">
            <span className="text-2xl font-bold">{totalOpenPositions}</span>
            <span className="text-xs text-slate-400">Open Positions</span>
          </div>
        </Tooltip>
        <Tooltip text="Current total portfolio value (USD)">
          <div className="flex flex-col items-center">
            <span className="text-2xl font-bold">{fmt(portfolioValue, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })}</span>
            <span className="text-xs text-slate-400">Portfolio Value</span>
          </div>
        </Tooltip>
        <Tooltip text="Number of open orders">
          <div className="flex flex-col items-center">
            <span className="text-2xl font-bold">{totalOpenOrders}</span>
            <span className="text-xs text-slate-400">Open Orders</span>
          </div>
        </Tooltip>
        <Tooltip text="Number of trades in history">
          <div className="flex flex-col items-center">
            <span className="text-2xl font-bold">{totalTrades}</span>
            <span className="text-xs text-slate-400">Trade History</span>
          </div>
        </Tooltip>
      </div>

      <PnLChart />
      <TradeVolumeChart />

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
      {isLoading && (
        <div className="rounded-xl border border-slate-800/60 bg-slate-900/50">
          <PolymarketLoading compact label="Loading PolyCopy Trader Data" />
        </div>
      )}
      {error && <div className="text-rose-400 text-center">{error}</div>}

    </section>
  );


  return (
    <section className="card p-6 space-y-10 mt-6">
      <h2 className="text-lg font-semibold text-white">Trader Dashboard</h2>
      <p className="text-sm text-slate-400 mb-4">Portfolio and PnL for <span className="font-mono">{address}</span></p>

      {/* Summary Stats */}
      <div className="flex flex-wrap gap-6 mb-2">
        <div className="flex flex-col items-center">
          <span className="text-2xl font-bold text-emerald-400">{pnl !== null ? pnl : '—'}</span>
          <span className="text-xs text-slate-400">Total PnL</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-2xl font-bold">{totalOpenPositions}</span>
          <span className="text-xs text-slate-400">Open Positions</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-2xl font-bold">{portfolioValue !== null ? portfolioValue : '—'}</span>
          <span className="text-xs text-slate-400">Portfolio Value</span>
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
              {openPositions.length === 0 ? (
                <tr><td colSpan={4} className="text-center text-slate-500 py-2">No open positions</td></tr>
              ) : (
                openPositions.map((pos: any, i: number) => (
                  <tr key={i} className="text-slate-100 even:bg-slate-900/60 hover:bg-slate-800/60 transition-colors">
                    <td className="px-3 py-2">{pos.market}</td>
                    <td className="px-3 py-2 text-right">{fmt(pos.position)}</td>
                    <td className={`px-3 py-2 text-right font-semibold ${pos.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{fmt(pos.pnl)}</td>
                    <td className="px-3 py-2 text-center">{pos.status}</td>
                  </tr>
                ))
              )}
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
                  <tr key={i} className="text-slate-100 even:bg-slate-900/60 hover:bg-slate-800/60 transition-colors">
                    <td className="px-3 py-2">{order.market}</td>
                    <td className="px-3 py-2 text-center">{order.side}</td>
                    <td className="px-3 py-2 text-right">{fmt(order.size)}</td>
                    <td className="px-3 py-2 text-right">{fmt(order.price)}</td>
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
                  <tr key={i} className="text-slate-100 even:bg-slate-900/60 hover:bg-slate-800/60 transition-colors">
                    <td className="px-3 py-2">{typeof trade.date === 'number' ? new Date(trade.date).toLocaleString() : trade.date}</td>
                    <td className="px-3 py-2">{trade.market}</td>
                    <td className="px-3 py-2 text-center">{trade.side}</td>
                    <td className="px-3 py-2 text-right">{fmt(trade.size)}</td>
                    <td className="px-3 py-2 text-right">{fmt(trade.price)}</td>
                    <td className={`px-3 py-2 text-right font-semibold ${trade.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{fmt(trade.pnl)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      {/* TODO: Add charts/visualizations here */}
      {isLoading && (
        <div className="rounded-xl border border-slate-800/60 bg-slate-900/50">
          <PolymarketLoading compact label="Loading PolyCopy Trader Data" />
        </div>
      )}
      {error && <div className="text-rose-400 text-center">{error}</div>}
    </section>
  );
}
