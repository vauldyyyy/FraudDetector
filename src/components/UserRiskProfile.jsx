import React, { useMemo } from 'react';
import { Shield, TrendingUp, AlertTriangle, CheckCircle2, Smartphone } from 'lucide-react';

const UserRiskProfile = ({ transactions }) => {
  const profile = useMemo(() => {
    if (!transactions || transactions.length === 0) {
      return { score: 85, level: 'Good', color: '#16a34a', cleared: 0, total: 0, avgFraudScore: 0, devices: 0 };
    }

    const userTxns = transactions.slice(0, 20); // Last 20 transactions
    const cleared = userTxns.filter(t => t.status === 'CLEARED').length;
    const total = userTxns.length;
    const avgFraudScore = userTxns.reduce((s, t) => s + (t.fraudScore || t.fraud_score || 0), 0) / total;
    const devices = new Set(userTxns.map(t => t.device).filter(Boolean)).size;
    
    // Safety score: 100 - (fraud rate * 50) - (avg fraud score * 30) - (device diversity penalty * 10)
    const fraudRate = 1 - (cleared / total);
    const rawScore = Math.max(10, Math.round(100 - (fraudRate * 50) - (avgFraudScore * 30) - (Math.min(devices, 4) * 2)));
    
    let level, color;
    if (rawScore >= 80) { level = 'Excellent'; color = '#16a34a'; }
    else if (rawScore >= 60) { level = 'Good'; color = '#2563eb'; }
    else if (rawScore >= 40) { level = 'Fair'; color = '#d97706'; }
    else { level = 'At Risk'; color = '#dc2626'; }

    return { score: rawScore, level, color, cleared, total, avgFraudScore, devices };
  }, [transactions]);

  const circumference = 2 * Math.PI * 52;
  const dashOffset = circumference - (profile.score / 100) * circumference;

  return (
    <div style={{
      background: 'var(--bg-primary)',
      border: '1px solid var(--border-color)',
      borderRadius: '24px',
      padding: '28px',
      boxShadow: 'var(--card-shadow)',
      height: 'fit-content'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
        <Shield size={20} color="var(--accent-blue)" />
        <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Account Safety Score
        </h3>
      </div>

      {/* Ring Chart */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
        <div style={{ position: 'relative', width: 130, height: 130 }}>
          <svg width={130} height={130} viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="52" fill="none" stroke="#f1f5f9" strokeWidth="10" />
            <circle
              cx="60" cy="60" r="52" fill="none"
              stroke={profile.color}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              transform="rotate(-90 60 60)"
              style={{ transition: 'stroke-dashoffset 1s ease-out' }}
            />
          </svg>
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)', textAlign: 'center'
          }}>
            <div style={{ fontSize: '28px', fontWeight: 900, color: profile.color, lineHeight: 1 }}>
              {profile.score}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: 600 }}>
              {profile.level}
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {[
          { icon: <CheckCircle2 size={14} color="#16a34a" />, label: 'Successful Payments', val: `${profile.cleared} / ${profile.total}` },
          { icon: <AlertTriangle size={14} color="#d97706" />, label: 'Avg Fraud Score', val: `${(profile.avgFraudScore * 100).toFixed(1)}%` },
          { icon: <Smartphone size={14} color="#6366f1" />, label: 'Unique Devices Used', val: profile.devices },
          { icon: <TrendingUp size={14} color="var(--accent-blue)" />, label: 'Safety Trend', val: profile.score > 70 ? '↑ Improving' : '↓ Watch Out' },
        ].map(({ icon, label, val }) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#f8fafc', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-dim)', fontSize: '13px' }}>
              {icon} {label}
            </div>
            <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-main)' }}>{val}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default UserRiskProfile;
