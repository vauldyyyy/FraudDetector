import React, { useEffect } from "react";

// Store & Hooks
import useStore from "./store/useStore";
import { useRealtimeTransactions, applyAdminRules } from "./hooks/useRealtimeTransactions";

// Components
import UserNav from "./components/UserNav";
import NotificationCenter from "./components/NotificationCenter";
import DetectionBasisModal from "./components/DetectionBasisModal";
import RAGAssistant from "./components/RAGAssistant";
import OTPModal from "./components/OTPModal";
import MobileUPIApp from "./components/MobileUPIApp";

// Feature Tabs
import OverviewTab from "./components/tabs/OverviewTab";
import ModelsTab from "./components/tabs/ModelsTab";
import RealtimeTab from "./components/tabs/RealtimeTab";
import AnalysisTab from "./components/tabs/AnalysisTab";
import FraudNetworkGraph from "./components/FraudNetworkGraph";
import AlertRulesEngine from "./components/AlertRulesEngine";
import ScamAnalyzer from "./components/ScamAnalyzer";
import BehavioralIntelligence from "./components/BehavioralIntelligence";
import DemoQRCodes from "./components/DemoQRCodes";

// API
import { predictFraud } from "./utils/data-engine";
import { supabase } from "./lib/supabase";

export default function App() {
  const { 
    isMobile, setIsMobile, 
    view, setView, 
    activeTab, setActiveTab,
    notifications, dismissNotification,
    isModalOpen, setIsModalOpen, modalTransaction, setModalTransaction,
    isRagOpen, setIsRagOpen,
    alertCount,
    liveTransactions, setLiveTransactions,
    otpPending, setOtpPending,
    alertRules, addAuditLog
  } = useStore();

  const { counterRef } = useRealtimeTransactions();

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (mobile && view === 'admin') setView('user');
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [setIsMobile, view, setView]);

  const handleViewBasis = (tx) => {
    setModalTransaction(tx);
    setIsModalOpen(true);
  };

  const handleManualPayment = async (paymentData) => {
    const txId = ++counterRef.current;
    const amount = parseFloat(paymentData.amount) || 500;
    const hour = new Date().getHours();

    const mlResult = await predictFraud({
      amount,
      merchant: paymentData.merchant || 'Unknown',
      category: paymentData.category || 'Retail',
      device: paymentData.device || 'iPhone 14',
      state: paymentData.state || 'Delhi',
      bank: paymentData.bank || 'SBI',
      hour,
    });

    const tx = {
      id: `TXN${String(txId).padStart(8, '0')}`,
      amount,
      merchant: paymentData.merchant || 'Unknown',
      device: 'iPhone 14',
      state: 'Delhi',
      bank: 'SBI',
      hour,
      isNight: hour >= 22 || hour <= 5,
      isFraud: mlResult.status !== 'CLEARED',
      fraudScore: mlResult.risk_score,
      indicators: mlResult.indicators || [],
      explanation: mlResult.explanation || '',
      timestamp: new Date().toISOString(),
      status: mlResult.status,
      isLive: true,
      modelScores: {
        randomForest: mlResult.models_consensus?.random_forest || mlResult.risk_score,
        xgboost: mlResult.models_consensus?.xgboost || mlResult.risk_score,
        neuralNet: mlResult.models_consensus?.isolation_forest || mlResult.risk_score,
        isolation: mlResult.models_consensus?.isolation_forest || mlResult.risk_score,
      },
      latency_ms: mlResult.latency_ms || 18,
      model_version: mlResult.model_version || 'v2.0-ensemble'
    };
    
    const finalTx = applyAdminRules(tx, alertRules);
    
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
      finalTx.isLive = true; 
      finalTx.fallback = true;
      setLiveTransactions((prev) => [finalTx, ...prev].slice(0, 1000));
      processNewUserTransaction(finalTx);
    } 
  };

  const processNewUserTransaction = (tx) => {
    if (tx.status === 'CLEARED') {
      useStore.getState().addNotification({
        id: `success-${Date.now()}`,
        type: 'success',
        title: 'Payment Successful',
        message: `Your payment of ₹${tx.amount.toLocaleString()} to ${tx.merchant} was successful.`
      });
    } else {
       useStore.getState().addNotification({
          id: `notif-${tx.id}-${Date.now()}`,
          type: tx.status === 'BLOCKED' ? 'error' : 'warning',
          title: tx.status === 'BLOCKED' ? 'Transaction Blocked' : 'Fraud Alert',
          message: tx.status === 'BLOCKED' 
            ? `SECURITY ALERT: Payment of ₹${tx.amount.toLocaleString()} to ${tx.merchant} was blocked.`
            : `CAUTION: Potential fraud detected for ₹${tx.amount.toLocaleString()} to ${tx.merchant}.`,
          transaction: tx
        });
    }
  };

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "models", label: "ML Models" },
    { id: "realtime", label: "Live Feed" },
    { id: "analysis", label: "Analysis" },
    { id: "network", label: "🕸️ Network" },
    { id: "rules", label: "⚙️ Alert Rules" },
    { id: "scam", label: "🔍 Scam Analyzer" },
    { id: "behavior", label: "🧠 Behavior" },
    { id: "qrdemo", label: "🔳 Demo QR Codes" },
  ];

  return (
    <div style={{ background: "var(--bg-secondary)", minHeight: "100vh", color: "var(--text-dim)", overflowX: "hidden" }}>
      {!isMobile && (
        <div style={{
          background: "linear-gradient(180deg,#ffffff 0%,#f8fafc 100%)",
          borderBottom: "1px solid var(--border-color)", padding: "0 28px",
          position: "sticky", top: 0, zIndex: 100, boxShadow: "0 1px 2px 0 rgb(0 0 0 / 0.05)"
        }}>
          <div style={{ maxWidth: 1400, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 60 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{
                width: 36, height: 36, background: "linear-gradient(135deg,#3b82f6,#2563eb)",
                borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 18, fontWeight: 900, color: "#fff", boxShadow: "0 4px 10px #3b82f644"
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

      {!isMobile && (
        <UserNav view={view} setView={setView} isRagOpen={isRagOpen} onToggleRAG={() => setIsRagOpen(!isRagOpen)} />
      )}
      
      <NotificationCenter notifications={notifications} onDismiss={dismissNotification} onViewBasis={handleViewBasis} />

      <DetectionBasisModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} transaction={modalTransaction} />

      <RAGAssistant isOpen={isRagOpen} onClose={() => setIsRagOpen(false)} persona={view} />

      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "24px 28px" }}>
        {view === 'admin' && (
          <>
            <div style={{ borderBottom: "1px solid var(--border-color)", marginBottom: "24px", display: "flex", gap: "8px" }}>
              {tabs.map(t => (
                <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
                  background: activeTab === t.id ? "#eff6ff" : "transparent",
                  border: "1px solid transparent",
                  borderBottom: activeTab === t.id ? "2px solid var(--accent-blue)" : "2px solid transparent",
                  color: activeTab === t.id ? "var(--accent-blue)" : "var(--text-dim)",
                  padding: "10px 20px", cursor: "pointer", fontSize: 13, fontWeight: 600,
                  transition: "all 0.2s", fontFamily: "inherit",
                }}>{t.label}</button>
              ))}
            </div>

            {activeTab === "overview" && <OverviewTab />}
            {activeTab === "models" && <ModelsTab />}
            {activeTab === "realtime" && <RealtimeTab />}
            {activeTab === "analysis" && <AnalysisTab />}
            {activeTab === "network" && <div style={{ display: "flex", flexDirection: "column", gap: 24 }}><FraudNetworkGraph transactions={liveTransactions} /></div>}
            {activeTab === "rules" && <AlertRulesEngine onRulesChange={(rules) => useStore.getState().setAlertRules(rules)} />}
            {activeTab === "scam" && <ScamAnalyzer />}
            {activeTab === "behavior" && <BehavioralIntelligence transactions={liveTransactions} />}
            {activeTab === "qrdemo" && <DemoQRCodes />}
          </>
        )}

        {/* USER VIEW */}
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
