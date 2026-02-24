import type { PropsWithChildren } from 'react';
import GlassSurface from './GlassSurface';

interface GlassPanelProps extends PropsWithChildren {
  className?: string;
}

export default function GlassPanel({ className = '', children }: GlassPanelProps) {
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
      className={`!items-stretch !justify-start ${className}`}
      style={{ minHeight: 0 }}
    >
      {children}
    </GlassSurface>
  );
}
