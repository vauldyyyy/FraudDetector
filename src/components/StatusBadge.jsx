import React from 'react';

const StatusBadge = ({ status }) => {
  const map = {
    BLOCKED: { bg: "#ef444422", c: "#ef4444", b: "#ef444444" },
    FLAGGED: { bg: "#f9731622", c: "#f97316", b: "#f9731644" },
    CLEARED: { bg: "#22c55e22", c: "#22c55e", b: "#22c55e44" }
  };
  const s = map[status] || map.CLEARED;
  return (
    <span style={{ background: s.bg, color: s.c, border: `1px solid ${s.b}`, borderRadius: 4, padding: "1px 7px", fontSize: 11, fontWeight: 700 }}>
      {status}
    </span>
  );
};

export default StatusBadge;
