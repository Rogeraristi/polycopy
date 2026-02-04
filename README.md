# PolyCopy

PolyCopy is a minimal web application that surfaces live trade flow from Polymarket wallets and prepares mirror orders so you can copy profitable traders with low latency.

## Features

- 🔍 Monitor a specific Polymarket wallet and stream their latest trades via WebSocket polling.
- ⚡ Latency badge to understand how fresh the mirrored data is.
- 📈 Display of the most liquid markets to prioritise fills.
- 🔐 Google OAuth sign-in so every operator can manage their own Polymarket automation credentials.
- 🤖 Optional auto-copy mode that immediately prepares an order payload for the most recent trade using your sizing multiplier.

## Getting started

```bash
npm install
npm run dev
```

The command above starts both the Express server (port `4000`) and the Vite development server (port `5173`). The Vite dev server proxies API and WebSocket requests to the backend.

If you are running in an environment without NPM registry access, install the dependencies manually or use an offline cache, then run the dev server scripts from the respective workspaces:

```bash
npm run dev --workspace server
npm run dev --workspace client
```

## Environment variables

### Core

- `PORT` – Optional. Backend port (defaults to `4000`).
- `POLYMARKET_BASE` – Optional. Polymarket API base URL (defaults to `https://gamma-api.polymarket.com`).

### Client origins & sessions

- `CLIENT_ORIGIN` – Primary frontend origin allowed to access the API (defaults to `http://localhost:5173`).
- `CLIENT_ORIGINS` – Optional comma-separated list of additional allowed origins.
- `SERVER_BASE_URL` – Public URL of the backend, used to build OAuth callbacks (defaults to `http://localhost:<PORT>`).
- `SESSION_SECRET` – Secret used to sign session cookies. **Set this in production.**
- `SESSION_COOKIE_NAME` – Optional. Custom session cookie name (defaults to `polycopy.sid`).
- `SESSION_MAX_AGE` – Optional. Session lifetime in milliseconds (defaults to 7 days).

### Google OAuth

- `GOOGLE_CLIENT_ID` – Required to enable Google sign-in.
- `GOOGLE_CLIENT_SECRET` – Required to enable Google sign-in.
- `GOOGLE_CALLBACK_URL` – Optional. Explicit callback URL (defaults to `<SERVER_BASE_URL>/api/auth/google/callback`).
- `AUTH_SUCCESS_REDIRECT` – Optional. URL to redirect after successful login (defaults to `<CLIENT_ORIGIN>/`).
- `AUTH_FAILURE_REDIRECT` – Optional. URL to redirect after login failure (defaults to `<CLIENT_ORIGIN>/?authError=oauth_failed`).
- `GOOGLE_AUTH_SCOPES` – Optional. Comma-separated scopes (defaults to `profile,email`).
- `GOOGLE_AUTH_PROMPT` – Optional. Prompt parameter passed to Google (defaults to `select_account`).

### Firebase (optional, for user storage)

- `FIREBASE_PROJECT_ID` – Firebase project ID.
- `FIREBASE_CLIENT_EMAIL` – Client email from the service-account JSON.
- `FIREBASE_PRIVATE_KEY` – Private key from the service-account JSON (escape newlines as `\n` in `.env`).
- `FIREBASE_DATABASE_URL` – Optional. Realtime Database/Firestore URL (only required for RTDB).
- `FIREBASE_USER_COLLECTION` – Optional. Firestore collection name for per-user settings (`users` by default).

For the React client (create `client/.env` or `client/.env.local`):

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_MEASUREMENT_ID` (optional, only needed for Analytics)

### Firebase Cloud Functions (optional leaderboard cron)

If you want to keep Polymarket leaderboard snapshots in Firestore, the `firebase/functions` workspace ships a ready-made Cloud Function:

- `LEADERBOARD_LIMIT` – Optional. Max traders per period (defaults to 12).
- `LEADERBOARD_REFRESH_SCHEDULE` – Optional. Scheduler string (defaults to `every 30 minutes`).
- `FIREBASE_LEADERBOARD_COLLECTION` – Firestore collection for the latest snapshot (`leaderboardSnapshots` default).
- `FIREBASE_LEADERBOARD_HISTORY_COLLECTION` – Firestore collection for historical runs (`leaderboardSnapshotsHistory` default).
- `LEADERBOARD_USER_AGENT` – Optional. Custom UA for the Polymarket scrape.

Deploy steps (from repo root):

```bash
cd firebase/functions
npm install
npx firebase deploy --only functions:refreshLeaderboard,functions:scheduledRefreshLeaderboard
```

The scheduled function runs on the cron defined by `LEADERBOARD_REFRESH_SCHEDULE`; the HTTPS function lets you trigger a manual refresh.

> Once deployed, the Express API reads the latest snapshot from `FIREBASE_LEADERBOARD_COLLECTION`, falling back to a live scrape if the cached document is stale or missing.

> ⚠️ The development setup uses the in-memory session store from Express. Switch to a persistent store (e.g. Redis) before deploying to production.

## Notes

The `/api/copy-trade` endpoint returns an unsigned order payload. You must submit the order with your wallet signature through Polymarket's authenticated trading API.
