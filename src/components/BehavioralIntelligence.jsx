import React, { useState, useEffect, useRef } from 'react';
import { Monitor, Cpu, Wifi, MapPin, Shield, AlertTriangle, Clock, Activity, Zap } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, Tooltip, AreaChart, Area, XAxis } from 'recharts';

// ─── Device Fingerprint ───────────────────────────────────────────────────────
function getDeviceFingerprint() {
  const nav = navigator;
  const screen = window.screen;
  return {
    browser: nav.userAgent.includes('Chrome') ? 'Chrome' : nav.userAgent.includes('Firefox') ? 'Firefox' : nav.userAgent.includes('Safari') ? 'Safari' : 'Other',
    os: nav.platform || 'Unknown',
    screenRes: `${screen.width}×${screen.height}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    language: nav.language || 'Unknown',
    cores: nav.hardwareConcurrency || '?',
    memory: navigator.deviceMemory ? `${navigator.deviceMemory} GB` : 'Unknown',
    cookiesEnabled: nav.cookieEnabled,
    touchSupport: navigator.maxTouchPoints > 0,
    fingerprint: btoa(nav.userAgent + screen.width + screen.colorDepth + nav.language).slice(0, 12),
  };
}

function computeSessionRisk(events, txCount) {
  let score = 0;
  const now = Date.now();

  // Too many transactions in short period
  const recentTx = txCount;
  if (recentTx >= 3) score += 40;
  else if (recentTx >= 2) score += 20;

  // Rapid tab switching (high focus events)
  const focusBlurRatio = events.filter(e => e.type === 'blur').length;
  if (focusBlurRatio > 5) score += 15;

  // Time of day risk
  const hour = new Date().getHours();
  if (hour >= 0 && hour < 5) score += 20; // 12am-5am = high risk
  else if (hour >= 22) score += 10;        // After 10pm

  return Math.min(100, score);
}

// ─── Real-time velocity chart ─────────────────────────────────────────────────
function VelocityChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={80}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="velGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="t" hide />
        <Tooltip formatter={(v) => [v, 'Events/min']} labelFormatter={() => ''} />
        <Area type="monotone" dataKey="v" stroke="#6366f1" fill="url(#velGrad)" strokeWidth={2} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ─── Gauge Component ──────────────────────────────────────────────────────────
function RiskGauge({ score }) {
  const angle = -135 + (score / 100) * 270;
  const color = score >= 70 ? '#dc2626' : score >= 40 ? '#f59e0b' : '#10b981';
  const label = score >= 70 ? 'HIGH RISK' : score >= 40 ? 'ELEVATED' : 'NORMAL';

  return (
    <div style={{ position: 'relative', width: 160, height: 110, margin: '0 auto' }}>
      <svg viewBox="0 0 160 110" width="160" height="110">
        {/* Track */}
        <path d="M 20 100 A 70 70 0 1 1 140 100" fill="none" stroke="#e2e8f0" strokeWidth="14" strokeLinecap="round" />
        {/* Green zone */}
        <path d="M 20 100 A 70 70 0 0 1 80 30" fill="none" stroke="#dcfce7" strokeWidth="14" strokeLinecap="round" opacity="0.6" />
        {/* Yellow zone */}
        <path d="M 80 30 A 70 70 0 0 1 130 65" fill="none" stroke="#fef9c3" strokeWidth="14" strokeLinecap="round" opacity="0.6" />
        {/* Red zone */}
        <path d="M 130 65 A 70 70 0 0 1 140 100" fill="none" stroke="#fee2e2" strokeWidth="14" strokeLinecap="round" opacity="0.6" />
        {/* Needle */}
        <g transform={`rotate(${angle}, 80, 100)`}>
          <line x1="80" y1="100" x2="80" y2="38" stroke={color} strokeWidth="3" strokeLinecap="round" />
          <circle cx="80" cy="100" r="6" fill={color} />
        </g>
        {/* Center dot */}
        <circle cx="80" cy="100" r="4" fill="white" />
      </svg>
      <div style={{ textAlign: 'center', marginTop: -12 }}>
        <div style={{ fontSize: 26, fontWeight: 900, color, lineHeight: 1 }}>{score}</div>
        <div style={{ fontSize: 10, fontWeight: 700, color, letterSpacing: '0.06em' }}>{label}</div>
      </div>
    </div>
  );
}

// ─── InfoRow ──────────────────────────────────────────────────────────────────
const InfoRow = ({ icon, label, value, highlight }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#64748b', fontSize: 12 }}>
      {icon}
      <span>{label}</span>
    </div>
    <span style={{ fontSize: 12, fontWeight: 700, color: highlight || '#0f172a', fontFamily: 'monospace' }}>{value}</span>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────
const BehavioralIntelligence = ({ transactions = [] }) => {
  const device = getDeviceFingerprint();
  const [events, setEvents] = useState([]);
  const [velocityData, setVelocityData] = useState(
    Array.from({ length: 20 }, (_, i) => ({ t: i, v: 0 }))
  );
  const [sessionDuration, setSessionDuration] = useState(0);
  const startTime = useRef(Date.now());
  const txCount = transactions.filter(t => t.isLive).length;

  // Track user events
  useEffect(() => {
    const handlers = {
      click: () => setEvents(e => [...e, { type: 'click', time: Date.now() }].slice(-100)),
      blur: () => setEvents(e => [...e, { type: 'blur', time: Date.now() }].slice(-100)),
      focus: () => setEvents(e => [...e, { type: 'focus', time: Date.now() }].slice(-100)),
    };
    Object.entries(handlers).forEach(([ev, fn]) => window.addEventListener(ev, fn));
    return () => Object.entries(handlers).forEach(([ev, fn]) => window.removeEventListener(ev, fn));
  }, []);

  // Session timer
  useEffect(() => {
    const id = setInterval(() => {
      setSessionDuration(Math.floor((Date.now() - startTime.current) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // Velocity chart updater
  useEffect(() => {
    const id = setInterval(() => {
      const recentClicks = events.filter(e => e.type === 'click' && Date.now() - e.time < 60000).length;
      setVelocityData(prev => [...prev.slice(1), { t: Date.now(), v: recentClicks }]);
    }, 3000);
    return () => clearInterval(id);
  }, [events]);

  const sessionRisk = computeSessionRisk(events, txCount);
  const riskColor = sessionRisk >= 70 ? '#dc2626' : sessionRisk >= 40 ? '#f59e0b' : '#10b981';

  const formatDuration = (s) => {
    const m = Math.floor(s / 60);
    return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
  };

  const recentAlerts = [];
  if (txCount >= 3) recentAlerts.push({ msg: `${txCount} payments initiated — elevated velocity`, level: 'error' });
  if (events.filter(e => e.type === 'blur').length > 5) recentAlerts.push({ msg: 'High tab-switch activity detected', level: 'warning' });
  if (new Date().getHours() < 5 || new Date().getHours() >= 22) recentAlerts.push({ msg: 'Unusual transaction time (off-hours)', level: 'warning' });

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>

      {/* ── Session Risk Score ── */}
      <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 16, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Shield size={18} color="#6366f1" />
          <span style={{ fontWeight: 800, fontSize: 14, color: '#0f172a' }}>Session Risk Score</span>
        </div>
        <RiskGauge score={sessionRisk} />
        <div style={{ marginTop: 16 }}>
          {recentAlerts.length === 0 ? (
            <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#16a34a', fontWeight: 600, textAlign: 'center' }}>
              ✅ Session looks normal
            </div>
          ) : (
            recentAlerts.map((a, i) => (
              <div key={i} style={{
                background: a.level === 'error' ? '#fef2f2' : '#fffbeb',
                border: `1px solid ${a.level === 'error' ? '#fca5a5' : '#fde68a'}`,
                borderRadius: 10, padding: '8px 12px', marginBottom: 6,
                fontSize: 11, color: a.level === 'error' ? '#dc2626' : '#d97706', fontWeight: 600,
              }}>
                {a.level === 'error' ? '🚨' : '⚠️'} {a.msg}
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Device Fingerprint ── */}
      <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 16, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Monitor size={18} color="#6366f1" />
          <span style={{ fontWeight: 800, fontSize: 14, color: '#0f172a' }}>Device Intelligence</span>
        </div>
        <InfoRow icon={<Cpu size={13} />} label="Browser" value={device.browser} />
        <InfoRow icon={<Monitor size={13} />} label="Resolution" value={device.screenRes} />
        <InfoRow icon={<MapPin size={13} />} label="Timezone" value={device.timezone} />
        <InfoRow icon={<Wifi size={13} />} label="Language" value={device.language} />
        <InfoRow icon={<Cpu size={13} />} label="CPU Cores" value={device.cores} />
        <InfoRow icon={<Activity size={13} />} label="Memory" value={device.memory} />
        <InfoRow icon={<Zap size={13} />} label="Touch Input" value={device.touchSupport ? 'Yes (mobile)' : 'No'} />
        <div style={{ marginTop: 12, background: '#f8fafc', borderRadius: 10, padding: '10px 14px' }}>
          <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, marginBottom: 4 }}>DEVICE FINGERPRINT ID</div>
          <div style={{ fontSize: 13, fontWeight: 800, fontFamily: 'monospace', color: '#6366f1', letterSpacing: '0.08em' }}>
            {device.fingerprint}…
          </div>
        </div>
      </div>

      {/* ── Activity Monitor ── */}
      <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 16, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Activity size={18} color="#6366f1" />
          <span style={{ fontWeight: 800, fontSize: 14, color: '#0f172a' }}>Session Activity</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          {[
            { label: 'Session Time', value: formatDuration(sessionDuration), icon: <Clock size={14} /> },
            { label: 'Clicks', value: events.filter(e => e.type === 'click').length, icon: <Zap size={14} /> },
            { label: 'Tab Switches', value: events.filter(e => e.type === 'blur').length, icon: <Monitor size={14} /> },
            { label: 'Payments Made', value: txCount, icon: <Activity size={14} />, highlight: txCount >= 3 ? '#dc2626' : undefined },
          ].map((item, i) => (
            <div key={i} style={{ background: '#f8fafc', borderRadius: 12, padding: '12px 14px', textAlign: 'center' }}>
              <div style={{ color: '#94a3b8', marginBottom: 4 }}>{item.icon}</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: item.highlight || '#0f172a' }}>{item.value}</div>
              <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, marginTop: 2 }}>{item.label}</div>
            </div>
          ))}
        </div>

        <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>Click Velocity (last 20 ticks)</div>
        <VelocityChart data={velocityData} />

        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', animation: 'pulse 2s infinite' }} />
          <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Live behavioral monitoring active</span>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.8); }
        }
      `}</style>
    </div>
  );
};

export default BehavioralIntelligence;
