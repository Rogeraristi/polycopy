interface LatencyBadgeProps {
  latencyMs: number | null;
}

function getLatencyLabel(latencyMs: number | null) {
  if (latencyMs === null) return { label: 'Live', tone: 'text-emerald-300 border-emerald-400/40 bg-emerald-500/10' };
  if (latencyMs < 1500) return { label: `${latencyMs}ms`, tone: 'text-emerald-300 border-emerald-400/40 bg-emerald-500/10' };
  if (latencyMs < 4000) return { label: `${latencyMs}ms`, tone: 'text-amber-300 border-amber-400/40 bg-amber-500/10' };
  return { label: `${latencyMs}ms`, tone: 'text-rose-300 border-rose-400/40 bg-rose-500/10' };
}

export function LatencyBadge({ latencyMs }: LatencyBadgeProps) {
  const { label, tone } = getLatencyLabel(latencyMs);
  return (
    <span className={`px-3 py-1 text-xs font-medium border rounded-full uppercase tracking-wide ${tone}`}>
      Latency {label}
    </span>
  );
}
