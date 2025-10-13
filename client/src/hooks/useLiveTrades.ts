import { useEffect, useMemo, useRef, useState } from 'react';

export interface Trade {
  id?: string;
  marketId?: string;
  market_id?: string;
  market?: { question?: string; title?: string };
  outcome?: string;
  outcomeToken?: string;
  price: number | string;
  side?: string;
  type?: string;
  amount?: number;
  size?: number;
  shares?: number;
  account?: string;
  user?: string;
  wallet?: string;
  transaction_hash?: string;
  txid?: string;
  created_at?: string;
  createdAt?: string;
  timestamp?: number;
}

export function useLiveTrades(address: string | null) {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!address) {
      setTrades([]);
      setError(null);
      return;
    }

    let isCancelled = false;
    const abort = new AbortController();

    const fetchInitial = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/users/${address}/trades`, {
          signal: abort.signal
        });
        if (!res.ok) {
          throw new Error(`Failed to fetch trades: ${res.status}`);
        }
        const data = await res.json();
        if (!isCancelled) {
          setTrades(Array.isArray(data?.trades) ? data.trades : []);
        }
      } catch (err) {
        if (!isCancelled) {
          setError(err instanceof Error ? err.message : 'Unknown error');
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchInitial();

    return () => {
      isCancelled = true;
      abort.abort();
    };
  }, [address]);

  useEffect(() => {
    if (!address) return;

    const ws = new WebSocket(`${window.location.origin.replace(/^http/, 'ws')}/ws/trades?address=${address}`);
    socketRef.current = ws;

    ws.onmessage = (event) => {
      const payload = JSON.parse(event.data);
      if (payload.type === 'trades' && Array.isArray(payload.trades)) {
        const receivedAt = Date.now();
        setTrades((prev) => {
          const merged = [...payload.trades, ...prev];
          const uniqueMap = new Map<string, Trade>();
          merged.forEach((trade) => {
            const key = [
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
            if (!uniqueMap.has(key)) {
              uniqueMap.set(key, trade);
            }
          });
          return Array.from(uniqueMap.values()).sort((a, b) => {
            const ta = new Date(a.created_at || a.createdAt || a.timestamp || 0).getTime();
            const tb = new Date(b.created_at || b.createdAt || b.timestamp || 0).getTime();
            return tb - ta;
          });
        });

        const lastTrade = payload.trades[0];
        const tradeTime = new Date(lastTrade?.created_at || lastTrade?.createdAt || lastTrade?.timestamp || 0).getTime();
        if (Number.isFinite(tradeTime)) {
          setLatencyMs(Math.max(0, Math.round(receivedAt - tradeTime)));
        } else {
          setLatencyMs(null);
        }
      }
      if (payload.type === 'error') {
        setError(payload.message ?? 'WebSocket error');
      }
    };

    ws.onerror = () => {
      setError('Connection error');
    };

    ws.onclose = () => {
      socketRef.current = null;
    };

    return () => {
      ws.close();
    };
  }, [address]);

  const stats = useMemo(() => {
    if (trades.length === 0) {
      return { winRate: null, averageSize: null };
    }
    const wins = trades.filter((trade) => (trade.side || trade.type)?.toLowerCase() === 'buy').length;
    const averageSize =
      trades.reduce((acc, trade) => acc + Number(trade.amount || trade.size || trade.shares || 0), 0) / trades.length;
    return {
      winRate: Math.round((wins / trades.length) * 100),
      averageSize: Number.isFinite(averageSize) ? averageSize : null
    };
  }, [trades]);

  return {
    trades,
    isLoading,
    error,
    latencyMs,
    stats
  };
}
