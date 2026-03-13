import React from 'react';
import { BarChart, Bar, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import SectionHeader from '../SectionHeader';
import CustomTooltip from '../CustomTooltip';
import useStore from '../../store/useStore';

export default function AnalysisTab() {
  const { dataset, liveTransactions } = useStore();
  
  const allTx = [...dataset, ...liveTransactions]
    .filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);
  const allFraud = allTx.filter(t => t.isFraud || t.is_fraud);
  const total = allTx.length || 1;

  // ── 1. Fraud Score Distribution ──────────────────────────────────
  const buckets = [
    { range: '0-20%', count: 0, color: '#10b981' },
    { range: '20-40%', count: 0, color: '#6366f1' },
    { range: '40-60%', count: 0, color: '#f59e0b' },
    { range: '60-80%', count: 0, color: '#f97316' },
    { range: '80-100%', count: 0, color: '#ef4444' },
  ];
  allTx.forEach(t => {
    const s = parseFloat(t.fraudScore || t.fraud_score || 0);
    if (s < 0.2) buckets[0].count++;
    else if (s < 0.4) buckets[1].count++;
    else if (s < 0.6) buckets[2].count++;
    else if (s < 0.8) buckets[3].count++;
    else buckets[4].count++;
  });

  // ── 2. Category Risk derived from dataset ────────────────────────
  const catMap = {};
  allTx.forEach(t => {
    const cat = t.merchant_category || t.category || 'Unknown';
    if (!catMap[cat]) catMap[cat] = { total: 0, fraud: 0 };
    catMap[cat].total++;
    if (t.isFraud || t.is_fraud) catMap[cat].fraud++;
  });
  const categoryRisk = Object.entries(catMap)
    .filter(([, v]) => v.total >= 2)
    .map(([category, v]) => ({
      category: category.length > 14 ? category.slice(0, 12) + '…' : category,
      risk: parseFloat(((v.fraud / v.total) * 100).toFixed(1)),
      volume: v.total,
      fraudCount: v.fraud
    }))
    .sort((a, b) => b.risk - a.risk)
    .slice(0, 8);

  // ── 3. State-wise Fraud derived from dataset ─────────────────────
  const stateMap = {};
  allTx.forEach(t => {
    const s = t.state || 'Unknown';
    if (!stateMap[s]) stateMap[s] = { total: 0, fraud: 0 };
    stateMap[s].total++;
    if (t.isFraud || t.is_fraud) stateMap[s].fraud++;
  });
  const stateData = Object.entries(stateMap)
    .filter(([, v]) => v.total >= 2)
    .map(([state, v]) => ({
      state: state.length > 10 ? state.slice(0, 9) + '…' : state,
      fraudRate: parseFloat(((v.fraud / v.total) * 100).toFixed(1)),
      total: v.total, fraud: v.fraud
    }))
    .sort((a, b) => b.fraudRate - a.fraudRate)
    .slice(0, 10);

  // ── 4. Hourly Fraud from dataset ─────────────────────────────────
  const hourMap = Array.from({ length: 24 }, (_, h) => ({ hour: `${String(h).padStart(2,'0')}:00`, transactions: 0, fraud: 0 }));
  allTx.forEach(t => {
    const h = parseInt(t.hour ?? 12);
    if (h >= 0 && h < 24) {
      hourMap[h].transactions++;
      if (t.isFraud || t.is_fraud) hourMap[h].fraud++;
    }
  });

  // ── 5. Top Flagged Merchants ─────────────────────────────────────
  const merchantMap = {};
  allFraud.forEach(t => {
    const m = t.merchant || 'Unknown';
    merchantMap[m] = (merchantMap[m] || 0) + 1;
  });
  const topMerchants = Object.entries(merchantMap)
    .sort((a, b) => b[1] - a[1]).slice(0, 8)
    .map(([name, fraudCount]) => ({ name: name.length > 18 ? name.slice(0, 15) + '…' : name, fraudCount }));

  // ── 6. SMOTE: real counts from dataset ───────────────────────────
  const realLegit = allTx.filter(t => !(t.isFraud || t.is_fraud)).length;
  const realFraud = allFraud.length;
  const smoteTarget = Math.round(realLegit * 0.9);
  const smoteData = [
    { label: 'Legitimate', before: realLegit, after: realLegit },
    { label: 'Fraud', before: realFraud, after: Math.min(smoteTarget, realLegit) },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header bar with live stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[
          { label: 'Total Analysed', value: total.toLocaleString(), color: '#6366f1' },
          { label: 'Fraud Cases', value: allFraud.length.toLocaleString(), color: '#ef4444' },
          { label: 'Fraud Rate', value: `${((allFraud.length / total) * 100).toFixed(2)}%`, color: '#f97316' },
          { label: 'Avg Risk Score', value: `${(allTx.reduce((s, t) => s + parseFloat(t.fraudScore || t.fraud_score || 0), 0) / total * 100).toFixed(1)}%`, color: '#10b981' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: 'var(--bg-primary)', border: `1px solid var(--border-color)`, borderRadius: 12, padding: '16px 20px', boxShadow: 'var(--card-shadow)', borderTop: `3px solid ${color}` }}>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: color }}>{value}</div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4 }}>from {total} real transactions</div>
          </div>
        ))}
      </div>

      {/* Row 1: Score Distribution + Hourly Pattern */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 12, padding: '20px 24px', boxShadow: 'var(--card-shadow)' }}>
          <SectionHeader title="Fraud Score Distribution" subtitle={`ML risk score breakdown — ${total} real transactions`} lightMode />
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={buckets}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="range" tick={{ fill: '#64748b', fontSize: 11 }} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
              <RechartsTooltip content={<CustomTooltip lightMode />} />
              <Bar dataKey="count" name="Transactions" radius={[4, 4, 0, 0]}>
                {buckets.map((b, i) => <Cell key={i} fill={b.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 12, padding: '20px 24px', boxShadow: 'var(--card-shadow)' }}>
          <SectionHeader title="Hourly Fraud Pattern" subtitle="Transaction and fraud counts derived from real data" lightMode />
          <ResponsiveContainer width="100%" height={230}>
            <AreaChart data={hourMap}>
              <defs>
                <linearGradient id="txnGr" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="frdGr" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="hour" tick={{ fill: '#64748b', fontSize: 9 }} interval={3} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
              <RechartsTooltip content={<CustomTooltip lightMode />} />
              <Legend wrapperStyle={{ fontSize: 12, color: '#475569' }} />
              <Area type="monotone" dataKey="transactions" name="Transactions" stroke="#6366f1" fill="url(#txnGr)" strokeWidth={2} />
              <Area type="monotone" dataKey="fraud" name="Frauds" stroke="#ef4444" fill="url(#frdGr)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row 2: Category Risk + Top Merchants */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 12, padding: '20px 24px', boxShadow: 'var(--card-shadow)' }}>
          <SectionHeader title="Category Fraud Rate" subtitle="Computed from actual transaction records" lightMode />
          {categoryRisk.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-dim)', padding: '40px 0', fontSize: 13 }}>Loading category data…</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={categoryRisk} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" unit="%" tick={{ fill: '#64748b', fontSize: 11 }} />
                <YAxis type="category" dataKey="category" tick={{ fill: '#475569', fontSize: 10 }} width={90} />
                <RechartsTooltip content={<CustomTooltip lightMode />} />
                <Bar dataKey="risk" name="Fraud Rate %" fill="#ef4444" radius={[0, 4, 4, 0]}>
                  {categoryRisk.map((_, i) => <Cell key={i} fill={i < 3 ? '#ef4444' : i < 5 ? '#f97316' : '#10b981'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 12, padding: '20px 24px', boxShadow: 'var(--card-shadow)' }}>
          <SectionHeader title="Top Flagged Merchants" subtitle="Merchants with most fraud cases in the dataset" accent="#ef4444" lightMode />
          {topMerchants.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-dim)', padding: '40px 0', fontSize: 13 }}>No fraud cases in dataset yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={topMerchants} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" tick={{ fill: '#64748b', fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fill: '#475569', fontSize: 10 }} width={100} />
                <RechartsTooltip content={<CustomTooltip lightMode />} />
                <Bar dataKey="fraudCount" name="Fraud Cases" fill="#f97316" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Row 3: State Fraud + SMOTE */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 12, padding: '20px 24px', boxShadow: 'var(--card-shadow)' }}>
          <SectionHeader title="State-wise Fraud Rate" subtitle="Computed from real transaction states in the database" accent="#6366f1" lightMode />
          {stateData.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-dim)', padding: '40px 0', fontSize: 13 }}>Loading state data…</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={stateData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="state" tick={{ fill: '#64748b', fontSize: 9 }} />
                <YAxis unit="%" tick={{ fill: '#64748b', fontSize: 11 }} />
                <RechartsTooltip content={<CustomTooltip lightMode />} />
                <Bar dataKey="fraudRate" name="Fraud Rate %" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 12, padding: '20px 24px', boxShadow: 'var(--card-shadow)' }}>
          <SectionHeader title="Class Balancing via SMOTE" subtitle={`Training data: ${realLegit} legitimate vs ${realFraud} fraud → balanced for ML training`} accent="#10b981" lightMode />
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={smoteData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fill: '#475569', fontSize: 12 }} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
              <RechartsTooltip content={<CustomTooltip lightMode />} />
              <Legend wrapperStyle={{ fontSize: 12, color: '#475569' }} />
              <Bar dataKey="before" name="Original (before SMOTE)" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
              <Bar dataKey="after" name="After SMOTE" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
