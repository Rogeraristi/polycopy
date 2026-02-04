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
  if (trades.length === 0) {
    return (
      <div className="card p-8 text-center">
        <p className="text-slate-400">Enter a Polymarket address to start mirroring their orders in real-time.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {trades.map((trade) => {
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

        return (
          <article key={getKey(trade) || `${trade.created_at}-${trade.price}`} className="card p-5 flex flex-col gap-2">
            <header className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase text-slate-400 tracking-wide">{when}</p>
                <h3 className="text-lg font-semibold text-slate-100">{marketQuestion}</h3>
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
              <div>
                <p className="text-xs uppercase text-slate-500">Trader</p>
                <p className="font-mono text-xs break-all text-slate-400">{trade.account || trade.user || trade.wallet || 'unknown'}</p>
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
