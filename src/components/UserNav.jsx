import React from 'react';
import { LayoutDashboard, UserCircle, Sparkles } from 'lucide-react';

const UserNav = ({ view, setView, onToggleRAG, isRagOpen }) => {
  return (
    <div style={{
      background: "var(--bg-primary)",
      borderBottom: "1px solid var(--border-color)",
      padding: "8px 20px",
      display: "flex",
      justifyContent: "center",
      gap: "20px",
      position: "sticky",
      top: 60,
      zIndex: 99,
      boxShadow: "0 1px 2px 0 rgb(0 0 0 / 0.05)"
    }}>
      <button 
        onClick={() => setView('admin')}
        style={{
          background: view === 'admin' ? "#eff6ff" : "transparent",
          border: `1px solid ${view === 'admin' ? "#bfdbfe" : "transparent"}`,
          color: view === 'admin' ? "var(--accent-blue)" : "var(--text-dim)",
          padding: "6px 16px",
          borderRadius: "8px",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          cursor: "pointer",
          fontSize: "13px",
          fontWeight: 600,
          transition: "all 0.2s"
        }}
      >
        <LayoutDashboard size={16} /> Admin Portal
      </button>
      <button 
        onClick={() => setView('user')}
        style={{
          background: view === 'user' ? "#f0fdf4" : "transparent",
          border: `1px solid ${view === 'user' ? "#bbf7d0" : "transparent"}`,
          color: view === 'user' ? "var(--accent-green)" : "var(--text-dim)",
          padding: "6px 16px",
          borderRadius: "8px",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          cursor: "pointer",
          fontSize: "13px",
          fontWeight: 600,
          transition: "all 0.2s"
        }}
      >
        <UserCircle size={16} /> User Portal
      </button>

      {/* AI Assistant Toggle */}
      <div style={{ width: "1px", background: "var(--border-color)", height: "24px", alignSelf: "center", margin: "0 8px" }} />
      
      <button 
        onClick={onToggleRAG}
        style={{
          background: isRagOpen ? "#f8fafc" : "transparent",
          border: `1px solid ${isRagOpen ? "var(--border-color)" : "transparent"}`,
          color: "var(--accent-blue)",
          padding: "6px 16px",
          borderRadius: "8px",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          cursor: "pointer",
          fontSize: "13px",
          fontWeight: 700,
          transition: "all 0.2s",
          boxShadow: isRagOpen ? "0 1px 2px rgb(0 0 0 / 0.05)" : "none"
        }}
      >
        <Sparkles size={16} /> AI Assistant
      </button>
    </div>
  );
};

export default UserNav;
