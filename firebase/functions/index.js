import { onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import admin from 'firebase-admin';
import fetch from 'node-fetch';

const APP = admin.apps.length ? admin.app() : admin.initializeApp();
const firestore = APP.firestore();

const FIRESTORE_COLLECTION =
  process.env.FIREBASE_LEADERBOARD_COLLECTION || process.env.LEADERBOARD_COLLECTION || 'leaderboardSnapshots';
const FIRESTORE_HISTORY_COLLECTION =
  process.env.FIREBASE_LEADERBOARD_HISTORY_COLLECTION || 'leaderboardSnapshotsHistory';

const DEFAULT_LIMIT = Number.isFinite(Number(process.env.LEADERBOARD_LIMIT))
  ? Math.max(1, Math.min(Number(process.env.LEADERBOARD_LIMIT), 50))
  : 12;

const LEADERBOARD_PERIODS = {
  today: { path: '/leaderboard/overall/today/profit', label: 'Today' },
  weekly: { path: '/leaderboard/overall/weekly/profit', label: 'This Week' },
  monthly: { path: '/leaderboard/overall/monthly/profit', label: 'This Month' },
  all: { path: '/leaderboard/overall/all/profit', label: 'All Time' }
};

const LEADERBOARD_DEFAULT_PERIOD = 'weekly';

const USER_AGENT = process.env.LEADERBOARD_USER_AGENT || 'polycopy-functions/1.0 (+https://polymarket.com)';
const POLYMARKET_BASE = process.env.POLYMARKET_BASE || 'https://gamma-api.polymarket.com';
const NORMALISED_POLYMARKET_BASE = POLYMARKET_BASE.replace(/\/$/, '');
const POLYMARKET_HTML_BASE = process.env.POLYMARKET_HTML_BASE || 'https://polymarket.com';

function toFiniteNumber(value) {
  const asNumber = typeof value === 'string' || typeof value === 'number' ? Number(value) : NaN;
  return Number.isFinite(asNumber) ? asNumber : null;
}

function normaliseLeaderboardEntries(payload, fallbackLimit) {
  const data =
    (Array.isArray(payload?.data) && payload.data) ||
    (Array.isArray(payload?.leaders) && payload.leaders) ||
    (Array.isArray(payload?.results) && payload.results) ||
    (Array.isArray(payload?.accounts) && payload.accounts) ||
    (Array.isArray(payload) && payload) ||
    [];

  return data
    .map((entry, index) => {
      const address =
        entry?.address ||
        entry?.account ||
        entry?.owner ||
        entry?.wallet ||
        entry?.proxyWallet ||
        entry?.user ||
        entry?.account_id ||
        entry?.accountId ||
        '';

      if (!address || typeof address !== 'string') {
        return null;
      }

      const rank = Number.isFinite(Number(entry?.rank)) ? Number(entry.rank) : index + 1;
      const pnl =
        toFiniteNumber(entry?.pnl) ??
        toFiniteNumber(entry?.netPnL) ??
        toFiniteNumber(entry?.realizedPnL) ??
        toFiniteNumber(entry?.profit);
      const volume =
        toFiniteNumber(entry?.volume) ??
        toFiniteNumber(entry?.totalVolume) ??
        toFiniteNumber(entry?.total_volume) ??
        toFiniteNumber(entry?.notional);

      const roi =
        toFiniteNumber(entry?.roi) ??
        toFiniteNumber(entry?.return) ??
        toFiniteNumber(entry?.percentage_return) ??
        toFiniteNumber(entry?.return_percentage) ??
        (pnl !== null && volume !== null && volume !== 0 ? Number(((pnl / volume) * 100).toFixed(2)) : null);

      const displayName =
        entry?.name ||
        entry?.username ||
        entry?.handle ||
        entry?.pseudonym ||
        (address.length > 10 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address);

      return {
        address: address.toLowerCase(),
        displayName,
        rank,
        roi,
        pnl,
        volume,
        trades:
          toFiniteNumber(entry?.trades) ??
          toFiniteNumber(entry?.tradeCount) ??
          toFiniteNumber(entry?.trade_count) ??
          toFiniteNumber(entry?.fills) ??
          null,
        avatarUrl:
          entry?.profileImageOptimized ||
          entry?.profileImage ||
          entry?.avatarUrl ||
          entry?.avatar ||
          entry?.image ||
          null
      };
    })
    .filter(Boolean)
    .slice(0, fallbackLimit);
}

function extractLeaderboardEntriesFromNextPayload(payload, limit) {
  if (!payload) {
    return [];
  }

  const queries = payload?.props?.pageProps?.dehydratedState?.queries;
  if (Array.isArray(queries)) {
    const profitQuery = queries.find((query) => {
      const key = query?.queryKey;
      return Array.isArray(key) && key.includes('profit');
    });
    if (profitQuery && Array.isArray(profitQuery?.state?.data)) {
      const entries = normaliseLeaderboardEntries(profitQuery.state.data, limit);
      if (entries.length > 0) {
        return entries;
      }
    }
  }

  const candidateArrays = [];
  const visited = new WeakSet();

  const visit = (value) => {
    if (!value || typeof value !== 'object') {
      return;
    }
    if (visited.has(value)) {
      return;
    }
    visited.add(value);

    if (Array.isArray(value)) {
      if (value.length > 0 && typeof value[0] === 'object' && value[0] !== null) {
        candidateArrays.push(value);
      }
      value.forEach(visit);
      return;
    }

    Object.values(value).forEach(visit);
  };

  visit(payload?.props?.pageProps);

  for (const array of candidateArrays) {
    const entries = normaliseLeaderboardEntries(array, limit);
    if (entries.length > 0) {
      return entries;
    }
  }

  return [];
}

async function fetchLeaderboardFromPath(path, limit = DEFAULT_LIMIT) {
  const normalisedPath = path.startsWith('/') ? path : `/${path}`;
  const url = `${POLYMARKET_HTML_BASE.replace(/\/$/, '')}${normalisedPath}`;

  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9'
    }
  });

  if (!response.ok) {
    throw new Error(`Leaderboard request failed with ${response.status}`);
  }

  const html = await response.text();
  const match = html.match(/__NEXT_DATA__" type="application\/json" crossorigin="anonymous">(.*?)<\/script>/);
  if (!match) {
    throw new Error('Leaderboard payload missing __NEXT_DATA__');
  }

  const payload = JSON.parse(match[1]);
  return extractLeaderboardEntriesFromNextPayload(payload, limit);
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': USER_AGENT,
      'Cache-Control': 'no-cache'
    }
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Request failed (${response.status}): ${text}`);
  }
  return response.json();
}

async function fetchFallbackLeaderboard(limit = DEFAULT_LIMIT) {
  const candidatePaths = [
    `/leaderboard?limit=${limit}&period=7d`,
    `/leaderboard/traders?limit=${limit}&period=7d`,
    `/trades/leaderboard?limit=${limit}`,
    `/leaderboard/accounts?limit=${limit}`
  ];

  for (const path of candidatePaths) {
    const url = `${NORMALISED_POLYMARKET_BASE}${path}`;
    try {
      const payload = await fetchJson(url);
      const entries = normaliseLeaderboardEntries(payload, limit);
      if (entries.length > 0) {
        return entries;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('404')) {
        continue;
      }
      console.warn(`Fallback leaderboard fetch failed for ${url}`, message);
    }
  }

  return [];
}

async function fetchLeaderboardSnapshots(limit = DEFAULT_LIMIT) {
  const results = await Promise.all(
    Object.entries(LEADERBOARD_PERIODS).map(async ([key, config]) => {
      try {
        const entries = await fetchLeaderboardFromPath(config.path, limit);
        return { key, config, entries };
      } catch (error) {
        console.error(`Failed to fetch leaderboard period ${key}`, error);
        return { key, config, entries: [] };
      }
    })
  );

  const periods = {};
  const labels = {};

  results.forEach(({ key, config, entries }) => {
    if (Array.isArray(entries) && entries.length > 0) {
      periods[key] = entries;
      labels[key] = config.label;
    }
  });

  let source = 'scrape';

  if (Object.keys(periods).length === 0) {
    const fallback = await fetchFallbackLeaderboard(limit);
    if (fallback.length > 0) {
      periods[LEADERBOARD_DEFAULT_PERIOD] = fallback;
      labels[LEADERBOARD_DEFAULT_PERIOD] =
        LEADERBOARD_PERIODS[LEADERBOARD_DEFAULT_PERIOD]?.label || 'Top Traders';
      source = 'fallback';
    }
  }

  if (Object.keys(periods).length === 0) {
    throw new Error('No leaderboard data available from Polymarket');
  }

  const orderedKeys = Object.keys(LEADERBOARD_PERIODS).filter(
    (key) => Array.isArray(periods[key]) && periods[key].length
  );
  const availableKeys = orderedKeys.length ? orderedKeys : Object.keys(periods);
  const defaultPeriod =
    availableKeys.find((key) => key === LEADERBOARD_DEFAULT_PERIOD) || availableKeys[0] || null;

  return {
    periods,
    labels,
    defaultPeriod,
    source,
    fetchedAt: Date.now()
  };
}

async function persistSnapshot(snapshot) {
  if (!snapshot || !snapshot.periods || !Object.keys(snapshot.periods).length) {
    throw new Error('Snapshot is empty; aborting Firestore write.');
  }

  const fetchedAt = admin.firestore.FieldValue.serverTimestamp();
  const docRef = firestore.collection(FIRESTORE_COLLECTION).doc('latest');
  const historyRef = firestore.collection(FIRESTORE_HISTORY_COLLECTION).doc();

  const payload = {
    fetchedAt,
    source: snapshot.source || 'polymarket.com',
    labels: snapshot.labels,
    defaultPeriod: snapshot.defaultPeriod,
    periods: snapshot.periods,
    limit: DEFAULT_LIMIT
  };

  const batch = firestore.batch();
  batch.set(docRef, payload, { merge: true });
  batch.set(historyRef, { ...payload, createdAt: fetchedAt });

  await batch.commit();
  return { docPath: docRef.path, historyDocPath: historyRef.path };
}

async function handleLeaderboardRefresh() {
  const snapshot = await fetchLeaderboardSnapshots(DEFAULT_LIMIT);
  const result = await persistSnapshot(snapshot);
  return {
    ok: true,
    storedAt: result.docPath,
    historyEntry: result.historyDocPath,
    periods: Object.keys(snapshot.periods),
    defaultPeriod: snapshot.defaultPeriod,
    limit: DEFAULT_LIMIT,
    source: snapshot.source
  };
}

export const refreshLeaderboard = onRequest(async (req, res) => {
  try {
    const force = req.query?.refresh;
    if (force && typeof force === 'string' && force.toLowerCase() === 'cache') {
      console.log('Forcing leaderboard refresh (cache bypass)');
    }
    const result = await handleLeaderboardRefresh();
    res.json(result);
  } catch (error) {
    console.error('Failed to refresh leaderboard', error);
    res.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error) });
  }
});

const SCHEDULE = process.env.LEADERBOARD_REFRESH_SCHEDULE || 'every 30 minutes';

export const scheduledRefreshLeaderboard = onSchedule(SCHEDULE, async () => {
  try {
    const result = await handleLeaderboardRefresh();
    console.log(
      `Leaderboard snapshot updated (${result.periods.join(', ')}) -> ${result.storedAt} (history: ${result.historyEntry})`
    );
  } catch (error) {
    console.error('Scheduled leaderboard refresh failed', error);
    throw error;
  }
});
