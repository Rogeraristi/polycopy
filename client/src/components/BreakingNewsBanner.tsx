
import { useState } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';


export default function BreakingNewsBanner() {
  const tickerRef = useRef<HTMLDivElement>(null);
  const [headlines, setHeadlines] = useState<{ text: string; url: string }[]>([]);

  // Fetch live markets and trades every 10 seconds
  useEffect(() => {
    let cancelled = false;
    async function fetchMarkets() {
      try {
        const res = await fetch(`${API_BASE}/markets`);
        const data = await res.json();
        if (!Array.isArray(data.markets)) return;
        // Format: "[Market Question] [probability%]"
        const formatted = data.markets.slice(0, 10).map((m: any) => ({
          text: `${m.question} ${m.probability ? Math.round(m.probability * 100) + '% Chance' : ''}`.trim(),
          url: `https://polymarket.com/market/${m.id}`
        }));
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

  // Animate ticker
  useEffect(() => {
    const ticker = tickerRef.current;
    if (!ticker) return;
    let animationId: number;
    let start = 0;
    const speed = 1;
    function animate() {
      start -= speed;
      if (ticker.scrollWidth + start < 0) {
        start = ticker.parentElement!.offsetWidth;
      }
      ticker.style.transform = `translateX(${start}px)`;
      animationId = requestAnimationFrame(animate);
    }
    animate();
    return () => cancelAnimationFrame(animationId);
  }, [headlines]);

  return (
    <div className="w-full bg-gradient-to-r from-pink-600 via-rose-500 to-amber-400 text-white py-2 px-4 overflow-hidden relative flex items-center border-b border-rose-400/40">
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
                className="hover:underline hover:text-yellow-200 transition-colors"
              >
                {h.text}
              </a>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
