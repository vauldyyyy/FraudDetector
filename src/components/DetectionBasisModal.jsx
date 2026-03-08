import React from 'react';
import { X, ShieldAlert, Cpu, BarChart3, Info } from 'lucide-react';

const DetectionBasisModal = ({ isOpen, onClose, transaction }) => {
  if (!isOpen || !transaction) return null;

  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: "rgba(0, 0, 0, 0.85)",
      backdropFilter: "blur(8px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 2000,
      padding: "20px"
    }}>
      <div style={{
        background: "var(--bg-primary)",
        width: "100%",
        maxWidth: "600px",
        borderRadius: "24px",
        border: "1px solid var(--border-color)",
        boxShadow: "0 25px 50px -12px rgb(0 0 0 / 0.15)",
        overflow: "hidden",
        position: "relative",
        animation: "slideIn 0.3s ease-out"
      }}>
        {/* Header */}
        <div style={{
          padding: "24px",
          borderBottom: "1px solid var(--border-color)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "linear-gradient(90deg, #ffffff, #f8fafc)"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ 
              background: transaction.status === 'BLOCKED' ? "#fef2f2" : "#fffbeb",
              padding: "8px",
              borderRadius: "10px",
              color: transaction.status === 'BLOCKED' ? "#dc2626" : "#d97706",
              border: transaction.status === 'BLOCKED' ? "1px solid #fca5a5" : "1px solid #fcd34d"
            }}>
              <ShieldAlert size={24} />
            </div>
            <div>
              <h3 style={{ margin: 0, color: "var(--text-main)", fontSize: "18px", fontWeight: 700 }}>Detection Basis</h3>
              <p style={{ margin: 0, color: "var(--text-dim)", fontSize: "12px" }}>TXN ID: {transaction.id}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            style={{ 
              background: "transparent", 
              border: "none", 
              color: "var(--text-dim)", 
              cursor: "pointer",
              padding: "4px"
            }}
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: "24px", maxHeight: "70vh", overflowY: "auto" }}>
          
          {/* Summary */}
          <div style={{ 
            background: "var(--bg-secondary)", 
            padding: "20px", 
            borderRadius: "16px", 
            marginBottom: "24px",
            border: "1px solid var(--border-color)"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--accent-blue)", marginBottom: "12px" }}>
              <Info size={16} />
              <span style={{ fontWeight: 700, fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.05em" }}>AI Technical Summary</span>
            </div>
            <p style={{ color: "var(--text-main)", fontSize: "14px", lineHeight: "1.6", margin: 0, fontWeight: 500 }}>
              {transaction.explanation}
            </p>
          </div>

          {/* Indicators Grid */}
          <div style={{ marginBottom: "24px" }}>
            <h4 style={{ color: "var(--text-dim)", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "12px", fontWeight: 700 }}>Risk Indicators Evaluated</h4>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              {(transaction.indicators || []).map((ind) => (
                <div key={ind} style={{ 
                  background: "#fef2f2", 
                  padding: "10px 14px", 
                  borderRadius: "10px", 
                  border: "1px solid #fca5a5",
                  color: "#dc2626",
                  fontSize: "12px",
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: "8px"
                }}>
                  <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#dc2626" }} />
                  {ind.replace("_", " ").toUpperCase()}
                </div>
              ))}
            </div>
          </div>

          {/* Model Confidence */}
          <div>
            <h4 style={{ color: "var(--text-dim)", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "16px", fontWeight: 700 }}>Ensemble Model Consensus</h4>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {Object.entries(transaction.modelScores || {}).map(([model, score]) => (
                <div key={model}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px", fontSize: "12px" }}>
                    <span style={{ color: "var(--text-dim)", fontWeight: 600 }}>{model.replace(/([A-Z])/g, ' $1').trim()}</span>
                    <span style={{ color: "var(--text-main)", fontWeight: 700 }}>{(score * 100).toFixed(1)}%</span>
                  </div>
                  <div style={{ width: "100%", height: "6px", background: "#e2e8f0", borderRadius: "3px", overflow: "hidden" }}>
                    <div style={{ 
                      width: `${score * 100}%`, 
                      height: "100%", 
                      background: score > 0.8 ? "#dc2626" : score > 0.6 ? "#d97706" : "#16a34a",
                      borderRadius: "3px"
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ 
          padding: "20px 24px", 
          background: "var(--bg-secondary)", 
          borderTop: "1px solid var(--border-color)",
          textAlign: "center"
        }}>
          <p style={{ color: "var(--text-dim)", fontSize: "11px", margin: 0, fontWeight: 500 }}>
            This technical basis is generated by the UPI Fraud Shield AI Engine for auditing and judicial verification purposes.
          </p>
        </div>
      </div>
    </div>
  );
};

export default DetectionBasisModal;
