import React from 'react';

// TODO: Replace with real data fetching and visualization logic
export function TraderDashboard({ address }: { address: string }) {
  // Placeholder/mock data (replace with real data integration)
  const mockProfile = {
    username: 'polymarketer',
    avatarUrl: null // or a real URL
  };
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

  // Fallback avatar
  const avatarUrl = mockProfile.avatarUrl || require('../assets/polymarket-default-avatar.png');

  return (
    <section className="card p-6 space-y-8 mt-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-4 mb-2">
        <span className="inline-flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-slate-700 bg-slate-900">
          <img src={avatarUrl} alt="Trader avatar" className="h-full w-full object-cover" loading="lazy" />
        </span>
        <div>
          <h2 className="text-xl font-bold text-white">{mockProfile.username || address}</h2>
          <p className="text-xs text-slate-400 font-mono break-all">{address}</p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <h3 className="font-semibold text-slate-200 mb-2">Open Positions</h3>
          <table className="w-full text-sm mb-4">
            <thead>
              <tr className="text-slate-400">
                <th>Market</th><th>Position</th><th>PnL</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {mockPortfolio.map((pos, i) => (
                <tr key={i} className="text-slate-100">
                  <td>{pos.market}</td><td>{pos.position}</td><td>{pos.pnl}</td><td>{pos.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <h3 className="font-semibold text-slate-200 mb-2">Open Orders</h3>
          <table className="w-full text-sm mb-4">
            <thead>
              <tr className="text-slate-400">
                <th>Market</th><th>Side</th><th>Size</th><th>Price</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {mockOrders.map((order, i) => (
                <tr key={i} className="text-slate-100">
                  <td>{order.market}</td><td>{order.side}</td><td>{order.size}</td><td>{order.price}</td><td>{order.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div>
        <h3 className="font-semibold text-slate-200 mb-2">Trade History</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-slate-400">
              <th>Date</th><th>Market</th><th>Side</th><th>Size</th><th>Price</th><th>PnL</th>
            </tr>
          </thead>
          <tbody>
            {mockHistory.map((trade, i) => (
              <tr key={i} className="text-slate-100">
                <td>{trade.date}</td><td>{trade.market}</td><td>{trade.side}</td><td>{trade.size}</td><td>{trade.price}</td><td>{trade.pnl}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* TODO: Add charts/visualizations here */}
    </section>
  );
}
