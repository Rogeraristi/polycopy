import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import session from 'express-session';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import fetch from 'node-fetch';
import { WebSocketServer } from 'ws';
import http from 'http';
import { initialiseFirebase, getFirestore, getFirebaseStatus, firebaseFieldValue } from './firebase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ENV_PATH_CANDIDATES = [
  path.resolve(__dirname, '../../.env'),
  path.resolve(__dirname, '../.env'),
  path.resolve(process.cwd(), '.env')
];

ENV_PATH_CANDIDATES.forEach((envPath) => {
  dotenv.config({ path: envPath, override: false });
});

const PORT = process.env.PORT || 4000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PRODUCTION = NODE_ENV === 'production';
const POLYMARKET_BASE = process.env.POLYMARKET_BASE || 'https://gamma-api.polymarket.com';
const NORMALISED_POLYMARKET_BASE = POLYMARKET_BASE.replace(/\/$/, '');
const CUSTOM_POLYMARKET_SEARCH_API_URL =
  process.env.POLYMARKET_SEARCH_API_URL || process.env.POLYMARKET_TRADER_SEARCH_URL || null;
const POLYMARKET_SEARCH_API_URL =
  CUSTOM_POLYMARKET_SEARCH_API_URL || `${NORMALISED_POLYMARKET_BASE}/public-search`;
const POLYMARKET_SEARCH_IS_CUSTOM = Boolean(CUSTOM_POLYMARKET_SEARCH_API_URL);
const POLYMARKET_DATA_API_BASE =
  (process.env.POLYMARKET_DATA_API_BASE || process.env.POLYMARKET_DATA_API_URL || 'https://data-api.polymarket.com').replace(
    /\/$/,
    ''
  );
const POLYMARKET_SEARCH_API_BEARER =
  process.env.POLYMARKET_SEARCH_API_BEARER || process.env.POLYMARKET_TRADER_SEARCH_BEARER || null;
const POLYMARKET_SEARCH_CF_ACCESS_ID =
  process.env.POLYMARKET_SEARCH_CF_ACCESS_ID || process.env.POLYMARKET_TRADER_SEARCH_CF_ACCESS_ID || null;
const POLYMARKET_SEARCH_CF_ACCESS_SECRET =
  process.env.POLYMARKET_SEARCH_CF_ACCESS_SECRET || process.env.POLYMARKET_TRADER_SEARCH_CF_ACCESS_SECRET || null;
const POLYMARKET_SEARCH_API_USER_AGENT =
  process.env.POLYMARKET_SEARCH_API_USER_AGENT || process.env.POLYMARKET_TRADER_SEARCH_USER_AGENT || null;
const POLYMARKET_SEARCH_API_KEY = process.env.POLYMARKET_SEARCH_API_KEY || process.env.POLYMARKET_TRADER_SEARCH_API_KEY || null;
const POLYMARKET_DATA_API_USER_AGENT =
  process.env.POLYMARKET_DATA_API_USER_AGENT ||
  process.env.POLYMARKET_DATA_API_UA ||
  POLYMARKET_SEARCH_API_USER_AGENT ||
  'polycopy/1.0 (+https://polymarket.com)';
const FEATURE_REAL_COPY_EXECUTION = ['1', 'true', 'yes', 'on'].includes(
  String(process.env.FEATURE_REAL_COPY_EXECUTION || '').toLowerCase()
);
const COPY_EXECUTION_MODE = (process.env.COPY_EXECUTION_MODE || 'webhook').toLowerCase();
const COPY_EXECUTOR_WEBHOOK_URL = process.env.COPY_EXECUTOR_WEBHOOK_URL || '';
const COPY_EXECUTOR_WEBHOOK_AUTH_TOKEN = process.env.COPY_EXECUTOR_WEBHOOK_AUTH_TOKEN || '';
const NEWS_API_KEY = process.env.NEWS_API_KEY || '';
const NEWS_API_URL = process.env.NEWS_API_URL || 'https://newsapi.org/v2/top-headlines';

const FALLBACK_CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || process.env.CLIENT_URL || 'http://localhost:5173';
const ADDITIONAL_CLIENT_ORIGINS =
  process.env.CLIENT_ORIGINS || process.env.ALLOWED_ORIGINS || process.env.CLIENT_ORIGIN_LIST || '';
const CLIENT_ORIGINS = Array.from(
  new Set(
    [FALLBACK_CLIENT_ORIGIN]
      .concat(
        ADDITIONAL_CLIENT_ORIGINS.split(',')
          .map((origin) => origin.trim())
          .filter(Boolean)
      )
      .filter(Boolean)
  )
);
const PRIMARY_CLIENT_ORIGIN = CLIENT_ORIGINS[0] || 'http://localhost:5173';

const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-session-secret-change-me';
const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME || 'polycopy.sid';
const SESSION_MAX_AGE_MS = Number.isFinite(Number(process.env.SESSION_MAX_AGE))
  ? Number(process.env.SESSION_MAX_AGE)
  : 1000 * 60 * 60 * 24 * 7; // 7 days

const SERVER_BASE_URL =
  process.env.SERVER_BASE_URL ||
  process.env.PUBLIC_SERVER_URL ||
  process.env.BACKEND_BASE_URL ||
  `http://localhost:${PORT}`;
const NORMALISED_SERVER_BASE_URL = SERVER_BASE_URL.replace(/\/$/, '');

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const GOOGLE_AUTH_ENABLED = Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);
const GOOGLE_CALLBACK_URL =
  process.env.GOOGLE_CALLBACK_URL || `${NORMALISED_SERVER_BASE_URL}/api/auth/google/callback`;

const AUTH_SUCCESS_REDIRECT =
  process.env.AUTH_SUCCESS_REDIRECT ||
  process.env.CLIENT_SUCCESS_REDIRECT ||
  `${PRIMARY_CLIENT_ORIGIN.replace(/\/$/, '')}/`;
const AUTH_FAILURE_REDIRECT =
  process.env.AUTH_FAILURE_REDIRECT || `${PRIMARY_CLIENT_ORIGIN.replace(/\/$/, '')}/?authError=oauth_failed`;
const FIREBASE_USER_COLLECTION =
  process.env.FIREBASE_USER_COLLECTION || process.env.FIREBASE_SETTINGS_COLLECTION || 'users';

const LEADERBOARD_PERIODS = {
  today: { path: '/leaderboard/overall/today/profit', label: 'Today' },
  weekly: { path: '/leaderboard/overall/weekly/profit', label: 'This Week' },
  monthly: { path: '/leaderboard/overall/monthly/profit', label: 'This Month' },
  all: { path: '/leaderboard/overall/all/profit', label: 'All Time' }
};
const LEADERBOARD_DEFAULT_PERIOD = 'weekly';
const LEADERBOARD_LIMIT = Number.isFinite(Number(process.env.LEADERBOARD_LIMIT))
  ? Math.max(1, Math.min(Number(process.env.LEADERBOARD_LIMIT), 50))
  : 12;
const LEADERBOARD_CACHE_TTL_MS = Number.isFinite(Number(process.env.LEADERBOARD_CACHE_TTL_MS))
  ? Math.max(5_000, Number(process.env.LEADERBOARD_CACHE_TTL_MS))
  : 1000 * 60 * 5; // 5 minutes

const LEADERBOARD_FIRESTORE_TTL_MS = Number.isFinite(Number(process.env.LEADERBOARD_FIRESTORE_TTL_MS))
  ? Math.max(5_000, Number(process.env.LEADERBOARD_FIRESTORE_TTL_MS))
  : 1000 * 60 * 10; // 10 minutes

const leaderboardCache = {
  expiresAt: 0,
  snapshot: null
};

const breakingNewsCache = {
  expiresAt: 0,
  payload: null
};

const FIRESTORE_LEADERBOARD_COLLECTION =
  process.env.FIREBASE_LEADERBOARD_COLLECTION || process.env.LEADERBOARD_COLLECTION || 'leaderboardSnapshots';
const FIRESTORE_LEADERBOARD_DOCUMENT = process.env.FIREBASE_LEADERBOARD_DOCUMENT || 'latest';
const FIRESTORE_LEADERBOARD_HISTORY_COLLECTION =
  process.env.FIREBASE_LEADERBOARD_HISTORY_COLLECTION || 'leaderboardSnapshotsHistory';

const app = express();

const { configured: firebaseConfigured } = initialiseFirebase();

const firestore = getFirestore();

if (IS_PRODUCTION) {
  app.set('trust proxy', 1);
}

const ALLOWED_ORIGINS = new Set(
  CLIENT_ORIGINS.map((origin) => origin.replace(/\/$/, ''))
);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }
      const normalisedOrigin = origin.replace(/\/$/, '');
      callback(null, ALLOWED_ORIGINS.has(normalisedOrigin));
    },
    credentials: true
  })
);

app.use(
  session({
    name: SESSION_COOKIE_NAME,
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      maxAge: SESSION_MAX_AGE_MS,
      sameSite: IS_PRODUCTION ? 'none' : 'lax',
      secure: IS_PRODUCTION
    }
  })
);

app.use(passport.initialize());
app.use(passport.session());
app.use(express.json());

const GOOGLE_SCOPES = (process.env.GOOGLE_AUTH_SCOPES || 'profile,email')
  .split(',')
  .map((scope) => scope.trim())
  .filter(Boolean);

if (GOOGLE_SCOPES.length === 0) {
  GOOGLE_SCOPES.push('profile', 'email');
}

const GOOGLE_PROMPT = process.env.GOOGLE_AUTH_PROMPT || 'select_account';

function buildSessionUser(profile) {
  if (!profile || typeof profile !== 'object') {
    return null;
  }

  const primaryEmail = Array.isArray(profile.emails)
    ? profile.emails.map((entry) => entry && entry.value).find(Boolean)
    : null;
  const primaryPhoto = Array.isArray(profile.photos)
    ? profile.photos.map((entry) => entry && entry.value).find(Boolean)
    : null;

  return {
    id: profile.id,
    name:
      profile.displayName ||
      (profile.name && [profile.name.givenName, profile.name.familyName].filter(Boolean).join(' ')) ||
      primaryEmail ||
      'Google User',
    email: primaryEmail || null,
    avatar: primaryPhoto || null,
    provider: 'google'
  };
}

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  done(null, user);
});

if (GOOGLE_AUTH_ENABLED) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        callbackURL: GOOGLE_CALLBACK_URL,
        passReqToCallback: false
      },
      (_accessToken, _refreshToken, profile, done) => {
        try {
          const sessionUser = buildSessionUser(profile);
          if (!sessionUser) {
            done(new Error('Failed to derive Google profile'));
            return;
          }
          done(null, sessionUser);
        } catch (error) {
          done(error);
        }
      }
    )
  );
} else {
  console.warn('Google OAuth is disabled. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to enable it.');
}

function ensureGoogleConfigured(req, res, next) {
  if (!GOOGLE_AUTH_ENABLED) {
    res
      .status(503)
      .json({ error: 'Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to enable it.' });
    return;
  }
  next();
}

function resolveSessionRedirect(req) {
  let redirectPath = req.session?.oauthRedirect;
  // Safety: clear any legacy or malformed redirect
  if (redirectPath && typeof redirectPath === 'string') {
    if (redirectPath.startsWith('/') && !redirectPath.startsWith('//')) {
      delete req.session.oauthRedirect;
      return `${PRIMARY_CLIENT_ORIGIN.replace(/\/$/, '')}${redirectPath}`;
    } else {
      // Remove any invalid or legacy value
      delete req.session.oauthRedirect;
    }
  }
  return AUTH_SUCCESS_REDIRECT;
}

function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE_NAME, {
    path: '/',
    sameSite: IS_PRODUCTION ? 'none' : 'lax',
    secure: IS_PRODUCTION
  });
}

function normaliseTimestamp(value) {
  if (!value) return null;
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number') {
    return new Date(value).toISOString();
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (value?.toDate && typeof value.toDate === 'function') {
    return value.toDate().toISOString();
  }
  return null;
}

async function upsertUserProfile(user) {
  if (!user || typeof user !== 'object' || !user.id) {
    return;
  }
  const firestore = getFirestore();
  if (!firestore) {
    return;
  }

  try {
    const docRef = firestore.collection(FIREBASE_USER_COLLECTION).doc(user.id);
    const snapshot = await docRef.get();
    const payload = {
      profile: {
        id: user.id,
        name: user.name || null,
        email: user.email || null,
        avatar: user.avatar || null,
        provider: user.provider || 'google'
      },
      lastLoginAt: firebaseFieldValue.serverTimestamp(),
      updatedAt: firebaseFieldValue.serverTimestamp(),
      loginCount: firebaseFieldValue.increment(1)
    };

    if (!snapshot.exists) {
      payload.createdAt = firebaseFieldValue.serverTimestamp();
    }

    await docRef.set(payload, { merge: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Failed to upsert user profile', message);
  }
}

function ensureAuthenticated(req, res, next) {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  next();
}

function ensureFirebaseReady(req, res, next) {
  const firestore = getFirestore();
  if (!firestore) {
    res.status(503).json({
      error: 'Firebase is not configured. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY.'
    });
    return;
  }
  req.firestore = firestore;
  next();
}

app.get('/api/session', (req, res) => {
  const user = req.user || null;
  res.json({
    authenticated: Boolean(user),
    user
  });
});

app.post('/api/logout', (req, res, next) => {
  const finish = () => {
    clearSessionCookie(res);
    res.json({ success: true });
  };

  if (typeof req.logout === 'function') {
    req.logout((logoutError) => {
      if (logoutError) {
        next(logoutError);
        return;
      }
      if (req.session) {
        req.session.destroy(() => {
          finish();
        });
      } else {
        finish();
      }
    });
  } else if (req.session) {
    req.session.destroy(() => {
      finish();
    });
  } else {
    finish();
  }
});

app.get('/api/auth/google', ensureGoogleConfigured, (req, res, next) => {
  const { redirect } = req.query || {};
  if (typeof redirect === 'string' && redirect.startsWith('/') && !redirect.startsWith('//')) {
    req.session.oauthRedirect = redirect;
  }

  passport.authenticate('google', {
    scope: GOOGLE_SCOPES,
    prompt: GOOGLE_PROMPT,
    session: true,
    state: true
  })(req, res, next);
});

app.get(
  '/api/auth/google/callback',
  ensureGoogleConfigured,
  passport.authenticate('google', {
    failureRedirect: AUTH_FAILURE_REDIRECT,
    session: true
  }),
  async (req, res) => {
    await upsertUserProfile(req.user);
    const redirectTarget = resolveSessionRedirect(req);
    res.redirect(redirectTarget);
  }
);

app.get('/api/firebase/status', (_req, res) => {
  res.json(getFirebaseStatus());
});

app.get('/api/user/settings', ensureAuthenticated, ensureFirebaseReady, async (req, res) => {
  try {
    const collection = req.firestore.collection(FIREBASE_USER_COLLECTION);
    const docRef = collection.doc(req.user.id);
    const snapshot = await docRef.get();
    if (!snapshot.exists) {
      res.json({ settings: null, updatedAt: null });
      return;
    }
    const data = snapshot.data() || {};
    res.json({
      settings: data.settings || null,
      updatedAt: normaliseTimestamp(data.updatedAt)
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Failed to read user settings', message);
    res.status(500).json({ error: 'Failed to fetch user settings' });
  }
});

app.post('/api/user/settings', ensureAuthenticated, ensureFirebaseReady, async (req, res) => {
  const { settings } = req.body || {};
  if (!settings || typeof settings !== 'object') {
    res.status(400).json({ error: 'settings object is required' });
    return;
  }

  try {
    const collection = req.firestore.collection(FIREBASE_USER_COLLECTION);
    const docRef = collection.doc(req.user.id);
    const payload = {
      settings,
      updatedAt: new Date().toISOString(),
      user: {
        id: req.user.id,
        name: req.user.name,
        email: req.user.email,
        provider: req.user.provider
      }
    };
    await docRef.set(payload, { merge: true });
    res.json({ settings: payload.settings, updatedAt: payload.updatedAt });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Failed to persist user settings', message);
    res.status(500).json({ error: 'Failed to save user settings' });
  }
});

function normaliseTradesPayload(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.data)) return payload.data;
  return [];
}

function extractTradeTimestamp(trade) {
  const raw = trade?.created_at || trade?.createdAt || trade?.timestamp || null;
  if (raw === null) return null;
  const millis = new Date(raw).getTime();
  return Number.isFinite(millis) ? millis : null;
}

function extractTradeSize(trade) {
  const numeric = toFiniteNumber(trade?.amount ?? trade?.size ?? trade?.shares ?? trade?.quantity);
  return numeric ?? 0;
}

function extractTradePrice(trade) {
  const numeric = toFiniteNumber(trade?.price ?? trade?.avgPrice ?? trade?.average_price);
  return numeric ?? null;
}

function extractTradeSide(trade) {
  const raw = trade?.side || trade?.type || '';
  return typeof raw === 'string' ? raw.toLowerCase() : '';
}

function extractTradeMarketKey(trade) {
  const market =
    trade?.market_id ||
    trade?.marketId ||
    trade?.conditionId ||
    trade?.token_id ||
    trade?.asset_id ||
    trade?.market?.id ||
    trade?.market?.slug ||
    trade?.market?.question ||
    trade?.market;

  if (typeof market !== 'string' || !market.trim()) {
    return 'unknown';
  }
  return market.trim().toLowerCase();
}

function computePortfolioSnapshotFromTrades(trades) {
  const positions = new Map();

  for (const trade of trades) {
    const side = extractTradeSide(trade);
    const size = extractTradeSize(trade);
    const price = extractTradePrice(trade);
    const marketKey = extractTradeMarketKey(trade);

    if (!positions.has(marketKey)) {
      positions.set(marketKey, {
        market: marketKey,
        netShares: 0,
        netCost: 0,
        tradeCount: 0,
        buys: 0,
        sells: 0
      });
    }

    const entry = positions.get(marketKey);
    const signedSize = side === 'sell' ? -size : size;
    const signedCost = price === null ? 0 : signedSize * price;

    entry.netShares += signedSize;
    entry.netCost += signedCost;
    entry.tradeCount += 1;
    if (side === 'buy') entry.buys += 1;
    if (side === 'sell') entry.sells += 1;
  }

  const markets = Array.from(positions.values());
  const openPositions = markets
    .filter((entry) => Math.abs(entry.netShares) > 0.000001)
    .map((entry) => ({
      market: entry.market,
      side: entry.netShares >= 0 ? 'long' : 'short',
      shares: Number(entry.netShares.toFixed(6)),
      avgEntryPrice:
        Math.abs(entry.netShares) > 0.000001
          ? Number((entry.netCost / entry.netShares).toFixed(6))
          : null
    }));

  const notionalVolume = trades.reduce((acc, trade) => {
    const size = extractTradeSize(trade);
    const price = extractTradePrice(trade);
    if (price === null) return acc;
    return acc + Math.abs(size * price);
  }, 0);

  return {
    openPositions,
    marketCount: positions.size,
    notionalVolume: Number(notionalVolume.toFixed(4))
  };
}

function computePnlFromTrades(trades) {
  const realisedFromPayload = trades.reduce((acc, trade) => {
    const explicit =
      toFiniteNumber(trade?.realizedPnl) ??
      toFiniteNumber(trade?.realizedPnL) ??
      toFiniteNumber(trade?.pnl) ??
      null;
    return explicit === null ? acc : acc + explicit;
  }, 0);

  const hasExplicitRealised = trades.some((trade) => {
    return (
      toFiniteNumber(trade?.realizedPnl) !== null ||
      toFiniteNumber(trade?.realizedPnL) !== null ||
      toFiniteNumber(trade?.pnl) !== null
    );
  });

  const fallbackExposure = trades.reduce((acc, trade) => {
    const side = extractTradeSide(trade);
    const size = extractTradeSize(trade);
    const price = extractTradePrice(trade);
    if (price === null) return acc;
    return acc + (side === 'sell' ? 1 : -1) * size * price;
  }, 0);

  const pnl = hasExplicitRealised ? realisedFromPayload : Number(fallbackExposure.toFixed(4));
  return {
    pnl,
    calculation: hasExplicitRealised ? 'sum_of_trade_realized_pnl_fields' : 'fallback_net_cashflow_proxy',
    tradeCount: trades.length
  };
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
  const buildUrl = (params) => `${POLYMARKET_BASE}/markets?${new URLSearchParams(params).toString()}`;
  const urls = [
    buildUrl({ limit: '150', closed: 'false', active: 'true', archived: 'false' }),
    buildUrl({ limit: '150', closed: 'false', active: 'true', archived: 'false', order: 'volume24hr', ascending: 'false' })
  ];
  try {
    const payloads = await Promise.all(
      urls.map(async (url) => {
        try {
          return await fetchJson(url);
        } catch (error) {
          console.error('Failed to fetch markets from source', url, error.message);
          return [];
        }
      })
    );
    const data = payloads
      .flatMap((payload) => (Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : []))
      .filter(Boolean);

    const parseStringOrArray = (value) => {
      if (Array.isArray(value)) return value;
      if (typeof value === 'string') {
        try {
          const parsed = JSON.parse(value);
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return value
            .split(',')
            .map((entry) => entry.trim().replace(/^"|"$/g, ''))
            .filter(Boolean);
        }
      }
      return [];
    };

    const extractChance = (market) => {
      const directCandidates = [
        market?.probability,
        market?.chance,
        market?.lastTradePrice,
        market?.last_price,
        market?.price
      ];

      for (const candidate of directCandidates) {
        const numeric = toFiniteNumber(candidate);
        if (numeric === null) continue;
        const normalized = numeric > 1 ? numeric : numeric * 100;
        if (normalized >= 0 && normalized <= 100) {
          return Number(normalized.toFixed(2));
        }
      }

      const priceBuckets = [market?.outcomePrices, market?.prices];
      for (const bucket of priceBuckets) {
        const values =
          typeof bucket === 'string'
            ? bucket
                .split(',')
                .map((value) => Number(value.trim()))
                .filter((value) => Number.isFinite(value))
            : Array.isArray(bucket)
            ? bucket.map((value) => Number(value)).filter((value) => Number.isFinite(value))
            : [];

        if (!values.length) continue;
        const first = values[0];
        const normalized = first > 1 ? first : first * 100;
        if (normalized >= 0 && normalized <= 100) {
          return Number(normalized.toFixed(2));
        }
      }

      return null;
    };

    const mapped = data.map((market) => {
      const outcomes = parseStringOrArray(market.outcomes || market.outcomeTokens || []);
      const outcomePrices = parseStringOrArray(market.outcomePrices || market.prices || []).map((value) => Number(value));

      const event = Array.isArray(market.events) && market.events.length > 0 ? market.events[0] : null;
      const eventSlug = event?.slug || null;
      const eventTitle = event?.title || null;

      let primaryOutcome = null;
      let primaryOutcomeChance = null;
      if (outcomes.length > 0 && outcomePrices.length > 0) {
        let topIndex = 0;
        let topValue = -Infinity;
        outcomePrices.forEach((price, index) => {
          const value = Number(price);
          if (Number.isFinite(value) && value > topValue) {
            topValue = value;
            topIndex = index;
          }
        });
        if (topValue >= 0) {
          primaryOutcome = String(outcomes[topIndex] ?? outcomes[0] ?? '').trim() || null;
          const normalized = topValue > 1 ? topValue : topValue * 100;
          if (normalized >= 0 && normalized <= 100) {
            primaryOutcomeChance = Number(normalized.toFixed(2));
          }
        }
      }

      const slug = market.slug || market.id || null;
      const canonicalUrl = eventSlug
        ? `https://polymarket.com/event/${eventSlug}`
        : slug
        ? `https://polymarket.com/event/${slug}`
        : `https://polymarket.com/market/${market.id}`;

      return {
        id: market.id || slug,
        slug,
        question: market.question || market.title,
        outcomes,
        chance: extractChance(market),
        primaryOutcome,
        primaryOutcomeChance,
        volume24h: Number(market.volume24h || market.volume_24h || 0),
        eventVolume24h: Number(event?.volume24hr || event?.volume24h || 0),
        liquidity: Number(market.liquidity || 0),
        eventTitle,
        eventSlug,
        image: pickFirstAbsoluteUrl(market.image, market.icon),
        eventImage: pickFirstAbsoluteUrl(event?.image, event?.icon),
        updatedAt: market.updatedAt || event?.updatedAt || null,
        url: canonicalUrl
      };
    });

    // Deduplicate noisy duplicates from multiple source requests.
    const deduped = new Map();
    for (const market of mapped) {
      const key = String(market.id || market.slug || market.question || '').toLowerCase();
      if (!key) continue;
      const existing = deduped.get(key);
      if (!existing || Number(market.volume24h || 0) > Number(existing.volume24h || 0)) {
        deduped.set(key, market);
      }
    }

    return Array.from(deduped.values()).sort((a, b) => Number(b.volume24h || 0) - Number(a.volume24h || 0)).slice(0, 120);
  } catch (error) {
    console.error('Failed to fetch markets', error.message);
    return [];
  }
}

function decodeHtmlEntities(value) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function pickFirstAbsoluteUrl(...candidates) {
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue;
    const value = candidate.trim();
    if (/^https?:\/\//i.test(value)) {
      return value;
    }
  }
  return null;
}

function resolveMarketLogo(market, fallbackUrl = null, fallbackSource = 'fallback') {
  const eventImage = pickFirstAbsoluteUrl(market?.eventImage);
  if (eventImage) {
    return { url: eventImage, source: 'eventImage' };
  }

  const marketImage = pickFirstAbsoluteUrl(market?.image);
  if (marketImage) {
    return { url: marketImage, source: 'marketImage' };
  }

  const fallback = pickFirstAbsoluteUrl(fallbackUrl);
  if (fallback) {
    return { url: fallback, source: fallbackSource };
  }

  return { url: null, source: null };
}

function stripTags(value) {
  return String(value || '').replace(/<[^>]*>/g, '').trim();
}

function tokenizeText(value) {
  const stopWords = new Set([
    'the',
    'and',
    'for',
    'with',
    'that',
    'this',
    'will',
    'from',
    'into',
    'over',
    'under',
    'about',
    'after',
    'before',
    'what',
    'when',
    'where',
    'which',
    'whose',
    'while',
    'their',
    'there',
    'they',
    'them',
    'have',
    'has',
    'had',
    'was',
    'were',
    'are',
    'is',
    'you',
    'your',
    'more',
    'less',
    'than',
    'new',
    'top',
    'news',
    'live'
  ]);

  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2 && !stopWords.has(token));
}

function scoreTextOverlap(a, b) {
  const tokensA = tokenizeText(a);
  const tokensB = new Set(tokenizeText(b));
  if (!tokensA.length || !tokensB.size) return 0;
  let hits = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) hits += 1;
  }
  return hits;
}

async function fetchTopHeadlines(limit = 25) {
  const safeLimit = Math.max(5, Math.min(50, Number(limit) || 25));

  // Prefer NewsAPI if key exists.
  if (NEWS_API_KEY) {
    const params = new URLSearchParams({
      country: 'us',
      pageSize: String(safeLimit),
      apiKey: NEWS_API_KEY
    });
    const url = `${NEWS_API_URL}?${params.toString()}`;
    try {
      const payload = await fetchJson(url);
      const articles = Array.isArray(payload?.articles) ? payload.articles : [];
      return articles
        .map((article) => ({
          title: String(article?.title || '').trim(),
          url: typeof article?.url === 'string' ? article.url : null,
          source: article?.source?.name || null,
          publishedAt: article?.publishedAt || null
        }))
        .filter((article) => article.title && article.url)
        .slice(0, safeLimit);
    } catch (error) {
      console.error('Failed to fetch top headlines from NewsAPI', error.message);
    }
  }

  // Fallback: Google News RSS (no API key required).
  try {
    const response = await fetch('https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en', {
      headers: {
        'User-Agent': POLYMARKET_DATA_API_USER_AGENT
      }
    });
    if (!response.ok) {
      throw new Error(`RSS fetch failed (${response.status})`);
    }
    const xml = await response.text();
    const itemMatches = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
    const headlines = itemMatches
      .map((item) => {
        const titleMatch = item.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>|<title>([\s\S]*?)<\/title>/i);
        const linkMatch = item.match(/<link>([\s\S]*?)<\/link>/i);
        const pubDateMatch = item.match(/<pubDate>([\s\S]*?)<\/pubDate>/i);
        const sourceMatch = item.match(/<source[^>]*>([\s\S]*?)<\/source>/i);
        const title = decodeHtmlEntities(stripTags(titleMatch?.[1] || titleMatch?.[2] || ''));
        const url = decodeHtmlEntities((linkMatch?.[1] || '').trim());
        return {
          title,
          url: url || null,
          source: decodeHtmlEntities(stripTags(sourceMatch?.[1] || '')) || 'Google News',
          publishedAt: pubDateMatch?.[1] || null
        };
      })
      .filter((headline) => headline.title && headline.url)
      .slice(0, safeLimit);
    return headlines;
  } catch (error) {
    console.error('Failed to fetch top headlines from RSS', error.message);
    return [];
  }
}

function buildBreakingNewsStories(markets, limit = 16) {
  const groupedByEvent = new Map();

  for (const market of Array.isArray(markets) ? markets : []) {
    const eventKey = String(market?.eventSlug || market?.eventTitle || market?.slug || market?.id || '').trim().toLowerCase();
    if (!eventKey) continue;

    const chance =
      toFiniteNumber(market?.primaryOutcomeChance) ??
      toFiniteNumber(market?.chance) ??
      null;
    if (chance === null || chance < 0 || chance > 100) continue;

    const volume24h = toFiniteNumber(market?.volume24h) ?? 0;
    const eventVolume24h = toFiniteNumber(market?.eventVolume24h) ?? 0;
    const score = Math.max(volume24h, eventVolume24h);

    const existing = groupedByEvent.get(eventKey);
    const logo = resolveMarketLogo(market);
    if (!existing) {
      groupedByEvent.set(eventKey, {
        eventKey,
        title: String(market?.eventTitle || market?.question || 'Polymarket'),
        eventSlug: market?.eventSlug || market?.slug || null,
        url:
          (typeof market?.url === 'string' && market.url) ||
          (market?.eventSlug ? `https://polymarket.com/event/${market.eventSlug}` : null) ||
          (market?.slug ? `https://polymarket.com/event/${market.slug}` : null) ||
          `https://polymarket.com/market/${market?.id}`,
        chance: Number(chance.toFixed(2)),
        outcomeLabel: market?.primaryOutcome || null,
        marketQuestion: market?.question || null,
        volume24h: score,
        logoUrl: logo.url,
        logoSource: logo.source,
        updatedAt: market?.updatedAt || null
      });
      continue;
    }

    // Keep the highest-volume market representation for each event.
    if (score > existing.volume24h) {
      const nextLogo = resolveMarketLogo(market, existing.logoUrl, existing.logoSource || 'fallback');
      groupedByEvent.set(eventKey, {
        ...existing,
        chance: Number(chance.toFixed(2)),
        outcomeLabel: market?.primaryOutcome || existing.outcomeLabel,
        marketQuestion: market?.question || existing.marketQuestion,
        volume24h: score,
        logoUrl: nextLogo.url,
        logoSource: nextLogo.source,
        updatedAt: market?.updatedAt || existing.updatedAt,
        url:
          (typeof market?.url === 'string' && market.url) ||
          existing.url
      });
    }
  }

  return Array.from(groupedByEvent.values())
    .sort((a, b) => b.volume24h - a.volume24h)
    .slice(0, Math.max(1, limit))
    .map((story) => ({
      title: story.title,
      question: story.marketQuestion || story.title,
      url: story.url,
      chance: story.chance,
      outcomeLabel: story.outcomeLabel,
      volume24h: story.volume24h,
      logoUrl: pickFirstAbsoluteUrl(story.logoUrl),
      logoSource: story.logoSource || null,
      updatedAt: story.updatedAt
    }));
}

function buildHeadlineMappedStories(markets, headlines, limit = 10) {
  const mapped = [];
  const usedEventKeys = new Set();

  for (const headline of headlines) {
    let bestMarket = null;
    let bestScore = 0;

    for (const market of markets) {
      const marketText = `${market?.eventTitle || ''} ${market?.question || ''}`;
      const score = scoreTextOverlap(headline.title, marketText);
      if (score > bestScore) {
        bestScore = score;
        bestMarket = market;
      }
    }

    if (!bestMarket || bestScore < 2) {
      continue;
    }

    const eventKey = String(bestMarket?.eventSlug || bestMarket?.eventTitle || bestMarket?.slug || bestMarket?.id || '').toLowerCase();
    if (eventKey && usedEventKeys.has(eventKey)) {
      continue;
    }
    if (eventKey) usedEventKeys.add(eventKey);

    const chance =
      toFiniteNumber(bestMarket?.primaryOutcomeChance) ??
      toFiniteNumber(bestMarket?.chance) ??
      null;
    if (chance === null) continue;
    const logo = resolveMarketLogo(bestMarket);

    mapped.push({
      title: headline.title,
      question: bestMarket?.question || headline.title,
      url:
        (typeof bestMarket?.url === 'string' && bestMarket.url) ||
        (bestMarket?.eventSlug ? `https://polymarket.com/event/${bestMarket.eventSlug}` : null) ||
        (bestMarket?.slug ? `https://polymarket.com/event/${bestMarket.slug}` : null) ||
        `https://polymarket.com/market/${bestMarket?.id}`,
      chance: Number(chance.toFixed(2)),
      outcomeLabel: bestMarket?.primaryOutcome || null,
      volume24h: Number(bestMarket?.volume24h || 0),
      logoUrl: logo.url,
      logoSource: logo.source,
      updatedAt: bestMarket?.updatedAt || headline.publishedAt || null,
      source: headline.source || 'News'
    });

    if (mapped.length >= limit) {
      break;
    }
  }

  return mapped;
}

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
      // Map Apify fields to expected fields
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
        toFiniteNumber(entry?.vol) ?? // Apify uses 'vol'
        toFiniteNumber(entry?.totalVolume) ??
        toFiniteNumber(entry?.total_volume) ??
        toFiniteNumber(entry?.notional);
      const roi =
        toFiniteNumber(entry?.roi) ??
        toFiniteNumber(entry?.return) ??
        toFiniteNumber(entry?.percentage_return) ??
        toFiniteNumber(entry?.return_percentage);
      const computedRoi =
        pnl !== null && volume !== null && volume !== 0 ? Number(((pnl / volume) * 100).toFixed(2)) : null;
      const trades =
        toFiniteNumber(entry?.trades) ??
        toFiniteNumber(entry?.tradeCount) ??
        toFiniteNumber(entry?.trade_count) ??
        toFiniteNumber(entry?.fills) ??
        null; // Apify does not provide trades, so default to null

      const displayName =
        entry?.displayName ||
        entry?.userName || // Apify uses 'userName'
        entry?.name ||
        entry?.username ||
        entry?.handle ||
        (address.length > 10 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address);

      return {
        address: address.toLowerCase(),
        displayName,
        rank,
        roi: roi ?? computedRoi,
        pnl,
        volume,
        trades
      };
    })
    .filter(Boolean)
    .slice(0, fallbackLimit);
}

async function fetchLeaderboardFromSite(limit = LEADERBOARD_LIMIT) {
  return fetchLeaderboardFromPath('/leaderboard', limit);
}

async function fetchFallbackLeaderboard(limit = LEADERBOARD_LIMIT) {
  const scraped = await fetchLeaderboardFromSite(limit);
  if (scraped.length > 0) {
    return scraped.filter(Boolean);
  }

  const candidatePaths = [
    `/leaderboard?limit=${limit}&period=7d`,
    `/leaderboard/traders?limit=${limit}&period=7d`,
    `/trades/leaderboard?limit=${limit}`,
    `/leaderboard/accounts?limit=${limit}`
  ];

  for (const path of candidatePaths) {
    const url = `${POLYMARKET_BASE}${path}`;
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
      console.error(`Failed to fetch leaderboard from ${url}`, message);
    }
  }

  return [];
}


async function fetchLeaderboardSnapshots(limit = LEADERBOARD_LIMIT) {
  const APIFY_LEADERBOARD_URL =
    process.env.APIFY_LEADERBOARD_URL ||
    'https://api.apify.com/v2/datasets/8QwKQwKQwKQwKQwKQ/items?format=json&clean=true';

  const periods = {};
  const labels = {};
  let source = 'polymarket';
  const fetchedAt = Date.now();

  const normaliseAndRank = (entries) => {
    const safe = Array.isArray(entries) ? entries.filter(Boolean) : [];
    return safe.slice(0, limit).map((entry, index) => ({
      ...entry,
      rank: index + 1
    }));
  };

  // 1) Primary source: try fetching each period path independently.
  await Promise.all(
    Object.entries(LEADERBOARD_PERIODS).map(async ([periodKey, config]) => {
      try {
        const entries = await fetchLeaderboardFromPath(config.path, limit);
        if (entries.length > 0) {
          periods[periodKey] = normaliseAndRank(entries);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Failed to fetch leaderboard period ${periodKey}`, message);
      }
    })
  );

  // 2) Secondary source: fallback scraper snapshot (usually weekly-like).
  if (Object.keys(periods).length === 0) {
    try {
      const fallbackEntries = await fetchFallbackLeaderboard(limit);
      if (fallbackEntries.length > 0) {
        source = 'fallback';
        periods.weekly = normaliseAndRank(fallbackEntries);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('Failed to fetch fallback leaderboard snapshot', message);
    }
  }

  // 3) Tertiary source: Apify flat snapshot, used only when site paths fail.
  if (Object.keys(periods).length === 0) {
    try {
      const response = await fetch(APIFY_LEADERBOARD_URL);
      if (!response.ok) {
        throw new Error(`Apify leaderboard fetch failed: ${response.status}`);
      }
      const apifyData = await response.json();
      const entries = normaliseLeaderboardEntries(apifyData, limit);
      if (entries.length > 0) {
        source = 'apify';
        periods.weekly = normaliseAndRank(entries);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('Failed to fetch leaderboard from Apify', message);
    }
  }

  // 4) Ensure all tabs exist while keeping distinct data where available.
  const orderedKeys = Object.keys(LEADERBOARD_PERIODS);
  for (const key of orderedKeys) {
    labels[key] = LEADERBOARD_PERIODS[key].label;
    if (!periods[key]) {
      // Prefer the closest known bucket to avoid blank tabs.
      periods[key] =
        periods.weekly ||
        periods.monthly ||
        periods.all ||
        periods.today ||
        [];
    }
  }

  const availableKeys = orderedKeys.filter((key) => Array.isArray(periods[key]) && periods[key].length > 0);
  const defaultPeriod = availableKeys.includes(LEADERBOARD_DEFAULT_PERIOD)
    ? LEADERBOARD_DEFAULT_PERIOD
    : availableKeys[0] || LEADERBOARD_DEFAULT_PERIOD;

  return {
    periods,
    labels,
    defaultPeriod,
    fetchedAt,
    source
  };
}

function searchTradersFromLeaderboardSnapshot(query, limit = 8) {
  const trimmed = typeof query === 'string' ? query.trim().toLowerCase() : '';
  if (!trimmed) return [];

  const snapshot = leaderboardCache.snapshot;
  if (!snapshot || !snapshot.periods || typeof snapshot.periods !== 'object') {
    return [];
  }

  const seen = new Set();
  const results = [];
  const periods = Object.values(snapshot.periods).filter(Array.isArray);

  for (const bucket of periods) {
    for (const entry of bucket) {
      if (!entry || typeof entry !== 'object' || typeof entry.address !== 'string') continue;
      const address = entry.address.toLowerCase();
      if (seen.has(address)) continue;

      const displayName = String(entry.displayName || '').toLowerCase();
      const username = String(entry.username || '').toLowerCase();
      const pseudonym = String(entry.pseudonym || '').toLowerCase();

      const matches =
        address.includes(trimmed) ||
        displayName.includes(trimmed) ||
        username.includes(trimmed) ||
        pseudonym.includes(trimmed);

      if (!matches) continue;

      seen.add(address);
      results.push({
        address,
        displayName: entry.displayName || `${address.slice(0, 6)}…${address.slice(-4)}`,
        rank: Number.isFinite(Number(entry.rank)) ? Number(entry.rank) : results.length + 1,
        roi: toFiniteNumber(entry.roi),
        pnl: toFiniteNumber(entry.pnl),
        volume: toFiniteNumber(entry.volume),
        trades: toFiniteNumber(entry.trades),
        avatarUrl: typeof entry.avatarUrl === 'string' ? entry.avatarUrl : null,
        username: typeof entry.username === 'string' ? entry.username : null,
        pseudonym: typeof entry.pseudonym === 'string' ? entry.pseudonym : null,
        displayUsernamePublic:
          typeof entry.displayUsernamePublic === 'boolean' ? entry.displayUsernamePublic : null
      });
      if (results.length >= limit) return results;
    }
  }

  return results.slice(0, limit);
}

function normaliseTraderSearchResults(payload, limit = 8) {
  const buckets = [
    payload?.profiles,
    payload?.results?.profiles,
    payload?.data?.profiles,
    payload?.results?.accounts,
    payload?.data?.accounts,
    payload?.results,
    payload?.accounts,
    payload?.data,
    payload?.traders,
    payload?.items,
    payload
  ];

  const seen = new Set();
  const results = [];

  for (const bucket of buckets) {
    if (!Array.isArray(bucket)) continue;
    for (let index = 0; index < bucket.length; index += 1) {
      if (results.length >= limit) break;
      const entry = bucket[index];
      if (!entry || typeof entry !== 'object') continue;

      const address =
        (typeof entry.address === 'string' && entry.address) ||
        (typeof entry.wallet === 'string' && entry.wallet) ||
        (typeof entry.walletAddress === 'string' && entry.walletAddress) ||
        (typeof entry.proxyWallet === 'string' && entry.proxyWallet) ||
        (typeof entry.account === 'string' && entry.account) ||
        (typeof entry.user === 'string' && entry.user) ||
        (typeof entry.profileAddress === 'string' && entry.profileAddress);

      if (!address) continue;
      const normalisedAddress = address.toLowerCase();
      if (seen.has(normalisedAddress)) continue;
      seen.add(normalisedAddress);

      const displayName =
        entry.displayName ||
        entry.name ||
        entry.username ||
        entry.profileName ||
        entry.pseudonym ||
        entry.handle ||
        (normalisedAddress.length > 10
          ? `${normalisedAddress.slice(0, 6)}…${normalisedAddress.slice(-4)}` : normalisedAddress);

      const metrics = entry.metrics || entry.stats || {};
      const extraStats = entry.stats && entry.stats !== metrics ? entry.stats : {};

      const pickFirstNumber = (...values) => {
        for (const value of values) {
          const numeric = toFiniteNumber(value);
          if (numeric !== null) {
            return numeric;
          }
        }
        return null;
      };

      const resolvedPnl = pickFirstNumber(
        entry.pnl,
        entry.netPnL,
        entry.realizedPnL,
        entry.totalPnL,
        entry.pnlAllTime,
        entry.allTimePnl,
        entry.allTimeProfit,
        entry.profit,
        metrics.pnl,
        metrics.netPnL,
        metrics.realizedPnL,
        metrics.totalPnL,
        metrics.pnlAllTime,
        metrics.allTimePnl,
        metrics.allTimeProfit,
        extraStats.pnl,
        extraStats.netPnL,
        extraStats.realizedPnL,
        extraStats.totalPnL,
        extraStats.pnlAllTime,
        extraStats.allTimePnl,
        extraStats.allTimeProfit
      );


      const resolvedVolume = pickFirstNumber(
        entry.volume,
        entry.totalVolume,
        entry.total_volume,
        entry.notional,
        metrics.volume,
        metrics.totalVolume,
        metrics.total_volume,
        metrics.notional,
        extraStats.volume,
        extraStats.totalVolume,
        extraStats.total_volume,
        extraStats.notional
      );

      const resolvedRoi = pickFirstNumber(
        entry.roi,
        entry.return,
        entry.percentage_return,
        entry.return_percentage,
        metrics.roi,
        metrics.return,
        metrics.percentage_return,
        metrics.return_percentage,
        extraStats.roi,
        extraStats.return,
        extraStats.percentage_return,
        extraStats.return_percentage
      );

      const resolvedTrades = pickFirstNumber(
        entry.trades,
        entry.tradeCount,
        entry.trade_count,
        entry.fills,
        metrics.trades,
        metrics.tradeCount,
        metrics.trade_count,
        metrics.fills,
        extraStats.trades,
        extraStats.tradeCount,
        extraStats.trade_count,
        extraStats.fills
      );

      results.push({
        address: normalisedAddress,
        displayName,
        username:
          (typeof entry.username === 'string' && entry.username) ||
          (typeof entry.name === 'string' && entry.name) ||
          null,
        pseudonym: typeof entry.pseudonym === 'string' && entry.pseudonym ? entry.pseudonym : null,
        displayUsernamePublic:
          typeof entry.displayUsernamePublic === 'boolean' ? entry.displayUsernamePublic : null,
        rank: Number.isFinite(Number(entry.rank)) ? Number(entry.rank) : results.length + 1,
        roi: resolvedRoi,
        pnl: resolvedPnl,
        volume: resolvedVolume,
        trades: resolvedTrades,
        avatarUrl:
          (typeof entry.profileImageOptimized === 'string' && entry.profileImageOptimized) ||
          (typeof entry.profileImage === 'string' && entry.profileImage) ||
          (typeof entry.avatarUrl === 'string' && entry.avatarUrl) ||
          (typeof entry.avatar === 'string' && entry.avatar) ||
          (typeof entry.image === 'string' && entry.image) ||
          null
      });
    }
    if (results.length >= limit) {
      break;
    }
  }

  return results.slice(0, limit);
}

async function fetchUserTotalPositionValue(address) {
  const normalised = typeof address === 'string' ? address.trim().toLowerCase() : '';
  if (!normalised) {
    return null;
  }

  const url = `${POLYMARKET_DATA_API_BASE}/value?user=${encodeURIComponent(normalised)}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'User-Agent': POLYMARKET_DATA_API_USER_AGENT
      }
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Value lookup failed (${response.status}): ${text}`);
    }

    const payload = await response.json();
    const candidates = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.data)
      ? payload.data
      : payload && typeof payload === 'object'
      ? [payload]
      : [];
    const match = candidates.find(
      (entry) => entry && typeof entry.user === 'string' && entry.user.toLowerCase() === normalised
    );
    if (!match) {
      return null;
    }

    const value =
      match.value ??
      match.totalValue ??
      match.total_value ??
      match.valueUsd ??
      match.value_usd ??
      match.usdValue ??
      match.usd_value ??
      null;

    return toFiniteNumber(value);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/404|not found/i.test(message)) {
      console.warn(`Failed to fetch total position value for ${normalised}`, message);
    }
    return null;
  }
}

async function enrichWithPortfolioValues(traders) {
  if (!Array.isArray(traders) || traders.length === 0) {
    return traders;
  }

  const toFetch = Array.from(
    new Set(
      traders
        .filter((entry) => entry && (entry.pnl === null || typeof entry.pnl !== 'number'))
        .map((entry) => entry.address.toLowerCase())
    )
  );

  if (!toFetch.length) {
    return traders;
  }

  const valueMap = new Map();
  await Promise.all(
    toFetch.map(async (address) => {
      const value = await fetchUserTotalPositionValue(address);
      if (value !== null) {
        valueMap.set(address, value);
      }
    })
  );

  if (valueMap.size === 0) {
    return traders;
  }

  return traders.map((entry) => {
    if (!entry) return entry;
    const lookup = valueMap.get(entry.address.toLowerCase());
    if (lookup === undefined || lookup === null) {
      return entry;
    }
    return {
      ...entry,
      pnl: entry.pnl ?? lookup,
      // if ROI missing and we have value but no volume, leave ROI null
      volume: entry.volume ?? null
    };
  });
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

async function fetchLeaderboardFromPath(path, limit = LEADERBOARD_LIMIT) {
  const normalisedPath = path.startsWith('/') ? path : `/${path}`;
  const url = `https://polymarket.com${normalisedPath}`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'polycopy/1.0 (+https://polymarket.com)'
      }
    });
    if (!response.ok) {
      throw new Error(`request failed with ${response.status}`);
    }
    const html = await response.text();
    const match = html.match(/__NEXT_DATA__" type="application\/json" crossorigin="anonymous">(.*?)<\/script>/);
    if (!match) {
      throw new Error('missing __NEXT_DATA__ payload');
    }
    const payload = JSON.parse(match[1]);
    const entries = extractLeaderboardEntriesFromNextPayload(payload, limit);
    return entries.slice(0, limit);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Failed to scrape leaderboard from ${url}`, message);
    return [];
  }
}

async function requestTraderSearch(query, limit = 8) {
  if (!POLYMARKET_SEARCH_API_URL) {
    throw new Error('Trader search URL is not configured');
  }

  const resolvedLimit = Math.max(1, Number.isFinite(Number(limit)) ? Number(limit) : 8);
  const userAgent = POLYMARKET_SEARCH_API_USER_AGENT || 'polycopy/1.0 (+https://polymarket.com)';

  const applyCredentialHeaders = (target) => {
    if (POLYMARKET_SEARCH_API_BEARER) {
      target.Authorization = `Bearer ${POLYMARKET_SEARCH_API_BEARER}`;
    }
    if (POLYMARKET_SEARCH_CF_ACCESS_ID && POLYMARKET_SEARCH_CF_ACCESS_SECRET) {
      target['CF-Access-Client-Id'] = POLYMARKET_SEARCH_CF_ACCESS_ID;
      target['CF-Access-Client-Secret'] = POLYMARKET_SEARCH_CF_ACCESS_SECRET;
    }
    if (POLYMARKET_SEARCH_API_KEY) {
      target['X-API-Key'] = POLYMARKET_SEARCH_API_KEY;
    }
  };

  const attemptGet = async () => {
    const url = new URL(POLYMARKET_SEARCH_API_URL);
    url.searchParams.set('q', query);
    url.searchParams.set('limit', String(resolvedLimit));
    url.searchParams.set('limit_per_type', String(resolvedLimit));
    url.searchParams.set('search_profiles', 'true');
    if (!url.searchParams.has('profiles')) {
      url.searchParams.set('profiles', 'true');
    }
    if (!url.searchParams.has('events')) {
      url.searchParams.set('events', 'false');
    }
    if (!url.searchParams.has('tags')) {
      url.searchParams.set('tags', 'false');
    }

    const headers = {
      Accept: 'application/json',
      'User-Agent': userAgent
    };
    applyCredentialHeaders(headers);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Trader lookup failed (${response.status}): ${text}`);
    }

    return response.json();
  };

  const attemptPost = async () => {
    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': userAgent
    };
    applyCredentialHeaders(headers);

    const response = await fetch(POLYMARKET_SEARCH_API_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        query,
        limit: resolvedLimit,
        limit_per_type: resolvedLimit,
        search_profiles: true,
        types: ['profiles', 'accounts', 'users']
      })
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Trader lookup failed (${response.status}): ${text}`);
    }

    return response.json();
  };

  const shouldPreferGet =
    !POLYMARKET_SEARCH_IS_CUSTOM || /public-search/i.test(POLYMARKET_SEARCH_API_URL);

  if (shouldPreferGet) {
    try {
      return await attemptGet();
    } catch (error) {
      if (!POLYMARKET_SEARCH_IS_CUSTOM) {
        throw error;
      }
      // fall back to POST for custom endpoints that reject GET
    }
  }

  if (POLYMARKET_SEARCH_IS_CUSTOM) {
    return attemptPost();
  }

  // If we reached this point the GET request failed and we have no custom fallback.
  throw new Error('Trader lookup request could not be completed using the public search endpoint.');
}

async function searchTraders(query, limit = 8) {
  const trimmed = typeof query === 'string' ? query.trim() : '';
  if (!trimmed) {
    return { traders: [], error: null };
  }

  try {
    const payload = await requestTraderSearch(trimmed, limit);
    const traders = normaliseTraderSearchResults(payload, limit);
    const enriched = await enrichWithPortfolioValues(traders);
    if (enriched.length > 0) {
      return { traders: enriched, error: null };
    }
    const fallbackFromLeaderboard = searchTradersFromLeaderboardSnapshot(trimmed, limit);
    return { traders: fallbackFromLeaderboard, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const authIssue = /invalid token|unauthorised|unauthorized|forbidden|401|403/i.test(message);
    if (!authIssue) {
      console.error('Failed to search traders', message);
    }
    const fallbackFromLeaderboard = searchTradersFromLeaderboardSnapshot(trimmed, limit);
    if (fallbackFromLeaderboard.length > 0) {
      return { traders: fallbackFromLeaderboard, error: null };
    }
    return {
      traders: [],
      error: authIssue
        ? 'Authentication is required for trader lookup. Check your Polymarket search credentials (see https://docs.polymarket.com/api-reference/search/search-markets-events-and-profiles).'
        : message
    };
  }
}

app.get('/api/markets', async (_req, res) => {
  const markets = await fetchMarkets();
  res.json({ markets });
});

app.get('/api/breaking-news', async (req, res) => {
  const requestedLimit = Number(req.query?.limit);
  const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(30, requestedLimit)) : 16;
  const now = Date.now();
  if (breakingNewsCache.payload && breakingNewsCache.expiresAt > now) {
    return res.json(breakingNewsCache.payload);
  }

  const markets = await fetchMarkets();
  const headlines = await fetchTopHeadlines(30);
  const headlineMappedStories = buildHeadlineMappedStories(markets, headlines, Math.min(limit, 10));
  const marketOnlyStories = buildBreakingNewsStories(markets, limit * 2);

  const combined = [...headlineMappedStories];
  const seenUrls = new Set(combined.map((story) => story.url));
  for (const story of marketOnlyStories) {
    if (combined.length >= limit) break;
    if (!story?.url || seenUrls.has(story.url)) continue;
    seenUrls.add(story.url);
    combined.push(story);
  }

  const payload = {
    stories: combined.slice(0, limit),
    fetchedAt: new Date().toISOString()
  };
  breakingNewsCache.expiresAt = now + 30_000;
  breakingNewsCache.payload = payload;

  res.json(payload);
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

app.post('/api/copy-trade/execute', async (req, res) => {
  if (!FEATURE_REAL_COPY_EXECUTION) {
    res.status(503).json({
      error:
        'Real copy execution is disabled. Set FEATURE_REAL_COPY_EXECUTION=true to enable this endpoint.'
    });
    return;
  }

  const { order, targetWallet, sourceTrade } = req.body || {};
  if (!order || typeof order !== 'object' || !targetWallet || typeof targetWallet !== 'string') {
    res.status(400).json({ error: 'order object and targetWallet are required' });
    return;
  }

  if (COPY_EXECUTION_MODE !== 'webhook') {
    res.status(501).json({
      error: `COPY_EXECUTION_MODE=${COPY_EXECUTION_MODE} is not implemented. Use COPY_EXECUTION_MODE=webhook.`
    });
    return;
  }

  if (!COPY_EXECUTOR_WEBHOOK_URL) {
    res.status(500).json({
      error:
        'COPY_EXECUTOR_WEBHOOK_URL is not configured. Provide a signer/executor service URL before enabling real execution.'
    });
    return;
  }

  try {
    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    };
    if (COPY_EXECUTOR_WEBHOOK_AUTH_TOKEN) {
      headers.Authorization = `Bearer ${COPY_EXECUTOR_WEBHOOK_AUTH_TOKEN}`;
    }

    const response = await fetch(COPY_EXECUTOR_WEBHOOK_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        order,
        targetWallet: targetWallet.toLowerCase(),
        sourceTrade: sourceTrade ?? null,
        requestedAt: new Date().toISOString(),
        source: 'polycopy'
      })
    });

    const text = await response.text();
    let payload = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = { raw: text };
    }

    if (!response.ok) {
      res.status(502).json({
        error: 'Executor rejected copy order',
        status: response.status,
        details: payload
      });
      return;
    }

    res.json({
      success: true,
      mode: COPY_EXECUTION_MODE,
      executor: 'webhook',
      result: payload
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(502).json({ error: 'Failed to execute copy order', details: message });
  }
});

app.get('/api/leaderboard', async (req, res) => {
  const forceRefreshRaw = req.query?.refresh;
  const forceRefresh =
    typeof forceRefreshRaw === 'string'
      ? forceRefreshRaw === '1' || forceRefreshRaw.toLowerCase() === 'true'
      : Array.isArray(forceRefreshRaw)
      ? forceRefreshRaw.includes('1') || forceRefreshRaw.some((value) => value?.toLowerCase?.() === 'true')
      : false;

  const now = Date.now();
  try {
    if (!forceRefresh && leaderboardCache.snapshot && leaderboardCache.expiresAt > now) {
      res.json({
        ...leaderboardCache.snapshot,
        limit: LEADERBOARD_LIMIT,
        cache: {
          hit: true,
          expiresAt: leaderboardCache.expiresAt,
          ttlMs: Math.max(0, leaderboardCache.expiresAt - now)
        }
      });
      return;
    }

    const snapshot = await fetchLeaderboardSnapshots(LEADERBOARD_LIMIT);
    const nextExpiresAt = now + LEADERBOARD_CACHE_TTL_MS;
    leaderboardCache.snapshot = snapshot;
    leaderboardCache.expiresAt = nextExpiresAt;

    res.json({
      periods: snapshot.periods,
      labels: snapshot.labels,
      defaultPeriod: snapshot.defaultPeriod,
      limit: LEADERBOARD_LIMIT,
      fetchedAt: snapshot.fetchedAt || null,
      source: snapshot.source || 'unknown',
      cache: {
        hit: false,
        expiresAt: nextExpiresAt,
        ttlMs: LEADERBOARD_CACHE_TTL_MS
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Failed to retrieve leaderboard snapshot', message);
    res.status(503).json({ error: 'Leaderboard data is unavailable right now. Try again shortly.' });
  }
});

app.get('/api/trader-search', async (req, res) => {
  const { query = '', limit } = req.query || {};
  const parsedLimit = Number.isFinite(Number(limit)) ? Math.max(1, Math.min(Number(limit), 20)) : 8;
  const { traders, error } = await searchTraders(query, parsedLimit);
  res.json({ traders, error });
});

// --- Portfolio, Open Orders, and PnL endpoints ---
// GET /api/users/:address/portfolio
app.get('/api/users/:address/portfolio', async (req, res) => {
  const { address } = req.params;
  try {
    const value = await fetchUserTotalPositionValue(address);
    res.json({ address, portfolioValue: value });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch portfolio value' });
  }
});

// GET /api/users/:address/pnl
app.get('/api/users/:address/pnl', async (req, res) => {
  const { address } = req.params;
  try {
    const trades = await fetchUserTrades(address);
    const pnlData = computePnlFromTrades(trades);

    res.json({
      address: address.toLowerCase(),
      ...pnlData
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch PnL' });
  }
});

// GET /api/users/:address/open-orders
app.get('/api/users/:address/open-orders', async (req, res) => {
  const { address } = req.params;
  try {
    const trades = await fetchUserTrades(address);
    const snapshot = computePortfolioSnapshotFromTrades(trades);
    const openOrders = snapshot.openPositions.map((position) => ({
      market: position.market,
      side: position.side,
      size: Math.abs(position.shares),
      price: position.avgEntryPrice,
      status: 'position_open'
    }));

    res.json({
      address: address.toLowerCase(),
      openOrders,
      derived: true,
      note: 'Polymarket does not provide public open order books per wallet via this endpoint; these are derived open positions from recent fills.'
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch open orders' });
  }
});

// GET /api/users/:address/overview
app.get('/api/users/:address/overview', async (req, res) => {
  const { address } = req.params;
  try {
    const trades = await fetchUserTrades(address);
    const [portfolioValue] = await Promise.all([fetchUserTotalPositionValue(address)]);
    const snapshot = computePortfolioSnapshotFromTrades(trades);
    const pnlData = computePnlFromTrades(trades);
    const openOrders = snapshot.openPositions.map((position) => ({
      market: position.market,
      side: position.side,
      size: Math.abs(position.shares),
      price: position.avgEntryPrice,
      status: 'position_open'
    }));

    res.json({
      address: address.toLowerCase(),
      trades,
      pnl: pnlData,
      portfolio: {
        portfolioValue,
        marketCount: snapshot.marketCount,
        notionalVolume: snapshot.notionalVolume
      },
      openOrders: {
        openOrders,
        derived: true,
        note: 'Derived open positions from recent fills.'
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch trader overview' });
  }
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
