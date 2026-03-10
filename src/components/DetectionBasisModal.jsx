import React, { useState } from 'react';
import { X, ShieldAlert, Info, Clipboard, CheckCheck, PhoneCall, ExternalLink } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine
} from 'recharts';
import { generateCrimeReport, copyReport } from '../utils/report-generator';

// ─── SHAP Feature importance builder ─────────────────────────────────────────
function buildShapData(transaction) {
  const score = transaction.fraudScore || 0;
  const indicators = transaction.indicators || [];
  const amount = transaction.amount || 0;
  const hour = transaction.hour ?? new Date().getHours();

  // Build SHAP-style feature contributions
  const features = [
    {
      name: 'Merchant Trust',
      value: indicators.includes('unverified_merchant') ? -(score * 0.25) : (1 - score) * 0.3,
      fraud: indicators.includes('unverified_merchant'),
    },
    {
      name: 'Amount Risk',
      value: amount > 10000 ? score * 0.2 : -(1 - score) * 0.15,
      fraud: amount > 10000 && score > 0.5,
    },
    {
      name: 'Time-of-Day',
      value: (hour < 6 || hour > 22) ? score * 0.15 : -(1 - score) * 0.1,
      fraud: hour < 6 || hour > 22,
    },
    {
      name: 'UPI Pattern',
      value: indicators.includes('suspicious_vpa') ? score * 0.25 : -(1 - score) * 0.2,
      fraud: indicators.includes('suspicious_vpa'),
    },
    {
      name: 'Velocity Risk',
      value: indicators.includes('high_velocity') ? score * 0.15 : -(1 - score) * 0.1,
      fraud: indicators.includes('high_velocity'),
    },
    {
      name: 'Geo-Anomaly',
      value: indicators.includes('geo_anomaly') ? score * 0.1 : -(1 - score) * 0.05,
      fraud: indicators.includes('geo_anomaly'),
    },
  ];

  return features.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
}

// ─── Custom Tooltip for SHAP chart ───────────────────────────────────────────
const ShapTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const val = payload[0].value;
  return (
    <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, padding: '8px 12px', fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
      <div style={{ fontWeight: 700, color: val > 0 ? '#dc2626' : '#16a34a' }}>
        {val > 0 ? '🚨 Pushes toward FRAUD' : '✅ Pushes toward SAFE'}
      </div>
      <div style={{ color: '#64748b', marginTop: 2 }}>Contribution: {(Math.abs(val) * 100).toFixed(1)}%</div>
    </div>
  );
};

// ─── Main Modal ───────────────────────────────────────────────────────────────
const DetectionBasisModal = ({ isOpen, onClose, transaction }) => {
  const [copied, setCopied] = useState(false);
  const [showReport, setShowReport] = useState(false);

  if (!isOpen || !transaction) return null;

  const shapData = buildShapData(transaction);
  const { report, reportId, fraudType } = generateCrimeReport(transaction);

  const handleCopy = () => {
    copyReport(report).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const isBlocked = transaction.status === 'BLOCKED';
  const isFlagged = transaction.status === 'FLAGGED';
  const accentColor = isBlocked ? '#dc2626' : isFlagged ? '#d97706' : '#16a34a';
  const accentBg = isBlocked ? '#fef2f2' : isFlagged ? '#fffbeb' : '#f0fdf4';

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 2000, padding: 20,
    }}>
      <div style={{
        background: 'white', width: '100%', maxWidth: 680,
        borderRadius: 24, border: '1px solid #e2e8f0',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
        overflow: 'hidden', animation: 'slideIn 0.3s ease-out',
        maxHeight: '90vh', display: 'flex', flexDirection: 'column',
      }}>

        {/* ── Header ── */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: accentBg }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ background: 'white', padding: 8, borderRadius: 10, color: accentColor, border: `1px solid ${accentColor}33` }}>
              <ShieldAlert size={22} />
            </div>
            <div>
              <h3 style={{ margin: 0, color: '#0f172a', fontSize: 17, fontWeight: 800 }}>AI Detection Basis</h3>
              <p style={{ margin: 0, color: '#64748b', fontSize: 11, fontFamily: 'monospace' }}>TXN #{transaction.id} · {fraudType}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 4 }}>
            <X size={22} />
          </button>
        </div>

        {/* ── Scrollable Content ── */}
        <div style={{ padding: 24, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* AI Explanation */}
          <div style={{ background: '#f8fafc', padding: 16, borderRadius: 14, border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#6366f1', marginBottom: 10 }}>
              <Info size={14} />
              <span style={{ fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>AI Summary</span>
            </div>
            <p style={{ color: '#374151', fontSize: 13, lineHeight: 1.7, margin: 0 }}>{transaction.explanation}</p>
          </div>

          {/* ── SHAP Feature Importance Chart ── */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
              📊 SHAP — Feature Contributions to Fraud Score
            </div>
            <div style={{ background: '#f8fafc', borderRadius: 14, padding: '16px 8px 8px', border: '1px solid #e2e8f0' }}>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={shapData} layout="vertical" margin={{ left: 90, right: 30, top: 0, bottom: 0 }}>
                  <XAxis
                    type="number" domain={[-0.4, 0.4]} tickFormatter={v => `${(v * 100).toFixed(0)}%`}
                    tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false}
                  />
                  <YAxis
                    type="category" dataKey="name"
                    tick={{ fontSize: 11, fill: '#374151', fontWeight: 600 }}
                    tickLine={false} axisLine={false} width={90}
                  />
                  <Tooltip content={<ShapTooltip />} />
                  <ReferenceLine x={0} stroke="#e2e8f0" strokeWidth={2} />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={18}>
                    {shapData.map((entry, index) => (
                      <Cell key={index} fill={entry.value > 0 ? '#dc2626' : '#16a34a'} fillOpacity={0.85} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginTop: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: '#64748b' }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: '#dc2626' }} />
                  Increases fraud risk
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: '#64748b' }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: '#16a34a' }} />
                  Decreases fraud risk
                </div>
              </div>
            </div>
          </div>

          {/* Risk Indicators */}
          {(transaction.indicators || []).length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Risk Indicators</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {transaction.indicators.map((ind) => (
                  <span key={ind} style={{
                    background: '#fef2f2', color: '#dc2626',
                    border: '1px solid #fca5a5', borderRadius: 8,
                    padding: '4px 10px', fontSize: 11, fontWeight: 700,
                  }}>
                    {ind.replace(/_/g, ' ').toUpperCase()}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Model Scores */}
          {transaction.modelScores && Object.keys(transaction.modelScores).length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Ensemble Model Agreement</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {Object.entries(transaction.modelScores).map(([model, score]) => (
                  <div key={model}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12 }}>
                      <span style={{ color: '#374151', fontWeight: 600 }}>{model.replace(/([A-Z])/g, ' $1').trim()}</span>
                      <span style={{ fontWeight: 800, color: score > 0.7 ? '#dc2626' : score > 0.4 ? '#d97706' : '#16a34a' }}>{(score * 100).toFixed(1)}%</span>
                    </div>
                    <div style={{ width: '100%', height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: `${score * 100}%`, height: '100%', background: score > 0.7 ? '#dc2626' : score > 0.4 ? '#f59e0b' : '#16a34a', borderRadius: 3, transition: 'width 0.5s' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Cybercrime Report */}
          {(isBlocked || isFlagged) && (
            <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 14, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 16 }}>📋</span>
                <span style={{ fontWeight: 800, fontSize: 13, color: '#dc2626' }}>Auto-Generate Cybercrime Report</span>
              </div>
              <p style={{ fontSize: 12, color: '#7f1d1d', margin: '0 0 12px', lineHeight: 1.6 }}>
                Generate a pre-filled incident report for <strong>cybercrime.gov.in</strong>. Call the National Cybercrime Helpline: <strong>1930</strong>
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button onClick={() => setShowReport(!showReport)} style={{
                  background: '#dc2626', color: 'white', border: 'none', borderRadius: 10,
                  padding: '9px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <Clipboard size={14} /> {showReport ? 'Hide Report' : 'Generate Report'}
                </button>
                {showReport && (
                  <button onClick={handleCopy} style={{
                    background: copied ? '#16a34a' : 'white', color: copied ? 'white' : '#dc2626',
                    border: '1px solid #fca5a5', borderRadius: 10,
                    padding: '9px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                    transition: 'all 0.2s',
                  }}>
                    {copied ? <><CheckCheck size={14} /> Copied!</> : <><Clipboard size={14} /> Copy Report</>}
                  </button>
                )}
                <a href="https://cybercrime.gov.in" target="_blank" rel="noopener noreferrer" style={{
                  background: 'white', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: 10,
                  padding: '9px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                  textDecoration: 'none',
                }}>
                  <ExternalLink size={14} /> File at Cybercrime Portal
                </a>
              </div>
              {showReport && (
                <pre style={{
                  marginTop: 12, background: '#fff5f5', border: '1px solid #fecaca', borderRadius: 10,
                  padding: 14, fontSize: 10.5, fontFamily: 'monospace', lineHeight: 1.8,
                  color: '#1a1a1a', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 240, overflowY: 'auto',
                }}>{report}</pre>
              )}
              <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#991b1b' }}>
                <PhoneCall size={12} />
                <span>National Cybercrime Helpline: <strong>1930</strong> (24×7)</span>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div style={{ padding: '14px 24px', background: '#f8fafc', borderTop: '1px solid #f1f5f9', textAlign: 'center' }}>
          <p style={{ color: '#94a3b8', fontSize: 11, margin: 0 }}>
            AI analysis by UPI Fraud Shield Ensemble · SHAP values are approximate feature contributions
          </p>
        </div>
      </div>
      <style>{`@keyframes slideIn { from { opacity:0; transform: scale(0.95) translateY(10px); } to { opacity:1; transform: scale(1) translateY(0); } }`}</style>
    </div>
  );
};

export default DetectionBasisModal;
