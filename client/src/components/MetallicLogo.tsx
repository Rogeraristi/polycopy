interface MetallicLogoProps {
  src?: string;
  size?: number;
  animated?: boolean;
}

export default function MetallicLogo({ src = '/P_logo.svg', size = 64, animated = false }: MetallicLogoProps) {
  if (!animated) {
    return <img src={src} alt="PolyCopy logo" loading="lazy" style={{ width: size, height: size, display: 'block' }} />;
  }

  return (
    <span
      className="relative block shrink-0"
      style={{ width: size, height: size }}
      aria-label="PolyCopy logo with metallic paint effect"
    >
      <img
        src={src}
        alt="PolyCopy logo"
        loading="lazy"
        className="block h-full w-full object-contain"
      />
      <span
        aria-hidden
        className="metallic-logo-overlay"
        style={{
          WebkitMaskImage: `url(${src})`,
          maskImage: `url(${src})`,
          WebkitMaskRepeat: 'no-repeat',
          maskRepeat: 'no-repeat',
          WebkitMaskPosition: 'center',
          maskPosition: 'center',
          WebkitMaskSize: 'contain',
          maskSize: 'contain'
        }}
      />
    </span>
  );
}
