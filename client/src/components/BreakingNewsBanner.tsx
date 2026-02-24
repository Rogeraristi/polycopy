
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
  const offsetRef = useRef(0);
  const contentWidthRef = useRef(0);
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
          const marketPath = m.slug ? `/${m.slug}` : `/market/${m.id}`;
          return {
            text: String(m.question || 'Polymarket market'),
            url: `https://polymarket.com${marketPath}`,
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

  // Measure one full content cycle width (we render the list twice).
  useEffect(() => {
    const ticker = tickerRef.current;
    if (!ticker) return;
    const measure = () => {
      contentWidthRef.current = ticker.scrollWidth / 2;
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [headlines]);

  // Animate ticker with seamless looping + true hover pause.
  useEffect(() => {
    const ticker = tickerRef.current;
    if (!ticker) return;
    let animationId: number;
    const speed = 0.18;

    function animate() {
      if (!ticker) return;
      if (!isPaused) {
        offsetRef.current -= speed;
        const loopWidth = contentWidthRef.current;
        if (loopWidth > 0 && Math.abs(offsetRef.current) >= loopWidth) {
          offsetRef.current += loopWidth;
        }
        ticker.style.transform = `translateX(${offsetRef.current}px)`;
      }
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
            [...headlines, ...headlines].map((h, i) => (
              <a
                key={`${h.url}-${i}`}
                href={h.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 hover:underline hover:text-yellow-200 transition-colors"
              >
                <span>{h.text}</span>
                <span className={`font-semibold ${h.chance !== null && h.chance >= 50 ? 'text-emerald-200' : 'text-rose-200'}`}>
                  {h.chance === null ? 'N/A chance' : `${Math.round(h.chance)}% chance`}
                </span>
              </a>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
