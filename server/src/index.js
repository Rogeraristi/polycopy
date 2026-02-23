import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

defaults = {
  PORT: 4000,
  LEADERBOARD_LIMIT: 12,
  APIFY_LEADERBOARD_URL: 'https://api.apify.com/v2/datasets/8QwKQwKQwKQwKQwKQ/items?format=json&clean=true'
};

const PORT = process.env.PORT || defaults.PORT;
const LEADERBOARD_LIMIT = Number.isFinite(Number(process.env.LEADERBOARD_LIMIT)) ? Math.max(1, Math.min(Number(process.env.LEADERBOARD_LIMIT), 50)) : defaults.LEADERBOARD_LIMIT;
const APIFY_LEADERBOARD_URL = process.env.APIFY_LEADERBOARD_URL || defaults.APIFY_LEADERBOARD_URL;

const app = express();
app.use(cors());
app.use(express.json());

function normaliseLeaderboardEntries(payload, fallbackLimit) {
  const data = Array.isArray(payload) ? payload : [];
  return data
    .map((entry, index) => {
      const address = entry?.address || entry?.account || entry?.owner || entry?.wallet || entry?.proxyWallet || entry?.user || '';
      if (!address || typeof address !== 'string') return null;
      const rank = Number.isFinite(Number(entry?.rank)) ? Number(entry.rank) : index + 1;
      const pnl = typeof entry.profit === 'number' ? entry.profit : null;
      const volume = typeof entry.volume === 'number' ? entry.volume : null;
      const trades = typeof entry.trades === 'number' ? entry.trades : null;
      const displayName = entry?.name || (address.length > 10 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address);
      return { address: address.toLowerCase(), displayName, rank, pnl, volume, trades };
    })
    .filter(Boolean)
    .slice(0, fallbackLimit);
}

async function fetchLeaderboardSnapshots(limit = LEADERBOARD_LIMIT) {
  let periods = {};
  let labels = {};
  let source = 'apify';
  let fetchedAt = Date.now();
  let defaultPeriod = 'weekly';
  try {
    const response = await fetch(APIFY_LEADERBOARD_URL);
    if (!response.ok) throw new Error(`Apify leaderboard fetch failed: ${response.status}`);
    const apifyData = await response.json();
    const entries = normaliseLeaderboardEntries(apifyData, limit);
    periods[defaultPeriod] = entries;
    labels[defaultPeriod] = 'Leaderboard';
    fetchedAt = Date.now();
  } catch (error) {
    console.error('Failed to fetch leaderboard from Apify', error);
    periods = {};
    labels = {};
  }
  return { periods, labels, defaultPeriod, fetchedAt, source };
}

app.get('/api/leaderboard', async (req, res) => {
  try {
    const snapshot = await fetchLeaderboardSnapshots(LEADERBOARD_LIMIT);
    res.json({ periods: snapshot.periods, labels: snapshot.labels, defaultPeriod: snapshot.defaultPeriod, limit: LEADERBOARD_LIMIT, fetchedAt: snapshot.fetchedAt || null, source: snapshot.source || 'unknown' });
  } catch (error) {
    res.status(503).json({ error: 'Leaderboard data is unavailable right now. Try again shortly.' });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
