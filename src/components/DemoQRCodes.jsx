/**
 * DemoQRCodes.jsx
 *
 * Displays real, scannable UPI QR codes for the hackathon demo.
 * Judges hold this page on a second device; presenter scans with the app camera.
 *
 * QR format: upi://pay?pa=<vpa>&pn=<name>&am=<amount>&cu=INR
 */
import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

const DEMO_QRS = [
  {
    id: 'amazon',
    name: 'Amazon India',
    vpa: 'amazon@amazonpay',
    category: '🛒 E-Commerce',
    amount: 499,
    expected: 'CLEARED',
    color: '#16a34a',
    bg: '#f0fdf4',
    border: '#bbf7d0',
    badge: '✅ SAFE',
    description: 'Verified merchant · 0 fraud reports · 3-year history',
  },
  {
    id: 'swiggy',
    name: 'Swiggy Food',
    vpa: 'swiggy@icici',
    category: '🍕 Food Delivery',
    amount: 249,
    expected: 'CLEARED',
    color: '#16a34a',
    bg: '#f0fdf4',
    border: '#bbf7d0',
    badge: '✅ SAFE',
    description: 'Registered business · Trust score: 94/100',
  },
  {
    id: 'friend',
    name: 'Rahul Kumar',
    vpa: 'rahul.kumar@oksbi',
    category: '👤 Personal Transfer',
    amount: 200,
    expected: 'CLEARED',
    color: '#2563eb',
    bg: '#eff6ff',
    border: '#bfdbfe',
    badge: '✅ SAFE',
    description: 'Personal UPI ID · SBI account · Low velocity',
  },
  {
    id: 'prize',
    name: 'Lucky Winner Prize',
    vpa: 'winner.prize@upi',
    category: '🎰 Lottery / Prize',
    amount: 5000,
    expected: 'BLOCKED',
    color: '#dc2626',
    bg: '#fef2f2',
    border: '#fca5a5',
    badge: '🚫 FRAUD',
    description: '312 fraud reports · Lottery scam pattern · ML: 97%',
  },
  {
    id: 'kyc',
    name: 'KYC Update Service',
    vpa: 'kyc.update@upi',
    category: '📋 Impersonation',
    amount: 1,
    expected: 'BLOCKED',
    color: '#dc2626',
    bg: '#fef2f2',
    border: '#fca5a5',
    badge: '🚫 FRAUD',
    description: '456 fraud reports · KYC impersonation · RBI warning',
  },
  {
    id: 'techsupport',
    name: 'Tech Support Helpdesk',
    vpa: 'helpdesk.tech@ybl',
    category: '🖥️ Support Scam',
    amount: 2000,
    expected: 'BLOCKED',
    color: '#dc2626',
    bg: '#fef2f2',
    border: '#fca5a5',
    badge: '🚫 FRAUD',
    description: '187 fraud reports in 7 days · Newly created VPA',
  },
];

const QRCard = ({ qr }) => {
  const upiUrl = `upi://pay?pa=${qr.vpa}&pn=${encodeURIComponent(qr.name)}&am=${qr.amount}&cu=INR`;
  const isBlocked = qr.expected === 'BLOCKED';
  const [copied, setCopied] = useState(false);

  const copyVPA = () => {
    navigator.clipboard.writeText(qr.vpa).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div style={{
      background: qr.bg,
      border: `2px solid ${qr.border}`,
      borderRadius: 20,
      padding: 24,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 14,
      boxShadow: `0 4px 20px ${isBlocked ? 'rgba(220,38,38,0.1)' : 'rgba(22,163,74,0.08)'}`,
      transition: 'transform 0.2s',
    }}
      onMouseOver={e => e.currentTarget.style.transform = 'scale(1.02)'}
      onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
    >
      {/* Expected badge */}
      <div style={{
        padding: '4px 16px', borderRadius: 99,
        background: qr.color, color: 'white',
        fontSize: 12, fontWeight: 800, letterSpacing: '0.04em'
      }}>
        {qr.badge} — {qr.expected}
      </div>

      {/* Real QR code */}
      <div style={{
        background: 'white', padding: 16, borderRadius: 16,
        border: `3px solid ${qr.color}`,
        boxShadow: `0 4px 16px ${qr.color}30`
      }}>
        <QRCodeSVG
          value={upiUrl}
          size={180}
          fgColor={qr.color}
          bgColor="white"
          level="M"
          includeMargin={false}
        />
      </div>

      {/* Merchant info */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: '#1e293b', marginBottom: 2 }}>
          {qr.name}
        </div>
        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>{qr.category}</div>
        <button onClick={copyVPA} style={{
          background: 'rgba(0,0,0,0.06)', border: 'none', borderRadius: 8,
          padding: '4px 12px', cursor: 'pointer', fontFamily: 'monospace',
          fontSize: 11, color: '#475569', fontWeight: 600
        }}>
          {copied ? '✅ Copied!' : qr.vpa}
        </button>
        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 8 }}>
          Amount: ₹{qr.amount.toLocaleString('en-IN')}
        </div>
      </div>

      {/* ML expectation */}
      <div style={{
        width: '100%', background: isBlocked ? '#fef2f2' : '#f0fdf4',
        borderRadius: 10, padding: '8px 12px',
        border: `1px solid ${isBlocked ? '#fca5a5' : '#bbf7d0'}`
      }}>
        <div style={{ fontSize: 11, color: qr.color, fontWeight: 700, textAlign: 'center' }}>
          {qr.description}
        </div>
      </div>
    </div>
  );
};

const DemoQRCodes = () => {
  const safe = DEMO_QRS.filter(q => q.expected === 'CLEARED');
  const fraud = DEMO_QRS.filter(q => q.expected === 'BLOCKED');

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
      padding: '40px 20px',
      fontFamily: "'Inter', -apple-system, sans-serif"
    }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 12,
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 99, padding: '8px 20px', marginBottom: 20
          }}>
            <span style={{ fontSize: 20 }}>🛡️</span>
            <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: 700, letterSpacing: '0.05em' }}>
              UPI FRAUD SHIELD — DEMO QR CODES
            </span>
          </div>
          <h1 style={{ color: 'white', fontSize: 36, fontWeight: 900, margin: '0 0 12px', letterSpacing: '-0.02em' }}>
            Scan These QR Codes to Test AI Detection
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 16, margin: 0, maxWidth: 600, marginInline: 'auto' }}>
            Open the User Portal on another device, tap "Scan QR", and point the camera at any code below.
            The AI will detect safe vs. fraudulent payments in real-time.
          </p>
        </div>

        {/* Instructions */}
        <div style={{
          background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)',
          borderRadius: 16, padding: '20px 28px', marginBottom: 48,
          display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap'
        }}>
          {['1️⃣  Open the UPI Fraud Shield app', '2️⃣  Tap "Scan QR" button', '3️⃣  Point camera at any QR code below', '4️⃣  Watch the AI detect fraud in real-time! ⚡'].map((s,i)=>(
            <div key={i} style={{color:'rgba(255,255,255,0.8)',fontSize:13,fontWeight:600}}>{s}</div>
          ))}
        </div>

        {/* Safe QR codes */}
        <h2 style={{ color: '#4ade80', fontSize: 22, fontWeight: 800, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ background: '#16a34a', borderRadius: '50%', width: 28, height: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>✓</span>
          SAFE Merchants — AI will CLEAR these
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20, marginBottom: 48 }}>
          {safe.map(q => <QRCard key={q.id} qr={q} />)}
        </div>

        {/* Fraud QR codes */}
        <h2 style={{ color: '#f87171', fontSize: 22, fontWeight: 800, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ background: '#dc2626', borderRadius: '50%', width: 28, height: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>✕</span>
          FRAUD Merchants — AI will BLOCK these
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
          {fraud.map(q => <QRCard key={q.id} qr={q} />)}
        </div>

        <div style={{ textAlign: 'center', marginTop: 48, color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>
          QR codes encode real UPI URL format (upi://pay) — compatible with all UPI apps
        </div>
      </div>
    </div>
  );
};

export default DemoQRCodes;
