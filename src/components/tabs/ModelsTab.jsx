import React from 'react';
import { LineChart, Line, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';
import { MODEL_METRICS, ROC_DATA, PR_DATA, FEATURE_IMPORTANCE } from '../../constants/mock-data';
import SectionHeader from '../SectionHeader';
import CustomTooltip from '../CustomTooltip';

export default function ModelsTab() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 12 }}>
        {MODEL_METRICS.map(m => (
          <div key={m.name} style={{ background: "var(--bg-primary)", border: `1px solid var(--border-color)`, borderRadius: 12, padding: "18px 16px", position: "relative", overflow: "hidden", boxShadow: "var(--card-shadow)" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg,${m.color},transparent)` }} />
            <div style={{ color: "var(--text-main)", fontSize: 13, fontWeight: 700, marginBottom: 12 }}>{m.name.toUpperCase()}</div>
            {[
              { k: "Accuracy", v: m.accuracy + "%" },
              { k: "Precision", v: m.precision + "%" },
              { k: "Recall", v: m.recall + "%" },
              { k: "F1 Score", v: m.f1 + "%" },
              { k: "AUC-ROC", v: m.auc.toFixed(3) },
            ].map(({ k, v }) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ color: "var(--text-dim)", fontSize: 12 }}>{k}</span>
                <span style={{ color: "var(--text-main)", fontWeight: 600, fontSize: 12 }}>{v}</span>
              </div>
            ))}
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
        <div style={{ background: "var(--bg-primary)", border: "1px solid var(--border-color)", borderRadius: 12, padding: "20px 24px", boxShadow: "var(--card-shadow)" }}>
          <SectionHeader title="ROC Curves" subtitle="Evaluation Metrics" accent="#10b981" lightMode />
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={ROC_DATA}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="fpr" tick={{ fill: "#64748b", fontSize: 11 }} />
              <YAxis tick={{ fill: "#64748b", fontSize: 11 }} />
              <RechartsTooltip content={<CustomTooltip lightMode />} />
              <Legend wrapperStyle={{ fontSize: 12, color: "#475569" }} />
              <Line type="monotone" dataKey="ensemble" name="Ensemble" stroke="#f97316" strokeWidth={3} dot={false} />
              <Line type="monotone" dataKey="xgb" name="XGBoost" stroke="#10b981" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div style={{ background: "var(--bg-primary)", border: "1px solid var(--border-color)", borderRadius: 12, padding: "20px 24px", boxShadow: "var(--card-shadow)" }}>
          <SectionHeader title="PR Curves" subtitle="Precision-Recall" accent="#3b82f6" lightMode />
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={PR_DATA}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="recall" tick={{ fill: "#64748b", fontSize: 11 }} />
              <YAxis tick={{ fill: "#64748b", fontSize: 11 }} />
              <RechartsTooltip content={<CustomTooltip lightMode />} />
              <Legend wrapperStyle={{ fontSize: 12, color: "#475569" }} />
              <Line type="monotone" dataKey="ensemble" name="Ensemble" stroke="#f97316" strokeWidth={3} dot={false} />
              <Line type="monotone" dataKey="xgb" name="XGBoost" stroke="#10b981" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div style={{ background: "var(--bg-primary)", border: "1px solid var(--border-color)", borderRadius: 12, padding: "20px 24px", boxShadow: "var(--card-shadow)" }}>
          <SectionHeader title="Feature Importance" subtitle="Stacked Generalization Models" accent="#f59e0b" lightMode />
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={FEATURE_IMPORTANCE} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" domain={[0, 0.25]} tick={{ fill: "#64748b", fontSize: 11 }} />
              <YAxis type="category" dataKey="feature" tick={{ fill: "#475569", fontSize: 11, fontWeight: 500 }} width={110} />
              <RechartsTooltip content={<CustomTooltip lightMode />} />
              <Bar dataKey="rf" name="Random Forest" fill="#f59e0b" radius={[0, 3, 3, 0]} />
              <Bar dataKey="xgb" name="XGBoost" fill="#10b981" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
