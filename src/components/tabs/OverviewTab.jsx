import React from 'react';
import { AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';
import { Terminal } from 'lucide-react';
import MetricCard from '../MetricCard';
import SectionHeader from '../SectionHeader';
import CustomTooltip from '../CustomTooltip';
import FraudStatsSummary from '../FraudStatsSummary';
import IndiaHeatmap from '../IndiaHeatmap';
import useStore from '../../store/useStore';
import { HOURLY_FRAUD } from '../../utils/data-engine';

export default function OverviewTab() {
  const { dataset, liveTransactions, auditLogs } = useStore();
  
  const fraudTxns = dataset.filter(t => t.isFraud);
  const blockedTxns = dataset.filter(t => t.status === "BLOCKED");
  const totalAmount = dataset.reduce((s, t) => s + t.amount, 0);
  const fraudAmount = fraudTxns.reduce((s, t) => s + t.amount, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 14 }}>
        <MetricCard label="Ensemble AUC" value="0.996" sub="5-model ensemble" icon="🤖" accent="#10b981" />
        <MetricCard label="Fraud Detected" value={fraudTxns.length} sub={`${((fraudTxns.length / dataset.length) * 100).toFixed(1)}% fraud rate`} icon="🚨" accent="#ef4444" delta={2.3} />
        <MetricCard label="Auto-Blocked" value={blockedTxns.length} sub="High confidence fraud" icon="🛡️" accent="#f97316" />
        <MetricCard label="Live Transactions" value={liveTransactions.length} sub="Real-time monitor" icon="📊" accent="#6366f1" />
        <MetricCard label="Fraud Amount" value={`₹${(fraudAmount / 100000).toFixed(1)}L`} sub={`of ₹${(totalAmount / 100000).toFixed(0)}L total`} icon="💰" accent="#f59e0b" delta={-5.1} />
      </div>

      <FraudStatsSummary dataset={dataset} blockedTxns={blockedTxns} fraudTxns={fraudTxns} />

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
        <div style={{ background: "var(--bg-primary)", border: "1px solid var(--border-color)", borderRadius: 12, padding: "20px 24px", boxShadow: "var(--card-shadow)" }}>
          <SectionHeader title="Hourly Transaction Volume & Fraud Rate" subtitle="24-hour pattern analysis with anomaly peaks" lightMode />
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={HOURLY_FRAUD}>
              <defs>
                <linearGradient id="txnGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="fraudGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="hour" tick={{ fill: "#64748b", fontSize: 11 }} tickLine={false} />
              <YAxis yAxisId="left" tick={{ fill: "#64748b", fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis yAxisId="right" orientation="right" tick={{ fill: "#64748b", fontSize: 11 }} tickLine={false} axisLine={false} />
              <RechartsTooltip content={<CustomTooltip lightMode />} />
              <Legend wrapperStyle={{ fontSize: 12, color: "#475569" }} />
              <Area yAxisId="left" type="monotone" dataKey="transactions" name="Transactions" stroke="#6366f1" fill="url(#txnGrad)" strokeWidth={3} />
              <Area yAxisId="right" type="monotone" dataKey="fraud" name="Fraud Cases" stroke="#ef4444" fill="url(#fraudGrad)" strokeWidth={3} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Audit Log Panel */}
        <div style={{ background: "#f8fafc", border: "1px solid var(--border-color)", borderRadius: 12, padding: "20px", display: "flex", flexDirection: "column", boxShadow: "var(--card-shadow)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, color: "var(--accent-blue)" }}>
            <Terminal size={16} />
            <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase" }}>System Audit Log</span>
          </div>
          <div style={{ flex: 1, overflowY: "auto", maxHeight: 180, display: "flex", flexDirection: "column", gap: 10, paddingRight: 4 }}>
            {auditLogs.map(log => (
              <div key={log.id} style={{ fontSize: 12, fontFamily: "monospace", display: "flex", gap: 8 }}>
                <span style={{ color: "#94a3b8", whiteSpace: "nowrap" }}>[{log.time}]</span>
                <span style={{ 
                  color: log.type === 'error' ? "#dc2626" : log.type === 'warning' ? "#d97706" : log.type === 'success' ? "#16a34a" : "#475569",
                  lineHeight: "1.4"
                }}>{log.msg}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <IndiaHeatmap />
    </div>
  );
}
