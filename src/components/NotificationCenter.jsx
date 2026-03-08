import React from 'react';
import { Bell, AlertCircle, CheckCircle2, ShieldAlert, X, Cpu } from 'lucide-react';

const NotificationCenter = ({ notifications, onDismiss, onViewBasis }) => {
  if (notifications.length === 0) return null;

  return (
    <div style={{
      position: "fixed",
      top: "120px",
      right: "24px",
      width: "360px",
      display: "flex",
      flexDirection: "column",
      gap: "12px",
      zIndex: 1000,
      pointerEvents: "none"
    }}>
      {notifications.map((n) => (
        <div 
          key={n.id}
          style={{
            background: n.type === 'error' ? "rgba(220, 38, 38, 0.95)" : 
                       n.type === 'warning' ? "rgba(217, 119, 6, 0.95)" : 
                       "rgba(5, 150, 105, 0.95)",
            color: "white",
            padding: "16px 20px",
            borderRadius: "16px",
            boxShadow: "0 10px 30px rgba(0, 0, 0, 0.3)",
            display: "flex",
            alignItems: "flex-start",
            gap: "14px",
            animation: "slideIn 0.3s ease-out",
            backdropFilter: "blur(8px)",
            border: "1px solid rgba(255, 255, 255, 0.2)",
            pointerEvents: "auto"
          }}
        >
          <div style={{ marginTop: "2px" }}>
            {n.type === 'error' ? <ShieldAlert size={20} /> : 
             n.type === 'warning' ? <AlertCircle size={20} /> : 
             <CheckCircle2 size={20} />}
          </div>
          
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: "14px", marginBottom: "4px" }}>{n.title}</div>
            <div style={{ fontSize: "13px", opacity: 0.9, lineHeight: "1.4", marginBottom: n.transaction ? "12px" : "0" }}>{n.message}</div>
            
            {n.transaction && (
              <button 
                onClick={() => onViewBasis(n.transaction)}
                style={{
                  background: "rgba(255, 255, 255, 0.2)",
                  border: "1px solid rgba(255, 255, 255, 0.4)",
                  color: "white",
                  padding: "6px 12px",
                  borderRadius: "8px",
                  fontSize: "11px",
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px"
                }}
              >
                <Cpu size={12} /> View Detection Basis
              </button>
            )}
          </div>
          
          <button 
            onClick={() => onDismiss(n.id)}
            style={{
              background: "transparent",
              border: "none",
              color: "white",
              padding: "4px",
              cursor: "pointer",
              opacity: 0.7,
              marginRight: "-10px",
              marginTop: "-4px"
            }}
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
};

export default NotificationCenter;
