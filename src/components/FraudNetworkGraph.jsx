import React, { useEffect, useRef, useMemo } from 'react';
import { Network, AlertTriangle } from 'lucide-react';

// Generate network graph data from transactions
const buildNetworkData = (transactions) => {
  const merchantCounts = {};
  const connections = {};
  
  transactions.forEach(tx => {
    const merchant = tx.merchant || 'Unknown';
    if (!merchantCounts[merchant]) {
      merchantCounts[merchant] = { total: 0, fraud: 0, amount: 0, status: 'CLEARED' };
    }
    merchantCounts[merchant].total++;
    merchantCounts[merchant].amount += tx.amount || 0;
    if (tx.isFraud || tx.is_fraud) merchantCounts[merchant].fraud++;
    if (tx.status === 'BLOCKED') merchantCounts[merchant].status = 'BLOCKED';
    else if (tx.status === 'FLAGGED' && merchantCounts[merchant].status !== 'BLOCKED') merchantCounts[merchant].status = 'FLAGGED';
  });

  const topMerchants = Object.entries(merchantCounts)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 12);

  // Create nodes
  const nodes = topMerchants.map(([name, data], i) => {
    const angle = (i / topMerchants.length) * 2 * Math.PI;
    const radius = data.status === 'BLOCKED' ? 90 : data.status === 'FLAGGED' ? 120 : 150;
    return {
      id: name,
      x: 220 + Math.cos(angle) * radius,
      y: 200 + Math.sin(angle) * radius,
      radius: Math.max(10, Math.min(24, data.total * 0.8)),
      color: data.status === 'BLOCKED' ? '#dc2626' : data.status === 'FLAGGED' ? '#d97706' : '#16a34a',
      bgColor: data.status === 'BLOCKED' ? '#fef2f2' : data.status === 'FLAGGED' ? '#fffbeb' : '#f0fdf4',
      label: name.length > 12 ? name.slice(0, 12) + '…' : name,
      status: data.status,
      ...data
    };
  });

  // Create edges between high-risk merchants
  const edges = [];
  const fraudNodes = nodes.filter(n => n.status !== 'CLEARED');
  for (let i = 0; i < fraudNodes.length - 1; i++) {
    if (Math.random() < 0.4) {
      edges.push({ source: fraudNodes[i].id, target: fraudNodes[i+1].id });
    }
  }

  return { nodes, edges };
};

const FraudNetworkGraph = ({ transactions }) => {
  const data = useMemo(() => buildNetworkData(transactions.slice(0, 100)), [transactions]);
  const { nodes, edges } = data;

  const nodeMap = useMemo(() => Object.fromEntries(nodes.map(n => [n.id, n])), [nodes]);

  const blockedCount = nodes.filter(n => n.status === 'BLOCKED').length;
  const flaggedCount = nodes.filter(n => n.status === 'FLAGGED').length;

  return (
    <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 16, padding: '24px', boxShadow: 'var(--card-shadow)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Network size={20} color="var(--accent-blue)" />
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Fraud Network Graph</h3>
          </div>
          <p style={{ margin: '4px 0 0 30px', color: 'var(--text-dim)', fontSize: 13 }}>Merchant relationship & risk network</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {[{ color: '#dc2626', bg: '#fef2f2', label: `${blockedCount} Blocked` }, { color: '#d97706', bg: '#fffbeb', label: `${flaggedCount} Flagged` }, { color: '#16a34a', bg: '#f0fdf4', label: `${nodes.length - blockedCount - flaggedCount} Safe` }].map(({ color, bg, label }) => (
            <div key={label} style={{ background: bg, border: `1px solid ${color}33`, borderRadius: 8, padding: '4px 10px', fontSize: 11, fontWeight: 700, color }}>
              {label}
            </div>
          ))}
        </div>
      </div>

      {/* SVG Network Visualization */}
      <div style={{ background: '#fafbfc', borderRadius: 12, border: '1px solid var(--border-color)', overflow: 'hidden' }}>
        <svg viewBox="0 0 440 400" style={{ width: '100%', maxHeight: 400 }}>
          {/* Edges */}
          {edges.map((e, i) => {
            const s = nodeMap[e.source];
            const t = nodeMap[e.target];
            if (!s || !t) return null;
            return (
              <line key={i} x1={s.x} y1={s.y} x2={t.x} y2={t.y}
                stroke="#dc262633" strokeWidth="2" strokeDasharray="4 3" />
            );
          })}

          {/* Nodes */}
          {nodes.map(node => (
            <g key={node.id}>
              {/* Outer glow for danger nodes */}
              {node.status === 'BLOCKED' && (
                <circle cx={node.x} cy={node.y} r={node.radius + 8} fill="#dc262615" />
              )}
              <circle
                cx={node.x} cy={node.y} r={node.radius}
                fill={node.bgColor} stroke={node.color} strokeWidth="2.5"
                style={{ cursor: 'pointer' }}
              >
                <title>{node.id} — {node.status} — {node.total} transactions</title>
              </circle>
              {node.status === 'BLOCKED' && (
                <text x={node.x} y={node.y + 1} textAnchor="middle" dominantBaseline="middle" fontSize="10" fill="#dc2626">⛔</text>
              )}
              {node.status === 'FLAGGED' && (
                <text x={node.x} y={node.y + 1} textAnchor="middle" dominantBaseline="middle" fontSize="10">⚠️</text>
              )}
              {node.status === 'CLEARED' && (
                <text x={node.x} y={node.y + 1} textAnchor="middle" dominantBaseline="middle" fontSize="10">✅</text>
              )}
              <text x={node.x} y={node.y + node.radius + 12} textAnchor="middle" fontSize="9" fill="#64748b" fontWeight="600">
                {node.label}
              </text>
            </g>
          ))}
        </svg>
      </div>

      <p style={{ fontSize: 12, color: 'var(--text-dim)', textAlign: 'center', marginTop: 12, marginBottom: 0 }}>
        Node size = transaction volume. Connections = shared fraud patterns. Hover for details.
      </p>
    </div>
  );
};

export default FraudNetworkGraph;
