// Vercel serverless API handler for trader search
import fetch from 'node-fetch';

export default async function handler(req, res) {
  const { query = '', limit = 8 } = req.query || {};
  try {
    const gql = `query { searchProfiles(query: \"${query}\", limit: ${limit}) { address name } }`;
    const response = await fetch('https://gamma-api.polymarket.com/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'polycopy/1.0 (+https://polymarket.com)'
      },
      body: JSON.stringify({ query: gql })
    });
    const data = await response.json();
    const traders = Array.isArray(data?.data?.searchProfiles)
      ? data.data.searchProfiles.map((entry) => ({
          address: entry.address?.toLowerCase() || '',
          displayName: entry.name || (entry.address?.length > 10 ? `${entry.address.slice(0, 6)}…${entry.address.slice(-4)}` : entry.address)
        }))
      : [];
    res.status(200).json({ traders });
  } catch (error) {
    res.status(503).json({ error: 'Trader search is unavailable right now.' });
  }
}
