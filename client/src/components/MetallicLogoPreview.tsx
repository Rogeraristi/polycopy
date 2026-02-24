import React from 'react';
import MetallicLogo from './MetallicLogo';

export default function MetallicLogoPreview() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, padding: 32 }}>
      <h2 style={{ color: '#fff', fontWeight: 700, fontSize: 24 }}>Metallic Logo Preview</h2>
      <MetallicLogo size={128} />
      <p style={{ color: '#aaa', marginTop: 16 }}>This is your logo with the metallic paint effect. Edit <b>public/polycopy-logo.png</b> to update the image.</p>
    </div>
  );
}
