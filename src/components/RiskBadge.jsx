import React from 'react';

const RiskBadge = ({ score }) => {
  const pct = score * 100;
  const color = pct > 75 ? "#ef4444" : pct > 50 ? "#f97316" : pct > 25 ? "#eab308" : "#22c55e";
  const label = pct > 75 ? "CRITICAL" : pct > 50 ? "HIGH" : pct > 25 ? "MEDIUM" : "LOW";
  return (
    <span style={{ background: `${color}22`, color, border: `1px solid ${color}44`, borderRadius: 4, padding: "1px 7px", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em" }}>
      {label}
    </span>
  );
};

export default RiskBadge;
