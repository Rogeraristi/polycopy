import os
import requests

API_BASE = os.getenv("API_BASE", "http://localhost:4000")

def get_json(url: str):
    r = requests.get(url, timeout=30)
    r.raise_for_status()
    return r.json()

def main():
    print("Using API_BASE:", API_BASE)

    # 1) Your app's analytics leaderboard cache
    leaderboard = get_json(f"{API_BASE}/api/analytics/leaderboard")
    snapshot = leaderboard.get("snapshot", {})
    default_period = snapshot.get("defaultPeriod", "weekly")
    entries = snapshot.get("periods", {}).get(default_period, [])[:10]

    print(f"\nTop {len(entries)} traders ({default_period}):")
    for e in entries:
      print(f"- rank={e.get('rank')} name={e.get('displayName')} address={e.get('address')}")

    # 2) Pull history for first trader (if present)
    if entries:
        address = entries[0]["address"]
        history_payload = get_json(f"{API_BASE}/api/analytics/trader/{address}/history")
        history = history_payload.get("history", [])

        print(f"\nHistory points for {address}: {len(history)}")
        for p in history[:5]:
            print(
                f"  ts={p.get('timestamp')} pnl={p.get('pnl')} "
                f"trades={p.get('tradeCount')} volume={p.get('notionalVolume')}"
            )

        # 3) Overview endpoint (profile + trades + pnl + portfolio)
        overview = get_json(f"{API_BASE}/api/users/{address}/overview?period=all&limit=200")
        profile = overview.get("profile", {})
        pnl = overview.get("pnl", {})
        portfolio = overview.get("portfolio", {})

        print("\nOverview snapshot:")
        print("  displayName:", profile.get("displayName"))
        print("  rank:", profile.get("rank"))
        print("  roi:", profile.get("roi"))
        print("  pnl:", pnl.get("pnl"))
        print("  tradeCount:", pnl.get("tradeCount"))
        print("  portfolioValue:", portfolio.get("portfolioValue"))
    else:
        print("\nNo entries returned from analytics leaderboard.")

if __name__ == "__main__":
    main()

