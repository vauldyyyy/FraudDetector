import React from 'react';

const CustomTooltip = ({ active, payload, label, prefix = "" }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#0d1117", border: "1px solid #1e2936", borderRadius: 8, padding: "10px 14px", fontSize: 12 }}>
      <p style={{ color: "#94a3b8", marginBottom: 6 }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color || "#f1f5f9", margin: "2px 0", fontWeight: 600 }}>
          {p.name}: {prefix}{typeof p.value === "number" && p.value < 10 ? p.value.toFixed(3) : p.value?.toLocaleString()}
        </p>
      ))}
    </div>
  );
};

export default CustomTooltip;
