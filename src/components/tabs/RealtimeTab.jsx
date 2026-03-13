import React from 'react';
import { Download, Cpu, Lock } from 'lucide-react';
import StatusBadge from '../StatusBadge';
import { exportToCSV } from '../../utils/export-utils';
import useStore from '../../store/useStore';

export default function RealtimeTab() {
  const { 
    liveTransactions, 
    filterRisk, 
    setFilterRisk, 
    frozenAccounts, 
    freezeAccount,
    addAuditLog,
    setIsModalOpen,
    setModalTransaction,
    selectedTx,
    setSelectedTx
  } = useStore();

  const handleViewBasis = (tx) => {
    setModalTransaction(tx);
    setIsModalOpen(true);
  };

  const displayLive = filterRisk === "ALL"
    ? liveTransactions
    : filterRisk === "FRAUD" ? liveTransactions.filter(t => t.isFraud)
    : liveTransactions.filter(t => t.fraudScore > 0.5);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: "4px" }}>
        {["ALL", "FRAUD", "HIGH_RISK"].map(f => (
          <button key={f} onClick={() => setFilterRisk(f)} style={{
            background: filterRisk === f ? "#eff6ff" : "var(--bg-primary)",
            border: `1px solid ${filterRisk === f ? "#3b82f6" : "var(--border-color)"}`,
            color: filterRisk === f ? "#2563eb" : "var(--text-dim)",
            borderRadius: 8, padding: "6px 16px", cursor: "pointer",
            fontSize: 12, fontWeight: 600, boxShadow: filterRisk !== f && "var(--card-shadow)",
          }}>{f.replace("_", " ")}</button>
        ))}
        <div style={{ flex: 1 }} />
        <button
          onClick={() => exportToCSV(liveTransactions, `fraud_report_${new Date().toISOString().slice(0,10)}.csv`)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'white', border: '1px solid var(--border-color)', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: 'var(--text-dim)', boxShadow: 'var(--card-shadow)' }}
        >
          <Download size={14} /> Export CSV
        </button>
      </div>

      <div style={{ background: "var(--bg-primary)", border: "1px solid var(--border-color)", borderRadius: 12, overflow: "hidden", boxShadow: "var(--card-shadow)" }}>
        <div style={{ borderBottom: "1px solid var(--border-color)", background: "#f8fafc", padding: "14px 20px", display: "grid", gridTemplateColumns: "140px 1fr 80px 100px 100px 90px", gap: 8 }}>
          {["ID", "Merchant", "Risk", "Status", "Device", "Hour"].map(h => (
            <div key={h} style={{ color: "var(--text-dim)", fontSize: 11, fontWeight: 600, textTransform: "uppercase" }}>{h}</div>
          ))}
        </div>
        <div style={{ maxHeight: 600, overflowY: "auto" }}>
          {displayLive.map((tx, index) => (
            <div key={`tx-${tx.id}`} onClick={() => setSelectedTx(tx === selectedTx ? null : tx)}
              style={{
                padding: "14px 20px", borderBottom: "1px solid #f1f5f9",
                display: "grid", gridTemplateColumns: "140px 1fr 80px 100px 100px 90px",
                gap: 8, alignItems: "center", cursor: "pointer",
                background: tx.status === "BLOCKED" ? "#fef2f2" : tx.status === "FLAGGED" ? "#fffbeb" : "transparent",
                transition: "all 0.2s ease",
                animation: `slideIn 0.3s ease-out ${index * 0.05}s both`,
                opacity: tx.isLive ? 1 : 0.8
              }}>
              <div style={{ color: "var(--text-dim)", fontSize: 12, display: "flex", alignItems: "center", gap: 8, fontFamily: "monospace" }}>
                 {tx.isLive && <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981", display: "inline-block" }} />}
                 {tx.id}
              </div>
              <div>
                <div style={{ color: "var(--text-main)", fontWeight: 700, fontSize: 14 }}>₹{tx.amount.toLocaleString()}</div>
                <div style={{ color: "var(--text-dim)", fontSize: 12 }}>{tx.merchant}</div>
              </div>
              <div>
                <div style={{ color: tx.fraudScore > 0.75 ? "#dc2626" : tx.fraudScore > 0.5 ? "#d97706" : "#16a34a", fontWeight: 700, fontSize: 13 }}>
                  {(tx.fraudScore * 100).toFixed(1)}%
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <StatusBadge status={frozenAccounts.has(tx.id) ? 'FROZEN' : tx.status} />
                {tx.status !== 'CLEARED' && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleViewBasis(tx); }}
                    style={{ background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: "6px", color: "var(--text-dim)", cursor: "pointer", padding: 4, display: "flex" }}
                  >
                    <Cpu size={14} />
                  </button>
                )}
                {tx.status === 'BLOCKED' && !frozenAccounts.has(tx.id) && (
                  <button
                    onClick={(e) => { e.stopPropagation(); freezeAccount(tx.id); addAuditLog(`ACCOUNT FROZEN: Merchant '${tx.merchant}' manually frozen by admin.`, 'error'); }}
                    title="Freeze This Merchant"
                    style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '6px', color: '#dc2626', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700 }}
                  >
                    <Lock size={12} /> Freeze
                  </button>
                )}
                {frozenAccounts.has(tx.id) && (
                  <span style={{ background: '#7c3aed22', border: '1px solid #7c3aed44', borderRadius: 6, padding: '3px 8px', fontSize: 10, fontWeight: 800, color: '#7c3aed' }}>🔒 FROZEN</span>
                )}
              </div>
              <div style={{ color: "var(--text-dim)", fontSize: 12 }}>{tx.device}</div>
              <div style={{ color: "var(--text-dim)", fontSize: 12 }}>{tx.hour}:00</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
