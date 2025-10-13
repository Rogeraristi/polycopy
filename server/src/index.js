import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import { WebSocketServer } from 'ws';
import http from 'http';

const PORT = process.env.PORT || 4000;
const POLYMARKET_BASE = process.env.POLYMARKET_BASE || 'https://gamma-api.polymarket.com';

const app = express();
app.use(cors());
app.use(express.json());

function normaliseTradesPayload(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.data)) return payload.data;
  return [];
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json'
    }
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Request failed with ${response.status}: ${text}`);
  }
  return response.json();
}

async function fetchUserTrades(address) {
  const params = new URLSearchParams({
    account: address,
    limit: '25'
  });
  const url = `${POLYMARKET_BASE}/trades?${params.toString()}`;
  try {
    const payload = await fetchJson(url);
    return normaliseTradesPayload(payload);
  } catch (error) {
    console.error('Failed to fetch trades', error.message);
    return [];
  }
}

async function fetchMarkets() {
  const params = new URLSearchParams({
    limit: '50',
    closed: 'false'
  });
  const url = `${POLYMARKET_BASE}/markets?${params.toString()}`;
  try {
    const payload = await fetchJson(url);
    const data = Array.isArray(payload?.data) ? payload.data : payload;
    return data.map((market) => ({
      id: market.id || market.slug,
      question: market.question || market.title,
      outcomes: market.outcomes || market.outcomeTokens || [],
      volume24h: Number(market.volume24h || market.volume_24h || 0),
      liquidity: Number(market.liquidity || 0)
    }));
  } catch (error) {
    console.error('Failed to fetch markets', error.message);
    return [];
  }
}

app.get('/api/markets', async (_req, res) => {
  const markets = await fetchMarkets();
  res.json({ markets });
});

app.get('/api/users/:address/trades', async (req, res) => {
  const { address } = req.params;
  const trades = await fetchUserTrades(address);
  res.json({ trades });
});

app.post('/api/copy-trade', async (req, res) => {
  const { trade, targetWallet, sizeMultiplier = 1 } = req.body || {};
  if (!trade || !targetWallet) {
    return res.status(400).json({ error: 'trade and targetWallet are required' });
  }

  const multiplier = Number(sizeMultiplier) > 0 ? Number(sizeMultiplier) : 1;

  // Generate a payload that can be signed client-side for execution on Polymarket.
  const suggestedOrder = {
    marketId: trade.marketId || trade.market_id,
    outcome: trade.outcome || trade.outcomeToken,
    price: Number(trade.price),
    size: Number(trade.amount || trade.size || 0) * multiplier,
    side: trade.side || trade.type,
    copiedFrom: trade.account || trade.user || trade.wallet,
    timestamp: Date.now()
  };

  res.json({
    message: 'Generated suggested order. Submit this payload using the Polymarket trading API with your wallet signature.',
    order: suggestedOrder
  });
});

const server = http.createServer(app);

const wss = new WebSocketServer({ server, path: '/ws/trades' });

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const address = url.searchParams.get('address');

  if (!address) {
    ws.send(JSON.stringify({ type: 'error', message: 'Missing address query parameter' }));
    ws.close();
    return;
  }

  let lastTimestamp = 0;
  let closed = false;

  const sendTrades = async () => {
    if (closed) return;
    const trades = await fetchUserTrades(address);
    const freshTrades = trades.filter((trade) => {
      const createdAt = new Date(trade.created_at || trade.createdAt || trade.timestamp || 0).getTime();
      if (!Number.isFinite(createdAt)) return true;
      return createdAt > lastTimestamp;
    });

    if (freshTrades.length > 0) {
      lastTimestamp = Math.max(
        lastTimestamp,
        ...freshTrades.map((trade) => new Date(trade.created_at || trade.createdAt || trade.timestamp || 0).getTime())
      );
      ws.send(JSON.stringify({ type: 'trades', trades: freshTrades }));
    }
  };

  const interval = setInterval(sendTrades, 4000);
  sendTrades();

  ws.on('close', () => {
    closed = true;
    clearInterval(interval);
  });
});

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
