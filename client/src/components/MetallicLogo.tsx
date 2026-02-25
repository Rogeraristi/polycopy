interface MetallicLogoProps {
  src?: string;
  size?: number;
  animated?: boolean;
}

export default function MetallicLogo({ src = '/P_logo.svg', size = 64 }: MetallicLogoProps) {
  return <img src={src} alt="PolyCopy logo" loading="lazy" style={{ width: size, height: size, display: 'block' }} />;
}
