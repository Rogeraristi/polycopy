import type { PropsWithChildren } from 'react';
import GlassSurface from './GlassSurface';

interface GlassPanelProps extends PropsWithChildren {
  className?: string;
  advanced?: boolean;
}

export default function GlassPanel({ className = '', advanced = false, children }: GlassPanelProps) {
  if (!advanced) {
    return (
      <div
        className={`w-full rounded-[22px] border border-white/15 bg-slate-900/55 backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_8px_24px_rgba(2,6,23,0.3)] ${className}`}
      >
        {children}
      </div>
    );
  }

  return (
    <GlassSurface
      width="100%"
      height="auto"
      borderRadius={22}
      borderWidth={0.08}
      brightness={64}
      opacity={0.88}
      blur={12}
      displace={0.4}
      backgroundOpacity={0.08}
      saturation={1.15}
      distortionScale={-140}
      className="!items-stretch !justify-start"
      style={{ minHeight: 0 }}
    >
      <div className={`w-full ${className}`}>{children}</div>
    </GlassSurface>
  );
}
