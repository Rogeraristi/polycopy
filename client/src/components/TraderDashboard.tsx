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

  return (
    <section className="card p-6 space-y-8 mt-6">
      <h2 className="text-lg font-semibold text-white">Trader Dashboard</h2>
      <p className="text-sm text-slate-400 mb-4">Portfolio and PnL for <span className="font-mono">{address}</span></p>

      {/* Open Positions */}
      <div>
        <h3 className="font-semibold text-slate-200 mb-2">Open Positions</h3>
        <div className="overflow-x-auto">
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

      {/* Open Orders */}
      <div>
        <h3 className="font-semibold text-slate-200 mb-2">Open Orders</h3>
        <div className="overflow-x-auto">
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

      {/* Trade History */}
      <div>
        <h3 className="font-semibold text-slate-200 mb-2">Trade History</h3>
        <div className="overflow-x-auto">
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
