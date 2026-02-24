
import { useState, useEffect, useRef } from 'react';

const API_BASE = (import.meta as any).env ? (import.meta as any).env.VITE_API_BASE_URL || '/api' : '/api';

interface HeadlineItem {
  text: string;
  url: string;
  chance: number | null;
  outcomeLabel?: string | null;
  updatedAt?: string | null;
  volume24h?: number | null;
  eventKey?: string | null;
  source?: string | null;
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
  const rotationCursorRef = useRef(0);

  // Fetch live markets every 8 seconds
  useEffect(() => {
    let cancelled = false;
    async function fetchMarkets() {
      try {
        const res = await fetch(`${API_BASE}/breaking-news?limit=18`);
        const data = await res.json();
        if (!Array.isArray(data.stories)) return;

        // De-duplicate + limit repeats from the same event.
        const uniqueByQuestion = new Map<string, any>();
        const eventCounts = new Map<string, number>();
        for (const market of data.stories) {
          const question = String(market?.title || market?.question || '').trim();
          if (!question) continue;

          const eventKey = String(market?.eventSlug || market?.eventTitle || '').trim().toLowerCase();
          if (eventKey) {
            const eventCount = eventCounts.get(eventKey) || 0;
            if (eventCount >= 2) continue;
            eventCounts.set(eventKey, eventCount + 1);
          }

          const key = question.toLowerCase().replace(/\s+/g, ' ').replace(/[^\w\s%$]/g, '');
          const existing = uniqueByQuestion.get(key);
          if (!existing || Number(market?.volume24h || 0) > Number(existing?.volume24h || 0)) {
            uniqueByQuestion.set(key, market);
          }
        }

        const uniqueMarkets = Array.from(uniqueByQuestion.values()).sort((a, b) => {
          const av = Number(a?.volume24h || 0);
          const bv = Number(b?.volume24h || 0);
          return bv - av;
        });

        // Rotate which chunk is displayed each refresh so users see more live variety.
        const chunkSize = 16;
        const maxStart = Math.max(0, uniqueMarkets.length - chunkSize);
        if (maxStart > 0) {
          rotationCursorRef.current = (rotationCursorRef.current + 4) % (maxStart + 1);
        } else {
          rotationCursorRef.current = 0;
        }
        const windowed = uniqueMarkets.slice(rotationCursorRef.current, rotationCursorRef.current + chunkSize);
        const selected = windowed.length > 0 ? windowed : uniqueMarkets.slice(0, chunkSize);

        const formatted = selected.map((m: any) => {
          const chance = parseChanceFromMarket(m) ?? (Number.isFinite(Number(m?.chance)) ? Number(m.chance) : null);
          const outcomeText = typeof m?.outcomeLabel === 'string' && m.outcomeLabel.trim().length > 0 ? m.outcomeLabel.trim() : null;
          const resolvedUrl =
            typeof m?.url === 'string' && /^https?:\/\//.test(m.url)
              ? m.url
              : m?.eventSlug
              ? `https://polymarket.com/event/${m.eventSlug}`
              : m?.slug
              ? `https://polymarket.com/event/${m.slug}`
              : `https://polymarket.com/market/${m.id}`;

          return {
            text: String(m.title || m.question || 'Polymarket market'),
            url: resolvedUrl,
            chance,
            outcomeLabel: outcomeText ? `${outcomeText}${chance !== null ? ` ${Math.round(chance)}%` : ''}` : null,
            volume24h: Number.isFinite(Number(m.volume24h)) ? Number(m.volume24h) : null,
            source: typeof m?.source === 'string' ? m.source : null
          };
        });
        if (!cancelled) setHeadlines(formatted);
      } catch {}
    }
    fetchMarkets();
    const interval = setInterval(fetchMarkets, 8000);
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
      <span className="mr-2 inline-block h-2 w-2 rounded-full bg-white/90 shadow-[0_0_8px_rgba(255,255,255,0.7)]" />
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
                <span className="text-white">LIVE</span>
                <span>{h.text}</span>
                {h.source && <span className="text-white/80">[{h.source}]</span>}
                <span className={`font-semibold ${h.chance !== null && h.chance >= 50 ? 'text-emerald-200' : 'text-rose-200'}`}>
                  {h.chance === null ? 'N/A chance' : `${Math.round(h.chance)}% chance`}
                </span>
                {h.outcomeLabel && <span className="text-amber-100/95">{h.outcomeLabel}</span>}
                {typeof h.volume24h === 'number' && Number.isFinite(h.volume24h) && (
                  <span className="text-blue-100/90">${Math.round(h.volume24h).toLocaleString()} 24h vol</span>
                )}
              </a>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
