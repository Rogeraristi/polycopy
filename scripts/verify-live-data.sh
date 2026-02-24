#!/usr/bin/env bash
set -euo pipefail

API_BASE="${1:-http://localhost:4000}"
ADDRESS="${2:-0x6bab41a0dc40d6dd4c1a915b8c01969479fd1292}"

echo "==> Leaderboard debug"
curl -sS "${API_BASE}/api/leaderboard/debug?refresh=1" | sed 's/^/  /'
echo
echo

for period in today weekly monthly all; do
  echo "==> Trader overview (${period}) for ${ADDRESS}"
  curl -sS "${API_BASE}/api/users/${ADDRESS}/overview?period=${period}&limit=250" | sed 's/^/  /'
  echo
  echo
done

echo "==> Done"
