import React, { useState, useEffect } from 'react';
import { X, ShieldCheck, ShieldX, Scan, Zap, AlertTriangle, CheckCircle, RefreshCw, ArrowRight } from 'lucide-react';

// Two demo QR code definitions
const DEMO_QRS = [
  {
    id: 'safe',
    vpa: 'amazon-india@axisbank',
    name: 'Amazon India Pvt Ltd',
    category: 'E-Commerce',
    icon: '🛒',
    isSafe: true,
    trustScore: 97,
    reportCount: 0,
    message: 'This is a verified merchant with a clean 3-year transaction history. No fraud reports across 12,400+ transactions.',
    reasons: [
      '✅ Verified Business Account (GSTIN confirmed)',
      '✅ 0 fraud reports in last 180 days',
      '✅ Consistent transaction patterns',
      '✅ Registered with NPCI Merchant Directory',
    ]
  },
  {
    id: 'unsafe',
    vpa: 'tech-support-helpdesk@upi',
    name: 'Tech Support Helpdesk',
    category: 'Services',
    icon: '⚠️',
    isSafe: false,
    trustScore: 8,
    reportCount: 47,
    message: 'This VPA has been reported 47 times in the last 7 days for tech-support fraud. Our AI model has flagged this as a HIGH RISK merchant.',
    reasons: [
      '🚨 47 fraud reports in last 7 days',
      '🚨 Account created 3 days ago (no history)',
      '🚨 Matches known scam VPA pattern',
      '🚨 Velocity breach: 200+ transactions in 24h',
    ]
  }
];

// Animated SVG QR code pattern
const QRPattern = ({ id, isSafe, onClick }) => {
  const cells = [];
  // Deterministic "QR" pattern unique to safe/unsafe
  const seed = isSafe ? 0x5A3F : 0xC74B;
  for (let r = 0; r < 11; r++) {
    for (let c = 0; c < 11; c++) {
      // Corner finder patterns
      const inCorner = (r < 3 && c < 3) || (r < 3 && c > 7) || (r > 7 && c < 3);
      const inCornerInner = (r === 1 && c === 1) || (r === 1 && c === 9) || (r === 9 && c === 1);
      const filled = inCorner || inCornerInner || (((r * 11 + c + seed) % 3) === 0);
      cells.push({ r, c, filled });
    }
  }

  return (
    <div
      onClick={onClick}
      style={{
        background: 'white',
        padding: 12,
        borderRadius: 12,
        border: `3px solid ${isSafe ? '#22c55e' : '#ef4444'}`,
        cursor: 'pointer',
        transition: 'transform 0.2s, box-shadow 0.2s',
        boxShadow: `0 4px 16px ${isSafe ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
      }}
      onMouseOver={e => e.currentTarget.style.transform = 'scale(1.05)'}
      onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
    >
      <svg viewBox="0 0 66 66" width={80} height={80}>
        {cells.map(({ r, c, filled }) => filled && (
          <rect key={`${r}-${c}`} x={c * 6} y={r * 6} width={5.5} height={5.5} rx={0.5} fill={isSafe ? '#15803d' : '#b91c1c'} />
        ))}
      </svg>
      <div style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: isSafe ? '#15803d' : '#b91c1c', marginTop: 4 }}>
        {isSafe ? '✅ SAFE' : '❌ UNSAFE'}
      </div>
    </div>
  );
};

const QRScannerModal = ({ isOpen, onClose, onProceed }) => {
  const [scanning, setScan] = useState(true); // true = showing scanner, false = showing result
  const [scanLine, setScanLine] = useState(0);
  const [result, setResult] = useState(null);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (!isOpen) { setScan(true); setResult(null); return; }
    const interval = setInterval(() => {
      setScanLine(p => (p + 2) % 100);
    }, 16);
    return () => clearInterval(interval);
  }, [isOpen, scanning]);

  if (!isOpen) return null;

  const handleScan = (qr) => {
    setIsAnimating(true);
    setTimeout(() => {
      setResult(qr);
      setScan(false);
      setIsAnimating(false);
    }, 900);
  };

  const handleProceed = () => {
    if (result?.isSafe) {
      onProceed({ merchant: result.vpa, amount: 499, category: result.category, recipientName: result.name });
      onClose();
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 4000,
      background: 'rgba(0,0,0,0.92)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
    }}>
      {/* Close */}
      <button onClick={onClose} style={{ position: 'absolute', top: 20, right: 20, background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: '50%', width: 40, height: 40, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
        <X size={20} />
      </button>

      {scanning ? (
        <>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginBottom: 24, fontWeight: 500, letterSpacing: '0.03em' }}>SCAN A QR CODE TO PAY</p>

          {/* Viewfinder */}
          <div style={{ position: 'relative', width: 240, height: 240, marginBottom: 32 }}>
            {/* Corners */}
            {[{t:0,l:0},{t:0,r:0},{b:0,l:0},{b:0,r:0}].map((pos, i) => (
              <div key={i} style={{ position: 'absolute', width: 28, height: 28, ...pos,
                borderTop: (pos.t !== undefined) ? '3px solid #3b82f6' : 'none',
                borderBottom: (pos.b !== undefined) ? '3px solid #3b82f6' : 'none',
                borderLeft: (pos.l !== undefined) ? '3px solid #3b82f6' : 'none',
                borderRight: (pos.r !== undefined) ? '3px solid #3b82f6' : 'none',
              }} />
            ))}
            {/* Scanning line */}
            <div style={{ position: 'absolute', top: `${scanLine}%`, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, transparent, #3b82f6, transparent)', opacity: 0.85 }} />
            {/* Center crosshair */}
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Scan size={48} color="rgba(59,130,246,0.4)" />
            </div>
          </div>

          {isAnimating && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#60a5fa', marginBottom: 24 }}>
              <RefreshCw size={16} style={{ animation: 'spin 0.6s linear infinite' }} />
              <span style={{ fontSize: 14, fontWeight: 600 }}>Analyzing QR code…</span>
            </div>
          )}

          {/* Demo QR codes to scan */}
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Demo — Click a QR code to scan</p>
            <div style={{ display: 'flex', gap: 24, justifyContent: 'center' }}>
              {DEMO_QRS.map(qr => (
                <div key={qr.id} style={{ textAlign: 'center' }}>
                  <QRPattern id={qr.id} isSafe={qr.isSafe} onClick={() => !isAnimating && handleScan(qr)} />
                  <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, marginTop: 8, fontWeight: 500, maxWidth: 90 }}>{qr.name}</div>
                </div>
              ))}
            </div>
          </div>

          <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11, marginTop: 8 }}>All QR codes are analyzed by AI Fraud Shield before payment</p>
          <style>{`@keyframes spin { from{ transform:rotate(0deg) } to{ transform:rotate(360deg) } }`}</style>
        </>
      ) : result && (
        // Result screen
        <div style={{
          background: 'white', borderRadius: 28, padding: 32, maxWidth: 360, width: '90%',
          textAlign: 'center', animation: 'slideUp 0.3s ease-out'
        }}>
          {/* Risk icon */}
          <div style={{
            width: 80, height: 80, borderRadius: '50%', margin: '0 auto 20px',
            background: result.isSafe ? '#f0fdf4' : '#fef2f2',
            border: `3px solid ${result.isSafe ? '#22c55e' : '#ef4444'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36
          }}>
            {result.isSafe ? '✅' : '🚨'}
          </div>

          <h3 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 900, color: result.isSafe ? '#15803d' : '#b91c1c' }}>
            {result.isSafe ? 'Merchant Verified Safe' : 'High Risk Detected'}
          </h3>
          <p style={{ margin: '0 0 20px', fontSize: 13, color: '#64748b' }}>{result.vpa}</p>

          {/* Merchant card */}
          <div style={{ background: '#f8fafc', borderRadius: 14, padding: '14px 16px', marginBottom: 20, textAlign: 'left', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#1e293b' }}>{result.icon} {result.name}</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>{result.category}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>Trust Score</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: result.isSafe ? '#16a34a' : '#dc2626' }}>{result.trustScore}</div>
              </div>
            </div>
            {!result.isSafe && (
              <div style={{ background: '#fef2f2', borderRadius: 8, padding: '8px 12px', border: '1px solid #fca5a5' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', marginBottom: 4 }}>⚠️ {result.reportCount} FRAUD REPORTS</div>
              </div>
            )}
          </div>

          {/* Reason pills */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24, textAlign: 'left' }}>
            {result.reasons.map((r, i) => (
              <div key={i} style={{ fontSize: 12, color: '#475569', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px', fontWeight: 500 }}>{r}</div>
            ))}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => { setScan(true); setResult(null); }} style={{ flex: 1, padding: '12px', borderRadius: 12, border: '1px solid #e2e8f0', background: 'white', color: '#64748b', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
              ← Back
            </button>
            {result.isSafe ? (
              <button onClick={handleProceed} style={{ flex: 2, padding: '12px', borderRadius: 12, border: 'none', background: '#16a34a', color: 'white', cursor: 'pointer', fontWeight: 800, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                Proceed to Pay <ArrowRight size={16} />
              </button>
            ) : (
              <button onClick={onClose} style={{ flex: 2, padding: '12px', borderRadius: 12, border: 'none', background: '#dc2626', color: 'white', cursor: 'pointer', fontWeight: 800, fontSize: 14 }}>
                🚫 Block & Report
              </button>
            )}
          </div>
        </div>
      )}
      <style>{`@keyframes slideUp { from{ opacity:0; transform:translateY(30px) } to{ opacity:1; transform:translateY(0) } }`}</style>
    </div>
  );
};

export default QRScannerModal;
