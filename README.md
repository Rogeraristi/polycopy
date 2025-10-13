# PolyCopy

PolyCopy is a minimal web application that surfaces live trade flow from Polymarket wallets and prepares mirror orders so you can copy profitable traders with low latency.

## Features

- 🔍 Monitor a specific Polymarket wallet and stream their latest trades via WebSocket polling.
- ⚡ Latency badge to understand how fresh the mirrored data is.
- 📈 Display of the most liquid markets to prioritise fills.
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

- `PORT` – Optional. Overrides the backend port (defaults to `4000`).
- `POLYMARKET_BASE` – Optional. Overrides the Polymarket API base URL (defaults to `https://gamma-api.polymarket.com`).

## Notes

The `/api/copy-trade` endpoint returns an unsigned order payload. You must submit the order with your wallet signature through Polymarket's authenticated trading API.
