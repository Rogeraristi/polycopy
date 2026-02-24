import React from 'react';

// TODO: Replace with real data fetching and visualization logic
export function TraderDashboard({ address }: { address: string }) {
  // Placeholder/mock data
  const mockPortfolio = [
    { market: 'Election 2028', position: 120, pnl: 350, status: 'Open' },
    { market: 'BTC > $100k', position: 50, pnl: -20, status: 'Closed' },
  ];
  const mockOrders = [
    { market: 'ETH > $10k', side: 'Buy', size: 10, price: 0.45, status: 'Open' },
  ];
  const mockHistory = [
    { date: '2026-02-20', market: 'Election 2028', side: 'Buy', size: 100, price: 0.30, pnl: 200 },
    { date: '2026-02-21', market: 'BTC > $100k', side: 'Sell', size: 50, price: 0.60, pnl: -20 },
  ];

  // Summary stats
  const totalOpenPositions = mockPortfolio.filter(p => p.status === 'Open').length;
  const totalClosedPositions = mockPortfolio.filter(p => p.status === 'Closed').length;
  const totalOpenOrders = mockOrders.length;
  const totalTrades = mockHistory.length;
  const totalPnl = mockPortfolio.reduce((sum, p) => sum + (p.pnl || 0), 0);

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
