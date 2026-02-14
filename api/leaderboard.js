// Vercel serverless API handler for leaderboard
import fetch from 'node-fetch';

const LEADERBOARD_PERIODS = {
  today: 'today',
  weekly: 'weekly',
  monthly: 'monthly',
  all: 'all',
};

const LEADERBOARD_LIMIT = 12;

export default async function handler(req, res) {
  try {
    const periods = {};
    const labels = {
      today: 'Today',
      weekly: 'This Week',
      monthly: 'This Month',
      all: 'All Time',
    };
    await Promise.all(
      Object.entries(LEADERBOARD_PERIODS).map(async ([key, period]) => {
        const query = `query { leaderboard(period: \"${period}\", limit: ${LEADERBOARD_LIMIT}) { address profit volume rank trades name } }`;
        const response = await fetch('https://gamma-api.polymarket.com/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'polycopy/1.0 (+https://polymarket.com)'
          },
          body: JSON.stringify({ query })
        });
        const data = await response.json();
        const entries = Array.isArray(data?.data?.leaderboard)
          ? data.data.leaderboard.map((entry, index) => ({
              address: entry.address?.toLowerCase() || '',
              displayName: entry.name || (entry.address?.length > 10 ? `${entry.address.slice(0, 6)}…${entry.address.slice(-4)}` : entry.address),
              rank: Number.isFinite(Number(entry.rank)) ? Number(entry.rank) : index + 1,
              pnl: typeof entry.profit === 'number' ? entry.profit : null,
              volume: typeof entry.volume === 'number' ? entry.volume : null,
              trades: typeof entry.trades === 'number' ? entry.trades : null,
              roi: null // Not provided by API
            }))
          : [];
        if (entries.length > 0) {
          periods[key] = entries;
        }
      })
    );
    const availableKeys = Object.keys(periods);
    const defaultPeriod = availableKeys.includes('weekly') ? 'weekly' : availableKeys[0] || 'weekly';
    res.status(200).json({ periods, labels, defaultPeriod, limit: LEADERBOARD_LIMIT, fetchedAt: Date.now(), source: 'graphql' });
  } catch (error) {
    res.status(503).json({ error: 'Leaderboard data is unavailable right now. Try again shortly.' });
  }
}
