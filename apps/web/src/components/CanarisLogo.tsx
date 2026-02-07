// Nesecure Logo Component
// Reusable across sidebar and login page

import nesecureLogo from '../assets/nesecure-logo.jpeg';

interface CanarisLogoProps {
  size?: 'sm' | 'md' | 'lg';
  collapsed?: boolean;
}

const sizeMap = {
  sm: { height: 28, maxWidth: 120 },
  md: { height: 36, maxWidth: 160 },
  lg: { height: 48, maxWidth: 220 },
};

export default function CanarisLogo({ size = 'md', collapsed = false }: CanarisLogoProps) {
  const dims = sizeMap[size];

  if (collapsed) {
    return (
      <div style={{
        width: 36,
        height: 36,
        borderRadius: 8,
        background: 'linear-gradient(135deg, #1e88e5, #1565c0)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        fontWeight: 800,
        fontSize: 18,
        fontFamily: "'Inter', sans-serif",
        letterSpacing: '-1px',
      }}>
        N
      </div>
    );
  }

  return (
    <img
      src={nesecureLogo}
      alt="Nesecure"
      style={{
        height: dims.height,
        maxWidth: dims.maxWidth,
        objectFit: 'contain',
      }}
    />
  );
}
