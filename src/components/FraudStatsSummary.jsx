import React, { useState } from 'react';
import { Copy, Check, TrendingDown, ShieldCheck, Ban, Activity } from 'lucide-react';
import { copyToClipboard } from '../utils/export-utils';

const FraudStatsSummary = ({ dataset, blockedTxns, fraudTxns }) => {
  const [copied, setCopied] = useState(false);

  const totalAmount = dataset.reduce((s, t) => s + (t.amount || 0), 0);
  const savedAmount = blockedTxns.reduce((s, t) => s + (t.amount || 0), 0);
  const detectionRate = dataset.length > 0 ? ((fraudTxns.length / dataset.length) * 100).toFixed(1) : 0;
  const accuracy = "99.6"; // From our ensemble model

  const stats = [
    { icon: <Ban size={22} color="#dc2626" />, label: "Frauds Blocked", value: blockedTxns.length, bg: '#fef2f2', border: '#fca5a5' },
    { icon: <ShieldCheck size={22} color="#16a34a" />, label: "Money Saved", value: `₹${(savedAmount / 100000).toFixed(1)}L`, bg: '#f0fdf4', border: '#86efac' },
    { icon: <Activity size={22} color="#2563eb" />, label: "Detection Rate", value: `${detectionRate}%`, bg: '#eff6ff', border: '#bfdbfe' },
    { icon: <TrendingDown size={22} color="#d97706" />, label: "Model Accuracy", value: `${accuracy}%`, bg: '#fffbeb', border: '#fcd34d' },
  ];

  const summaryText = `📊 UPI Fraud Shield — Today's Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Frauds Blocked:    ${blockedTxns.length}
💰 Money Saved:       ₹${(savedAmount / 100000).toFixed(1)} Lakh
📈 Fraud Rate:        ${detectionRate}%
🎯 AI Accuracy:       ${accuracy}%
━━━━━━━━━━━━━━━━━━━━━━━━━━
Powered by UPI Fraud Shield AI Engine`;

  const handleCopy = () => {
    copyToClipboard(summaryText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{
      background: 'var(--bg-primary)',
      border: '1px solid var(--border-color)',
      borderRadius: '16px',
      padding: '24px',
      boxShadow: 'var(--card-shadow)',
      marginBottom: '24px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: 'var(--text-main)' }}>
            📊 Today's Fraud Summary
          </h3>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-dim)', fontWeight: 500 }}>
            Real-time snapshot · {dataset.length.toLocaleString()} transactions analyzed
          </p>
        </div>
        <button
          onClick={handleCopy}
          style={{
            background: copied ? '#f0fdf4' : '#f8fafc',
            border: `1px solid ${copied ? '#86efac' : 'var(--border-color)'}`,
            color: copied ? '#16a34a' : 'var(--text-dim)',
            padding: '8px 14px',
            borderRadius: '10px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.2s'
          }}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? 'Copied!' : 'Copy Summary'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
        {stats.map(({ icon, label, value, bg, border }) => (
          <div key={label} style={{
            background: bg,
            border: `1px solid ${border}`,
            borderRadius: '14px',
            padding: '20px 18px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}>
            {icon}
            <div style={{ fontSize: '26px', fontWeight: 900, color: 'var(--text-main)', lineHeight: 1, fontFamily: "'Courier New', monospace" }}>
              {value}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FraudStatsSummary;
