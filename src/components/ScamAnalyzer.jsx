import React, { useState, useCallback } from 'react';
import { AlertTriangle, CheckCircle, XCircle, Search, Link, MessageSquare, RefreshCw } from 'lucide-react';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip } from 'recharts';

// ─── Scam Detection Engine ─────────────────────────────────────────────────────

const SCAM_KEYWORDS = [
  { word: 'kyc', weight: 25, category: 'Identity Fraud' },
  { word: 'aadhar', weight: 20, category: 'Identity Fraud' },
  { word: 'pan card', weight: 20, category: 'Identity Fraud' },
  { word: 'verify account', weight: 25, category: 'Phishing' },
  { word: 'update your', weight: 15, category: 'Phishing' },
  { word: 'urgent', weight: 15, category: 'Urgency Manipulation' },
  { word: 'immediately', weight: 15, category: 'Urgency Manipulation' },
  { word: 'block', weight: 10, category: 'Urgency Manipulation' },
  { word: 'suspended', weight: 20, category: 'Urgency Manipulation' },
  { word: 'otp', weight: 15, category: 'OTP Fraud' },
  { word: 'share otp', weight: 35, category: 'OTP Fraud' },
  { word: 'never share', weight: -5, category: 'Legitimate Warning' }, // Negative weight (legit)
  { word: 'winner', weight: 30, category: 'Lottery Scam' },
  { word: 'won', weight: 15, category: 'Lottery Scam' },
  { word: 'prize', weight: 25, category: 'Lottery Scam' },
  { word: 'lottery', weight: 30, category: 'Lottery Scam' },
  { word: 'claim', weight: 15, category: 'Lottery Scam' },
  { word: 'click here', weight: 20, category: 'Phishing Link' },
  { word: 'click now', weight: 20, category: 'Phishing Link' },
  { word: 'bit.ly', weight: 20, category: 'Suspicious URL' },
  { word: 'tinyurl', weight: 15, category: 'Suspicious URL' },
  { word: 'free', weight: 8, category: 'Too Good To Be True' },
  { word: 'cashback', weight: 5, category: 'Too Good To Be True' },
  { word: 'helpdesk', weight: 18, category: 'Tech Support Scam' },
  { word: 'customer care', weight: 10, category: 'Tech Support Scam' },
  { word: 'refund', weight: 12, category: 'Refund Scam' },
  { word: '1 lakh', weight: 20, category: 'Lottery Scam' },
  { word: 'congratulations', weight: 15, category: 'Lottery Scam' },
  { word: 'income tax', weight: 22, category: 'Tax Scam' },
  { word: 'arrest', weight: 30, category: 'Fear Scam' },
  { word: 'legal action', weight: 25, category: 'Fear Scam' },
  { word: 'ed raid', weight: 30, category: 'Fear Scam' },
  { word: 'cbi', weight: 25, category: 'Fear Scam' },
];

const SUSPICIOUS_TLDS = ['.xyz', '.tk', '.ml', '.ga', '.cf', '.gq', '.top', '.link', '.click', '.download'];
const PHISHING_PATTERNS = [
  /sbi(-|\.)?(bank|secure|login|verify|update)/i,
  /hdfc(-|\.)?(bank|secure|login|verify|update)/i,
  /icici(-|\.)?(bank|secure|login|verify|update)/i,
  /paytm(-|\.)?(?!\.com)(verify|secure|login|update)/i,
  /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/,  // IP-as-domain
  /paypal(-|\.)?(?!\.com)/i,
  /npci(-|\.)?(?!\.org)/i,
  /(secure|verify|login|update|account).*(bank|upi|pay)/i,
];

const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi;

function extractUrls(text) {
  return [...new Set(text.match(URL_REGEX) || [])];
}

function analyzeUrl(url) {
  const risks = [];
  let score = 0;
  try {
    const u = new URL(url);
    const hostname = u.hostname.toLowerCase();
    if (SUSPICIOUS_TLDS.some(tld => hostname.endsWith(tld))) {
      risks.push(`Suspicious TLD (${SUSPICIOUS_TLDS.find(t => hostname.endsWith(t))})`);
      score += 40;
    }
    if (/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(hostname)) {
      risks.push('IP address used instead of domain name');
      score += 50;
    }
    if (PHISHING_PATTERNS.some(p => p.test(hostname + u.pathname))) {
      risks.push('Domain mimics a known financial institution');
      score += 60;
    }
    if (hostname.split('.').length > 4) {
      risks.push('Unusually deep subdomain structure');
      score += 15;
    }
    if ((hostname.match(/-/g) || []).length > 2) {
      risks.push('Multiple hyphens in domain (common phishing pattern)');
      score += 20;
    }
  } catch {
    risks.push('Malformed URL');
    score += 10;
  }
  return { url, score: Math.min(100, score), risks, verdict: score >= 50 ? 'DANGEROUS' : score >= 20 ? 'SUSPICIOUS' : 'SAFE' };
}

function analyzeText(text) {
  const lower = text.toLowerCase();
  const triggered = [];
  let rawScore = 0;

  for (const { word, weight, category } of SCAM_KEYWORDS) {
    if (lower.includes(word)) {
      triggered.push({ word, weight, category });
      rawScore += weight;
    }
  }

  const urls = extractUrls(text);
  const urlResults = urls.map(analyzeUrl);
  const maxUrlScore = urlResults.reduce((m, u) => Math.max(m, u.score), 0);
  rawScore += maxUrlScore * 0.5;

  // Build radar data
  const categories = {};
  for (const t of triggered) {
    if (!categories[t.category]) categories[t.category] = 0;
    categories[t.category] += Math.max(0, t.weight);
  }

  const radarData = [
    { subject: 'Identity Fraud', A: Math.min(100, (categories['Identity Fraud'] || 0) * 2) },
    { subject: 'Urgency', A: Math.min(100, (categories['Urgency Manipulation'] || 0) * 3) },
    { subject: 'Phishing', A: Math.min(100, ((categories['Phishing'] || 0) + (categories['Phishing Link'] || 0)) * 2) },
    { subject: 'Lottery/Reward', A: Math.min(100, (categories['Lottery Scam'] || 0) * 2) },
    { subject: 'OTP Fraud', A: Math.min(100, (categories['OTP Fraud'] || 0) * 2) },
    { subject: 'Fear Tactics', A: Math.min(100, (categories['Fear Scam'] || 0) * 2) },
  ];

  const score = Math.min(100, Math.max(0, rawScore));
  const verdict = score >= 70 ? 'SCAM' : score >= 35 ? 'SUSPICIOUS' : 'SAFE';
  const topCategories = Object.entries(categories)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => k);

  return { score: Math.round(score), verdict, triggered, urlResults, radarData, topCategories };
}

// ─── Highlight dangerous words in text ────────────────────────────────────────
function HighlightedText({ text, triggered }) {
  if (!triggered.length) return <span style={{ fontFamily: 'monospace', fontSize: 13, color: '#374151', whiteSpace: 'pre-wrap' }}>{text}</span>;

  const words = triggered.map(t => t.word).sort((a, b) => b.length - a.length);
  const regex = new RegExp(`(${words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
  const parts = text.split(regex);

  return (
    <span style={{ fontFamily: 'monospace', fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap', color: '#374151' }}>
      {parts.map((part, i) => {
        const match = triggered.find(t => t.word === part.toLowerCase());
        if (match) {
          const color = match.weight >= 25 ? '#dc2626' : match.weight >= 15 ? '#ea580c' : '#d97706';
          return (
            <mark key={i} style={{ background: `${color}22`, color, fontWeight: 700, borderRadius: 3, padding: '0 2px', border: `1px solid ${color}44` }}>
              {part}
            </mark>
          );
        }
        return part;
      })}
    </span>
  );
}

// ─── URL Card ─────────────────────────────────────────────────────────────────
const UrlCard = ({ result }) => {
  const colors = { SAFE: '#16a34a', SUSPICIOUS: '#d97706', DANGEROUS: '#dc2626' };
  const bg = { SAFE: '#f0fdf4', SUSPICIOUS: '#fffbeb', DANGEROUS: '#fef2f2' };
  const c = colors[result.verdict];
  return (
    <div style={{ background: bg[result.verdict], border: `1px solid ${c}33`, borderRadius: 10, padding: '10px 14px', marginTop: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <Link size={14} color={c} />
        <span style={{ fontSize: 11, fontWeight: 700, color: c }}>{result.verdict}</span>
        <span style={{ fontSize: 11, color: '#64748b', marginLeft: 'auto' }}>Risk: {result.score}%</span>
      </div>
      <div style={{ fontSize: 11, color: '#374151', wordBreak: 'break-all', marginBottom: 4 }}>{result.url}</div>
      {result.risks.map((r, i) => (
        <div key={i} style={{ fontSize: 11, color: c, display: 'flex', alignItems: 'center', gap: 4 }}>
          <span>⚠</span> {r}
        </div>
      ))}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const ScamAnalyzer = () => {
  const [text, setText] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const DEMO_TEXTS = [
    {
      label: '🚨 KYC Scam SMS',
      text: 'Dear Customer, Your SBI account will be BLOCKED within 24 hours due to incomplete KYC verification. Click here immediately to verify: http://sbi-secure-kyc-update.xyz/verify?ref=12345. Failure to update will result in legal action. — SBI Customer Care',
    },
    {
      label: '🎰 Lottery Scam',
      text: 'CONGRATULATIONS! You have WON ₹25 Lakh in Jio Lucky Draw 2024. Your mobile number was selected from 5 crore participants. To CLAIM your prize, send ₹500 processing fee to our UPI: prizewin@ybl. Contact helpdesk: 9876543210. Offer valid 24 hrs only!',
    },
    {
      label: '😱 CBI Fear Scam',
      text: 'This is CBI Officer Sharma speaking. Your Aadhaar number has been misused in a money laundering case worth ₹2 crore. You will face arrest within 2 hours unless you pay ₹50,000 as security deposit to avoid ED raid. Call urgently: 011-XXXXXXXX',
    },
    {
      label: '✅ Legitimate Bank SMS',
      text: 'Your SBI account XX1234 is credited with Rs.5000 on 10-Mar-2024. Available balance: Rs.32,450. This is an automated message. Never share your OTP or PIN with anyone. For queries call 1800-11-2211.',
    },
  ];

  const analyze = useCallback(() => {
    if (!text.trim()) return;
    setLoading(true);
    setTimeout(() => {
      setResult(analyzeText(text));
      setLoading(false);
    }, 600);
  }, [text]);

  const verdictConfig = {
    SCAM:       { color: '#dc2626', bg: '#fef2f2', border: '#fca5a5', icon: <XCircle size={28} />,     label: '🚫 SCAM DETECTED' },
    SUSPICIOUS: { color: '#d97706', bg: '#fffbeb', border: '#fcd34d', icon: <AlertTriangle size={28} />, label: '⚠️ SUSPICIOUS' },
    SAFE:       { color: '#16a34a', bg: '#f0fdf4', border: '#86efac', icon: <CheckCircle size={28} />,  label: '✅ LIKELY SAFE' },
  };
  const vc = result ? verdictConfig[result.verdict] : null;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>

      {/* ── LEFT: Input Panel ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 16, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{ width: 36, height: 36, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MessageSquare size={18} color="white" />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 15, color: '#0f172a' }}>AI Scam Analyzer</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>Paste any SMS, email, or message to analyze</div>
            </div>
          </div>

          <textarea
            value={text}
            onChange={e => { setText(e.target.value); setResult(null); }}
            placeholder="Paste a suspicious SMS, WhatsApp message, or email here..."
            style={{
              width: '100%', minHeight: 160, padding: 14, borderRadius: 12,
              border: '2px solid #e2e8f0', fontSize: 13, fontFamily: 'monospace',
              resize: 'vertical', outline: 'none', color: '#374151',
              transition: 'border-color 0.2s', boxSizing: 'border-box',
              lineHeight: 1.6,
            }}
            onFocus={e => e.target.style.borderColor = '#6366f1'}
            onBlur={e => e.target.style.borderColor = '#e2e8f0'}
          />

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={analyze} disabled={!text.trim() || loading} style={{
              flex: 1, padding: '12px 0', borderRadius: 12, border: 'none', cursor: text.trim() ? 'pointer' : 'not-allowed',
              background: text.trim() ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : '#e2e8f0',
              color: text.trim() ? 'white' : '#94a3b8', fontWeight: 800, fontSize: 14,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
              {loading ? <><RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} /> Analyzing…</> : <><Search size={16} /> Analyze for Scam</>}
            </button>
            <button onClick={() => { setText(''); setResult(null); }} style={{
              padding: '12px 16px', borderRadius: 12, border: '1px solid #e2e8f0',
              background: 'white', cursor: 'pointer', color: '#64748b', fontWeight: 600, fontSize: 13,
            }}>Clear</button>
          </div>
        </div>

        {/* Demo texts */}
        <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 16, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 12 }}>
            Demo Scenarios — Click to Load
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {DEMO_TEXTS.map((d, i) => (
              <button key={i} onClick={() => { setText(d.text); setResult(null); }} style={{
                background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10,
                padding: '10px 14px', cursor: 'pointer', textAlign: 'left',
                fontSize: 13, fontWeight: 600, color: '#374151', transition: 'all 0.15s',
              }}
              onMouseOver={e => { e.currentTarget.style.background = '#eff6ff'; e.currentTarget.style.borderColor = '#93c5fd'; }}
              onMouseOut={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#e2e8f0'; }}>
                {d.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── RIGHT: Results Panel ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {!result ? (
          <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 16, padding: 40, textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', flex: 1 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#374151', marginBottom: 8 }}>Paste a message to analyze</div>
            <div style={{ fontSize: 13, color: '#94a3b8' }}>Our AI will detect scam keywords, suspicious URLs, urgency manipulation, and phishing patterns</div>
          </div>
        ) : (
          <>
            {/* Verdict Banner */}
            <div style={{ background: vc.bg, border: `2px solid ${vc.border}`, borderRadius: 16, padding: '20px 24px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
                <div style={{ color: vc.color }}>{vc.icon}</div>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: vc.color }}>{vc.label}</div>
                  <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
                    Risk Score: <strong style={{ color: vc.color }}>{result.score}%</strong>
                    {result.topCategories.length > 0 && ` · ${result.topCategories.slice(0, 2).join(', ')}`}
                  </div>
                </div>
                <div style={{ marginLeft: 'auto', textAlign: 'center' }}>
                  <div style={{
                    width: 60, height: 60, borderRadius: '50%',
                    background: `conic-gradient(${vc.color} ${result.score * 3.6}deg, #e2e8f0 0deg)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <div style={{ width: 44, height: 44, borderRadius: '50%', background: vc.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: vc.color }}>
                      {result.score}%
                    </div>
                  </div>
                </div>
              </div>

              {/* Triggered indicators */}
              {result.triggered.filter(t => t.weight > 0).length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                  {result.triggered.filter(t => t.weight > 0).map((t, i) => (
                    <span key={i} style={{
                      background: t.weight >= 25 ? '#fef2f2' : t.weight >= 15 ? '#fff7ed' : '#fefce8',
                      color: t.weight >= 25 ? '#dc2626' : t.weight >= 15 ? '#ea580c' : '#d97706',
                      border: `1px solid ${t.weight >= 25 ? '#fca5a5' : t.weight >= 15 ? '#fed7aa' : '#fde68a'}`,
                      borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700,
                    }}>{t.word} (+{t.weight})</span>
                  ))}
                </div>
              )}
            </div>

            {/* Highlighted message */}
            <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 16, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 12 }}>
                Message Analysis — Dangerous words highlighted
              </div>
              <div style={{ background: '#f8fafc', borderRadius: 10, padding: 14, border: '1px solid #f1f5f9', maxHeight: 160, overflowY: 'auto' }}>
                <HighlightedText text={text} triggered={result.triggered.filter(t => t.weight > 0)} />
              </div>
            </div>

            {/* Radar Chart */}
            <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 16, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Threat Radar</div>
              <ResponsiveContainer width="100%" height={180}>
                <RadarChart data={result.radarData}>
                  <PolarGrid stroke="#e2e8f0" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 10 }} />
                  <Radar dataKey="A" stroke={vc.color} fill={vc.color} fillOpacity={0.2} />
                  <Tooltip formatter={(v) => [`${v}%`, 'Risk']} />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            {/* URL Results */}
            {result.urlResults.length > 0 && (
              <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 16, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
                  URL Threat Analysis ({result.urlResults.length} link{result.urlResults.length > 1 ? 's' : ''} found)
                </div>
                {result.urlResults.map((u, i) => <UrlCard key={i} result={u} />)}
              </div>
            )}
          </>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default ScamAnalyzer;
