import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Trade } from '../hooks/useLiveTrades';

interface TradeListProps {
  trades: Trade[];
  onCopy: (trade: Trade) => void;
  isCopying: boolean;
  canCopy?: boolean;
}

function formatOutcome(outcome?: string | null) {
  if (!outcome) return 'Unknown';
  return outcome.replace(/_/g, ' ');
}

function getKey(trade: Trade) {
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

export function TradeList({ trades, onCopy, isCopying, canCopy = true }: TradeListProps) {
  // Sorting/filtering state
  const [sortKey, setSortKey] = React.useState<'date' | 'size' | 'price'>('date');
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('desc');
  const [filterText, setFilterText] = React.useState('');
  function generateAvatar(address: string) {
    const color = `hsl(${address.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360}, 70%, 55%)`;
    const initials = address.slice(2, 4).toUpperCase();
    const svg = `<svg width='64' height='64' xmlns='http://www.w3.org/2000/svg'>
      <defs>
        <filter id='shadow' x='-20%' y='-20%' width='140%' height='140%'>
          <feDropShadow dx='0' dy='2' stdDeviation='2' flood-color='#000' flood-opacity='0.18'/>
        </filter>
      </defs>
      <circle cx='32' cy='32' r='30' fill='${color}' stroke='white' stroke-width='4' filter='url(#shadow)'/>
      <text x='50%' y='54%' text-anchor='middle' font-size='28' font-family='Inter,Arial,sans-serif' font-weight='bold' fill='#fff' dy='.3em'>${initials}</text>
    </svg>`;
    return `data:image/svg+xml;base64,${btoa(svg.replace(/\n\s+/g, ''))}`;
  }

  const sortedTrades = [...trades].filter(trade => {
    if (!filterText) return true;
    return (
      (trade.market?.question || trade.market?.title || '').toLowerCase().includes(filterText.toLowerCase()) ||
      (trade.username || '').toLowerCase().includes(filterText.toLowerCase())
    );
  }).sort((a, b) => {
    let aVal, bVal;
    if (sortKey === 'date') {
      aVal = new Date(a.created_at || a.createdAt || a.timestamp || 0).getTime();
      bVal = new Date(b.created_at || b.createdAt || b.timestamp || 0).getTime();
    } else if (sortKey === 'size') {
      aVal = Number(a.amount || a.size || a.shares || 0);
      bVal = Number(b.amount || b.size || b.shares || 0);
    } else {
      aVal = Number(a.price ?? 0);
      bVal = Number(b.price ?? 0);
    }
    return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
  });

  if (trades.length === 0) {
    return (
      <div className="card p-8 text-center">
        <p className="text-slate-400">Enter a Polymarket address to start mirroring their orders in real-time.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4 items-center mb-2">
        <input
          type="text"
          placeholder="Filter by market or username..."
          value={filterText}
          onChange={e => setFilterText(e.target.value)}
          className="rounded border border-slate-700 bg-slate-900 px-3 py-1 text-sm text-slate-200"
        />
        <label className="text-xs text-slate-400">Sort by:</label>
        <select
          value={sortKey}
          onChange={e => setSortKey(e.target.value as any)}
          className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-200"
        >
          <option value="date">Date</option>
          <option value="size">Size</option>
          <option value="price">Price</option>
        </select>
        <button
          className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-200"
          onClick={() => setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))}
        >
          {sortDir === 'asc' ? '↑' : '↓'}
        </button>
      </div>
      {sortedTrades.map((trade) => {
        const createdAt = trade.created_at || trade.createdAt || trade.timestamp;
        const when = createdAt
          ? formatDistanceToNow(new Date(createdAt), {
              addSuffix: true
            })
          : 'unknown time';
        const marketQuestion = trade.market?.question || trade.market?.title || 'Unlabelled market';
        const side = (trade.side || trade.type || '').toUpperCase();
        const price = Number(trade.price ?? 0);
        const size = Number(trade.amount || trade.size || trade.shares || 0);
        let avatar = trade.avatarUrl;
        const address = trade.account || trade.user || trade.wallet || '';
        if (!avatar) {
          avatar = generateAvatar(address);
        }
        const username = trade.username || address || 'unknown';

        return (
          <article key={getKey(trade) || `${trade.created_at}-${trade.price}`} className="card p-5 flex flex-col gap-2">
            <header className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-slate-800 bg-slate-900">
                  <img src={avatar} alt="Trader avatar" className="h-full w-full object-cover" loading="lazy" />
                </span>
                <div>
                  <p className="text-xs uppercase text-slate-400 tracking-wide">{when}</p>
                  <h3 className="text-lg font-semibold text-slate-100">{marketQuestion}</h3>
                  <p className="text-xs text-slate-400">{username}</p>
                </div>
              </div>
              <span className={`px-3 py-1 text-xs font-semibold rounded-full ${side === 'BUY' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>
                {side || 'TRADE'}
              </span>
            </header>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-slate-300">
              <div>
                <p className="text-xs uppercase text-slate-500">Outcome</p>
                <p className="font-medium">{formatOutcome(trade.outcome || trade.outcomeToken)}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-slate-500">Price</p>
                <p className="font-medium">${price.toFixed(3)}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-slate-500">Size</p>
                <p className="font-medium">{size.toFixed(2)} shares</p>
              </div>
            </div>
            <button
              className="self-start mt-2 inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-primary/80 hover:bg-primary rounded-full transition"
              onClick={() => onCopy(trade)}
              disabled={isCopying || !canCopy}
            >
              {isCopying ? 'Preparing order…' : canCopy ? 'Copy trade' : 'Connect wallet to copy'}
            </button>
          </article>
        );
      })}
    </div>
  );
}
