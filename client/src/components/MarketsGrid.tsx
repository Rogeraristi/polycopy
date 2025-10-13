interface MarketsGridProps {
  markets: Array<{
    id: string;
    question: string;
    liquidity: number;
    volume24h: number;
    outcomes: any[];
  }>;
}

export function MarketsGrid({ markets }: MarketsGridProps) {
  if (markets.length === 0) {
    return null;
  }

  return (
    <section className="card p-6 space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">High-liquidity markets</h2>
          <p className="text-sm text-slate-400">Focus on the most active venues to maximise fill probability when copying trades.</p>
        </div>
      </header>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {markets.map((market) => (
          <div key={market.id} className="rounded-xl border border-slate-700/60 bg-slate-900/60 p-4">
            <h3 className="text-base font-semibold text-white mb-2 overflow-hidden text-ellipsis whitespace-normal">
              {market.question}
            </h3>
            <dl className="grid grid-cols-2 gap-3 text-sm text-slate-300">
              <div>
                <dt className="text-xs uppercase text-slate-500">Liquidity</dt>
                <dd className="font-medium">${market.liquidity.toLocaleString()}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-slate-500">24h Volume</dt>
                <dd className="font-medium">${market.volume24h.toLocaleString()}</dd>
              </div>
            </dl>
          </div>
        ))}
      </div>
    </section>
  );
}
