import { useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';

export default function TraderProfile() {
  const { address } = useParams<{ address: string }>();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!address) return;
    setLoading(true);
    setError(null);
    fetch(`${import.meta.env.VITE_API_BASE_URL}/users/${address}/trades`)
      .then((res) => res.json())
      .then((data) => {
        setProfile(data);
        setLoading(false);
      })
      .catch((err) => {
        setError('Failed to load trader data');
        setLoading(false);
      });
  }, [address]);

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Trader Profile</h1>
      <div className="mb-2 text-slate-400">Address: <span className="font-mono">{address}</span></div>
      {loading && <div>Loading...</div>}
      {error && <div className="text-rose-400">{error}</div>}
      {profile && (
        <div>
          <h2 className="text-lg font-semibold mb-2">Trade History</h2>
          {Array.isArray(profile.trades) && profile.trades.length > 0 ? (
            <table className="min-w-full text-sm border-separate border-spacing-y-1">
              <thead>
                <tr className="text-slate-400 bg-slate-800">
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Market</th>
                  <th className="px-3 py-2 text-center">Side</th>
                  <th className="px-3 py-2 text-right">Size</th>
                  <th className="px-3 py-2 text-right">Price</th>
                </tr>
              </thead>
              <tbody>
                {profile.trades.map((trade: any, i: number) => (
                  <tr key={i} className="text-slate-100 even:bg-slate-900/60">
                    <td className="px-3 py-2">{typeof trade.date === 'number' ? new Date(trade.date).toLocaleString() : trade.date}</td>
                    <td className="px-3 py-2">{trade.market}</td>
                    <td className="px-3 py-2 text-center">{trade.side}</td>
                    <td className="px-3 py-2 text-right">{trade.size}</td>
                    <td className="px-3 py-2 text-right">{trade.price}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div>No trades found.</div>
          )}
        </div>
      )}
    </div>
  );
}
