import React from 'react';

const MetricCard = ({ label, value, sub, accent = "#f59e0b", icon, delta }) => (
  <div style={{ background: "var(--bg-primary)", border: "1px solid var(--border-color)", borderRadius: 12, padding: "18px 22px", position: "relative", overflow: "hidden", boxShadow: "var(--card-shadow)" }}>
    <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg,${accent},transparent)` }} />
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
      <div>
        <div style={{ color: "var(--text-dim)", fontSize: 12, fontWeight: 700, textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
        <div style={{ color: "var(--text-main)", fontSize: 28, fontWeight: 800, fontFamily: "'Courier New',monospace", letterSpacing: "-0.02em" }}>{value}</div>
        {sub && <div style={{ color: "var(--text-dim)", fontSize: 13, marginTop: 4 }}>{sub}</div>}
        {delta && <div style={{ color: delta > 0 ? "#dc2626" : "#16a34a", fontSize: 12, marginTop: 8, fontWeight: 700 }}>{delta > 0 ? "▲" : "▼"} {Math.abs(delta)}% vs last period</div>}
      </div>
      {icon && <div style={{ fontSize: 32, opacity: 0.8 }}>{icon}</div>}
    </div>
  </div>
);

export default MetricCard;
