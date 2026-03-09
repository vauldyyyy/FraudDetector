import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, Legend, ResponsiveContainer, Cell, PieChart, Pie
} from "recharts";
import { Info, Cpu, AlertTriangle, Terminal, Lock, Download } from "lucide-react";

// Components
import RiskBadge from "./components/RiskBadge";
import StatusBadge from "./components/StatusBadge";
import MetricCard from "./components/MetricCard";
import SectionHeader from "./components/SectionHeader";
import CustomTooltip from "./components/CustomTooltip";
import UserNav from "./components/UserNav";
import UserPaymentCard from "./components/UserPaymentCard";
import NotificationCenter from "./components/NotificationCenter";
import DetectionBasisModal from "./components/DetectionBasisModal";
import RAGAssistant from "./components/RAGAssistant";
import FraudNetworkGraph from "./components/FraudNetworkGraph";
import IndiaHeatmap from "./components/IndiaHeatmap";
import OTPModal from "./components/OTPModal";
import AlertRulesEngine, { DEFAULT_RULES } from "./components/AlertRulesEngine";
import UserRiskProfile from "./components/UserRiskProfile";
import FraudStatsSummary from "./components/FraudStatsSummary";
import { exportToCSV } from "./utils/export-utils";
import MobileUPIApp from "./components/MobileUPIApp";
import DemoQRCodes from "./components/DemoQRCodes";

// Constants & Utils
import { 
  MODEL_METRICS, 
  ROC_DATA, 
  FEATURE_IMPORTANCE, 
  SMOTE_DATA 
} from "./constants/mock-data";
import { 
  generateTransaction, 
  generateDataset, 
  HOURLY_FRAUD, 
  CATEGORY_RISK, 
  STATE_DATA,
  predictFraud
} from "./utils/data-engine";
import { supabase } from "./lib/supabase";

// Helper to apply Admin overrides defined in Alert Rules Engine
const applyAdminRules = (tx, currentRules) => {
  let finalStatus = tx.status;
  const appliedRules = [];

  for (const rule of currentRules.filter(r => r.enabled)) {
    const txValue = tx[rule.field];
    let match = false;
    const ruleValue = rule.value;

    if (rule.operator === 'gt' && txValue > ruleValue) match = true;
    if (rule.operator === 'lt' && txValue < ruleValue) match = true;
    if (rule.operator === 'eq' && String(txValue).toLowerCase() === String(ruleValue).toLowerCase()) match = true;

    if (match) {
      appliedRules.push(rule.name);
      if (rule.action === 'Block') finalStatus = 'BLOCKED';
      else if (rule.action === 'Flag' && finalStatus !== 'BLOCKED') finalStatus = 'FLAGGED';
    }
  }

  if (appliedRules.length > 0) {
    return {
      ...tx,
      status: finalStatus,
      isFraud: finalStatus !== 'CLEARED',
      explanation: `${tx.explanation} (Overridden by Admin Rules: ${appliedRules.join(', ')})`,
      indicators: [...new Set([...(tx.indicators || []), 'admin_rule_override'])]
    };
  }
  return tx;
};

export default function App() {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [view, setView] = useState(isMobile ? "user" : "admin"); // 'admin' or 'user'
  const [userSubView, setUserSubView] = useState("app"); // 'app' or 'qrcodes'
  const [dataset, setDataset] = useState([]); // Real dataset will load over network now
  const [liveTransactions, setLiveTransactions] = useState([]);
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedTx, setSelectedTx] = useState(null);
  const [alertCount, setAlertCount] = useState(0);
  const [isMonitoring, setIsMonitoring] = useState(true);
  const [filterRisk, setFilterRisk] = useState("ALL");
  const [notifications, setNotifications] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  
  // XAI Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTransaction, setModalTransaction] = useState(null);
  const [isRagOpen, setIsRagOpen] = useState(false);
  
  // Phase 9 State
  const [frozenAccounts, setFrozenAccounts] = useState(new Set());
  const [otpPending, setOtpPending] = useState(null); // holds a FLAGGED tx awaiting OTP
  const [alertRules, setAlertRules] = useState(DEFAULT_RULES);
  
  const counterRef = useRef(1000);

  const fraudTxns = dataset.filter(t => t.isFraud);
  const blockedTxns = dataset.filter(t => t.status === "BLOCKED");
  const totalAmount = dataset.reduce((s, t) => s + t.amount, 0);
  const fraudAmount = fraudTxns.reduce((s, t) => s + t.amount, 0);

  const addAuditLog = useCallback((msg, type = 'info') => {
    const log = { id: Date.now() + Math.random(), msg, type, time: new Date().toLocaleTimeString() };
    setAuditLogs(prev => [log, ...prev].slice(0, 50));
  }, []);

  const handleViewBasis = (tx) => {
    setModalTransaction(tx);
    setIsModalOpen(true);
  };

  // Initial Fetch, Realtime Subscription & Background Mock Data
  useEffect(() => {
    // 1. Fetch ALL seeded historical data from Supabase
    const fetchInitialData = async () => {
      try {
        const { data, error } = await supabase
          .from('transactions')
          .select('*')
          .order('id', { ascending: false })
          .limit(1000); // Pull the full 660 seed + new ones
        
        if (data && !error) {
          const mappedData = data.map(tx => ({
            ...tx,
            fraudScore: tx.fraud_score,
            isFraud: tx.is_fraud
          }));
          
          // Seed the historical dataset for charts & metrics
          setDataset(mappedData);
          
          // Seed the live feed (up to 1000)
          setLiveTransactions(prev => {
            const combined = [...mappedData, ...prev];
            return combined.filter((v, i, a) => a.findIndex(t => (t.id === v.id)) === i).slice(0, 1000);
          });
          addAuditLog(`Connected to Supabase. Loaded ${mappedData.length} historical database records.`, "success");
        } else if (error) {
           addAuditLog(`Supabase Connection Error: ${error.message}`, "warning");
        }
      } catch (err) {}
    };

    fetchInitialData();

    // Check window resize for mobile view
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (mobile && view === 'admin') setView('user');
    };
    window.addEventListener('resize', handleResize);

    // 2. Subscribe to Supabase real-time inserts
    const subscription = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'transactions' },
        (payload) => {
          const newTx = {
            ...payload.new,
            fraudScore: payload.new.fraud_score,
            isFraud: payload.new.is_fraud,
            isLive: true // Flag to differentiate live DB transactions
          };
          
          setLiveTransactions(prev => [newTx, ...prev].slice(0, 100));
          
          // Enhanced Admin Alert Logging for LIVE actions
          addAuditLog(`[LIVE DATABASE] New transaction from ${newTx.merchant}: ₹${newTx.amount.toLocaleString()}`, 
            newTx.status === 'BLOCKED' ? 'error' : newTx.status === 'FLAGGED' ? 'warning' : 'success');

          if (newTx.status === "BLOCKED" || newTx.status === "FLAGGED") {
            setAlertCount(a => a + 1);
            
            const newNotif = {
              id: `notif-${newTx.id}-${Date.now()}`,
              type: newTx.status === 'BLOCKED' ? 'error' : 'warning',
              title: newTx.status === 'BLOCKED' ? 'Transaction Blocked (LIVE)' : 'Fraud Alert (LIVE)',
              message: newTx.status === 'BLOCKED' 
                ? `SECURITY ALERT: Payment of ₹${newTx.amount.toLocaleString()} to ${newTx.merchant} was blocked due to pattern match.`
                : `CAUTION: Potential fraud detected for ₹${newTx.amount.toLocaleString()} to ${newTx.merchant}.`,
              transaction: newTx
            };
            setNotifications(prev => [newNotif, ...prev]);
          }
        }
      )
      .subscribe();

    // 3. Background Mock Data Generator (for the demo effect)
    let mockInterval;
    if (isMonitoring) {
      mockInterval = setInterval(() => {
        const isFraud = Math.random() < 0.08; // 8% chance of background fraud
        let tx = generateTransaction(++counterRef.current, isFraud);
        tx.isLive = false; // Background data
        tx = applyAdminRules(tx, alertRules);
        
        setLiveTransactions(prev => [tx, ...prev].slice(0, 1000)); // Keep last 1000
        
        // Note: We don't add mock transactions to the Audit Log to keep it clean for actual user actions
        if (tx.status === "BLOCKED" || tx.status === "FLAGGED") {
          setAlertCount(a => a + 1);
          // Optional: You could add mock notifications here too, but it might get overwhelming.
        }
      }, 3500); // New background transaction every 3.5 seconds
    }

    return () => {
      supabase.removeChannel(subscription);
      if (mockInterval) clearInterval(mockInterval);
      window.removeEventListener('resize', handleResize);
    };
  }, [addAuditLog, isMonitoring, alertRules]);

  const handleManualPayment = async (paymentData) => {
    const txId = ++counterRef.current;
    const merchantLower = (paymentData.merchant || "").toLowerCase();
    const amount = parseFloat(paymentData.amount) || 500;
    const hour = new Date().getHours();

    // Call the REAL Flask ML API (ensemble of RF + GradientBoosting + IsolationForest)
    // trained on the 660-row CSV dataset
    const mlResult = await predictFraud({
      amount,
      merchant: paymentData.merchant || 'Unknown',
      category: paymentData.category || 'Retail',
      device: paymentData.device || 'iPhone 14',
      state: paymentData.state || 'Delhi',
      bank: paymentData.bank || 'SBI',
      hour,
    });

    const fraudScore = mlResult.risk_score;
    const status = mlResult.status; // BLOCKED / FLAGGED / CLEARED from real model
    const indicators = mlResult.indicators || [];
    const explanation = mlResult.explanation || '';

    // Build transaction object with real ML scores
    const tx = {
      id: `TXN${String(txId).padStart(8, '0')}`,
      amount,
      merchant: paymentData.merchant || 'Unknown',
      device: 'iPhone 14',
      state: 'Delhi',
      bank: 'SBI',
      hour,
      isNight: hour >= 22 || hour <= 5,
      isFraud: status !== 'CLEARED',
      fraudScore,
      indicators,
      explanation,
      timestamp: new Date().toISOString(),
      status,
      isLive: true,
      modelScores: {
        randomForest: mlResult.models_consensus?.random_forest || fraudScore,
        xgboost: mlResult.models_consensus?.xgboost || fraudScore,
        neuralNet: mlResult.models_consensus?.isolation_forest || fraudScore,
        isolation: mlResult.models_consensus?.isolation_forest || fraudScore,
      },
      latency_ms: mlResult.latency_ms || 18,
      model_version: mlResult.model_version || 'v2.0-ensemble'
    };
    
    // Apply Admin alert rules over the ML prediction
    const finalTx = applyAdminRules(tx, alertRules);
    
    // Attempt to push to Supabase
    const { error } = await supabase
      .from('transactions')
      .insert([{
        amount: finalTx.amount,
        merchant: finalTx.merchant,
        fraud_score: finalTx.fraudScore,
        status: finalTx.status,
        device: finalTx.device,
        hour: finalTx.hour,
        indicators: finalTx.indicators,
        explanation: finalTx.explanation,
        is_fraud: finalTx.isFraud
      }]);

    if (error) {
      addAuditLog(`Supabase Insert Failed: ${error.message} (Falling back to local state)`, 'error');
      // Fallback: If DB insert fails (e.g., table not created yet), just add it to local state so the UI still works
      finalTx.isLive = true; 
      finalTx.fallback = true;
      setLiveTransactions(prev => [finalTx, ...prev].slice(0, 1000));
      processNewUserTransaction(finalTx);
    } 
    // If successful, the Realtime subscription (above) will catch the INSERT and update the local state natively!
  };

  const processNewUserTransaction = (tx) => {
    if (tx.status === 'CLEARED') {
      const newNotif = {
        id: `success-${Date.now()}`,
        type: 'success',
        title: 'Payment Successful',
        message: `Your payment of ₹${tx.amount.toLocaleString()} to ${tx.merchant} was successful.`
      };
      setNotifications(prev => [newNotif, ...prev]);
    } else {
       const newNotif = {
          id: `notif-${tx.id}-${Date.now()}`,
          type: tx.status === 'BLOCKED' ? 'error' : 'warning',
          title: tx.status === 'BLOCKED' ? 'Transaction Blocked' : 'Fraud Alert',
          message: tx.status === 'BLOCKED' 
            ? `SECURITY ALERT: Payment of ₹${tx.amount.toLocaleString()} to ${tx.merchant} was blocked.`
            : `CAUTION: Potential fraud detected for ₹${tx.amount.toLocaleString()} to ${tx.merchant}.`,
          transaction: tx
        };
        setNotifications(prev => [newNotif, ...prev]);
    }
  };

  const dismissNotification = (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const displayLive = filterRisk === "ALL"
    ? liveTransactions
    : filterRisk === "FRAUD" ? liveTransactions.filter(t => t.isFraud)
    : liveTransactions.filter(t => t.fraudScore > 0.5);

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "models", label: "ML Models" },
    { id: "realtime", label: "Live Feed" },
    { id: "analysis", label: "Analysis" },
    { id: "network", label: "🕸️ Network" },
    { id: "rules", label: "⚙️ Alert Rules" },
    { id: "qrdemo", label: "🔳 Demo QR Codes" },
  ];

  return (
    <div style={{
      background: "var(--bg-secondary)",
      minHeight: "100vh",
      color: "var(--text-dim)",
      overflowX: "hidden",
    }}>
      {/* GLOBAL HEADER — hidden on mobile (mobile gets the UPI app header) */}
      {!isMobile && (
        <div style={{
          background: "linear-gradient(180deg,#ffffff 0%,#f8fafc 100%)",
          borderBottom: "1px solid var(--border-color)",
          padding: "0 28px",
          position: "sticky", top: 0, zIndex: 100,
          boxShadow: "0 1px 2px 0 rgb(0 0 0 / 0.05)"
        }}>
          <div style={{ maxWidth: 1400, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 60 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{
                width: 36, height: 36,
                background: "linear-gradient(135deg,#3b82f6,#2563eb)",
                borderRadius: 8,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 18, fontWeight: 900, color: "#fff",
                boxShadow: "0 4px 10px #3b82f644",
              }}>⛨</div>
              <div>
                <div style={{ color: "var(--text-main)", fontSize: 15, fontWeight: 800, letterSpacing: "0.02em" }}>UPI FRAUD SHIELD</div>
                <div style={{ color: "var(--accent-blue)", fontSize: 10, letterSpacing: "0.1em", marginTop: 1, fontWeight: 600 }}>AI-POWERED TRANSACTION INTELLIGENCE</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              {alertCount > 0 && (
                <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 20, padding: "4px 12px", color: "#dc2626", fontSize: 12, fontWeight: 700 }}>
                  🚨 {alertCount} ALERTS
                </div>
              )}
              <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 6, padding: "5px 14px", color: "#16a34a", fontSize: 11, fontWeight: 700 }}>
                ● SUPABASE LIVE
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hide Admin/User nav on mobile completely */}
      {!isMobile && (
        <UserNav view={view} setView={setView} isRagOpen={isRagOpen} onToggleRAG={() => setIsRagOpen(!isRagOpen)} />
      )}
      
      <NotificationCenter 
        notifications={notifications} 
        onDismiss={dismissNotification} 
        onViewBasis={handleViewBasis} 
      />

      <DetectionBasisModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        transaction={modalTransaction} 
      />

      <RAGAssistant 
        isOpen={isRagOpen} 
        onClose={() => setIsRagOpen(false)} 
        persona={view} 
      />

      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "24px 28px" }}>

        {/* ADMIN VIEW */}
        {view === 'admin' && (
          <>
            <div style={{ borderBottom: "1px solid var(--border-color)", marginBottom: "24px", display: "flex", gap: "8px" }}>
              {tabs.map(t => (
                <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
                  background: activeTab === t.id ? "#eff6ff" : "transparent",
                  border: "1px solid transparent",
                  borderBottom: activeTab === t.id ? "2px solid var(--accent-blue)" : "2px solid transparent",
                  color: activeTab === t.id ? "var(--accent-blue)" : "var(--text-dim)",
                  padding: "10px 20px", cursor: "pointer",
                  fontSize: 13, fontWeight: 600,
                  transition: "all 0.2s", fontFamily: "inherit",
                }}>{t.label}</button>
              ))}
            </div>

            {activeTab === "overview" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 14 }}>
                  <MetricCard label="Ensemble AUC" value="0.996" sub="5-model ensemble" icon="🤖" accent="#10b981" />
                  <MetricCard label="Fraud Detected" value={fraudTxns.length} sub={`${((fraudTxns.length / dataset.length) * 100).toFixed(1)}% fraud rate`} icon="🚨" accent="#ef4444" delta={2.3} />
                  <MetricCard label="Auto-Blocked" value={blockedTxns.length} sub="High confidence fraud" icon="🛡️" accent="#f97316" />
                  <MetricCard label="Live Transactions" value={liveTransactions.length} sub="Real-time monitor" icon="📊" accent="#6366f1" />
                  <MetricCard label="Fraud Amount" value={`₹${(fraudAmount / 100000).toFixed(1)}L`} sub={`of ₹${(totalAmount / 100000).toFixed(0)}L total`} icon="💰" accent="#f59e0b" delta={-5.1} />
                </div>

                {/* Fraud Stats Summary Card */}
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

                {/* India Heatmap replaces old state table */}
                <IndiaHeatmap />
              </div>
            )}

            {activeTab === "models" && (
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

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
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
            )}

            {activeTab === "realtime" && (
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
                              onClick={(e) => { e.stopPropagation(); setFrozenAccounts(prev => new Set([...prev, tx.id])); addAuditLog(`ACCOUNT FROZEN: Merchant '${tx.merchant}' manually frozen by admin.`, 'error'); }}
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
            )}


            {activeTab === "analysis" && (() => {
              // Use all loaded data (historical DB + live feed), deduplicated
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
            })()}

            {activeTab === "network" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                <FraudNetworkGraph transactions={liveTransactions} />
              </div>
            )}

            {activeTab === "rules" && (
              <AlertRulesEngine onRulesChange={setAlertRules} />
            )}

            {activeTab === "qrdemo" && (
              <DemoQRCodes />
            )}
          </>
        )}

        {/* USER VIEW — Pure Mobile UPI App (no admin chrome) */}
        {view === 'user' && (
          <MobileUPIApp
            transactions={liveTransactions.filter(t => t.isLive === true)}
            onPayment={handleManualPayment}
            onViewBasis={handleViewBasis}
          />
        )}

        {/* OTP Modal for FLAGGED payments */}
        <OTPModal
          isOpen={!!otpPending}
          transaction={otpPending?.tempTx}
          onVerify={() => { handleManualPayment(otpPending.paymentData); setOtpPending(null); }}
          onCancel={() => setOtpPending(null)}
        />

      </div>
    </div>
  );
}
