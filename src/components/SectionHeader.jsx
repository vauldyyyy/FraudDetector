import React from 'react';

const SectionHeader = ({ title, subtitle, accent = "var(--accent-blue)", lightMode }) => (
  <div style={{ marginBottom: 18 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ width: 4, height: 16, background: accent, borderRadius: 2 }} />
      <h3 style={{ color: "var(--text-main)", fontSize: 13, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", margin: 0 }}>{title}</h3>
    </div>
    {subtitle && <p style={{ color: "var(--text-dim)", fontSize: 13, margin: "4px 0 0 14px", fontWeight: 500 }}>{subtitle}</p>}
  </div>
);

export default SectionHeader;
