import React from 'react';
import MetallicLogo from './MetallicLogo';

export default function MetallicLogoPreview() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, padding: 32 }}>
      <h2 style={{ color: '#fff', fontWeight: 700, fontSize: 24 }}>Logo Preview</h2>
      <MetallicLogo size={128} />
      <p style={{ color: '#aaa', marginTop: 16 }}>This is your plain SVG logo.</p>
    </div>
  );
}
