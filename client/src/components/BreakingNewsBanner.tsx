
import { useState, useEffect, useRef } from 'react';

const API_BASE = (import.meta as any).env ? (import.meta as any).env.VITE_API_BASE_URL || '/api' : '/api';

interface HeadlineItem {
  text: string;
  url: string;
  chance: number | null;
}

function parseChanceFromMarket(market: any): number | null {
  const directCandidates = [
    market?.probability,
    market?.chance,
    market?.prob,
    market?.lastTradePrice,
    market?.last_price
  ];

  for (const value of directCandidates) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      const normalized = numeric > 1 ? numeric : numeric * 100;
      if (normalized >= 0 && normalized <= 100) {
        return Math.round(normalized);
      }
    }
  }

  const outcomeCandidates = [market?.outcomePrices, market?.prices, market?.outcomes];
  for (const candidate of outcomeCandidates) {
    if (!Array.isArray(candidate) || candidate.length === 0) continue;
    const first = Number(candidate[0]);
    if (Number.isFinite(first)) {
      const normalized = first > 1 ? first : first * 100;
      if (normalized >= 0 && normalized <= 100) {
        return Math.round(normalized);
      }
    }
  }

  return null;
}

export default function BreakingNewsBanner() {
  const tickerRef = useRef<HTMLDivElement>(null);
  const [headlines, setHeadlines] = useState<HeadlineItem[]>([]);
  const [isPaused, setIsPaused] = useState(false);

  // Fetch live markets every 10 seconds
  useEffect(() => {
    let cancelled = false;
    async function fetchMarkets() {
      try {
        const res = await fetch(`${API_BASE}/markets`);
        const data = await res.json();
        if (!Array.isArray(data.markets)) return;
        const formatted = data.markets.slice(0, 12).map((m: any) => {
          const chance = parseChanceFromMarket(m);
          return {
            text: String(m.question || 'Polymarket market'),
            url: `https://polymarket.com/market/${m.id}`,
            chance
          };
        });
        if (!cancelled) setHeadlines(formatted);
      } catch {}
    }
    fetchMarkets();
    const interval = setInterval(fetchMarkets, 10000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // Animate ticker (slower for readability)
  useEffect(() => {
    const ticker = tickerRef.current;
    if (!ticker) return;
    let animationId: number;
    let start = 0;
    const speed = 0.35;
    function animate() {
      if (!ticker) return;
      if (!isPaused) {
        start -= speed;
      }
      if (ticker.scrollWidth + start < 0) {
        const parent = ticker.parentElement;
        if (parent) {
          start = parent.offsetWidth;
        } else {
          start = 0;
        }
      }
      ticker.style.transform = `translateX(${start}px)`;
      animationId = requestAnimationFrame(animate);
    }
    animate();
    return () => cancelAnimationFrame(animationId);
  }, [headlines, isPaused]);

  return (
    <div
      className="w-full bg-gradient-to-r from-pink-600 via-rose-500 to-amber-400 text-white py-2 px-4 overflow-hidden relative flex items-center border-b border-rose-400/40"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <img src="/fire.svg" alt="Breaking News" className="h-5 w-5 mr-2 animate-pulse" />
      <span className="font-bold uppercase tracking-widest mr-4">Breaking News</span>
      <div className="flex-1 overflow-hidden">
        <div ref={tickerRef} className="whitespace-nowrap flex gap-8 text-sm font-medium" style={{ willChange: 'transform' }}>
          {headlines.length === 0 ? (
            <span className="opacity-70">Loading markets…</span>
          ) : (
            headlines.map((h, i) => (
              <a
                key={i}
                href={h.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 hover:underline hover:text-yellow-200 transition-colors"
              >
                <span>{h.text}</span>
                {h.chance !== null && (
                  <span className={`font-semibold ${h.chance >= 50 ? 'text-emerald-200' : 'text-rose-200'}`}>
                    {h.chance}% chance
                  </span>
                )}
              </a>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
