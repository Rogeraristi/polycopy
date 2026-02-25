
import React, { useRef, useEffect } from 'react';

interface MetallicLogoProps {
  src?: string;
  size?: number;
  animated?: boolean;
}

export default function MetallicLogo({ src = '/P_logo.svg', size = 64, animated = false }: MetallicLogoProps) {
  // Only apply metallic paint animation for large logo (size >= 200) and animated=true
  if (animated && size >= 200) {
    const gradientRef = useRef(null);
    useEffect(() => {
      let animationFrame;
      let offset = 0;
      const animate = () => {
        offset = (offset + 0.01) % 1;
        if (gradientRef.current) {
          gradientRef.current.setAttribute('x1', `${offset}`);
          gradientRef.current.setAttribute('x2', `${1 - offset}`);
        }
        animationFrame = requestAnimationFrame(animate);
      };
      animate();
      return () => cancelAnimationFrame(animationFrame);
    }, []);
    return (
      <svg width={size} height={size} viewBox="0 0 200 200">
        <defs>
          <linearGradient id="metallic-gradient" ref={gradientRef} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#e0e0e0" />
            <stop offset="50%" stopColor="#b0b0b0" />
            <stop offset="100%" stopColor="#f5f5f5" />
          </linearGradient>
        </defs>
        {/* Replace the path below with your logo's SVG path or embed the SVG */}
        <image href={src} x="0" y="0" width="200" height="200" style={{ mask: 'url(#metallic-gradient)' }} />
      </svg>
    );
  }
  // Fallback for small or non-animated logo
  return <img src={src} alt="PolyCopy logo" loading="lazy" style={{ width: size, height: size, display: 'block' }} />;
}
