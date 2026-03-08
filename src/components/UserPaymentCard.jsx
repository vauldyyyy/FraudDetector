import React, { useState } from 'react';
import { Smartphone, Send, ShieldCheck, AlertTriangle } from 'lucide-react';

const UserPaymentCard = ({ onPayment }) => {
  const [amount, setAmount] = useState("");
  const [recipient, setRecipient] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!amount || !recipient) return;
    
    setIsProcessing(true);
    setTimeout(() => {
      onPayment({ amount: parseFloat(amount), merchant: recipient });
      setAmount("");
      setRecipient("");
      setIsProcessing(false);
    }, 1200);
  };

  return (
    <div style={{
      maxWidth: "400px",
      margin: "40px auto",
      background: "var(--bg-primary)",
      border: "1px solid var(--border-color)",
      borderRadius: "24px",
      padding: "32px",
      boxShadow: "0 10px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
      position: "relative",
      overflow: "hidden"
    }}>
      {/* Phone Header Simulation */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "32px",
        color: "var(--text-dim)",
        fontSize: "12px",
        fontWeight: 500
      }}>
        <span>9:41 AM</span>
        <div style={{ display: "flex", gap: "6px" }}>
          <span>📶</span>
          <span>🔋</span>
        </div>
      </div>

      <div style={{ textAlign: "center", marginBottom: "32px" }}>
        <div style={{
          width: "64px",
          height: "64px",
          background: "linear-gradient(135deg, #3b82f6, #2563eb)",
          borderRadius: "18px",
          margin: "0 auto 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          boxShadow: "0 10px 20px rgba(37, 99, 235, 0.2)"
        }}>
          <Smartphone size={32} />
        </div>
        <h2 style={{ color: "var(--text-main)", margin: "0", fontSize: "22px", fontWeight: "800", letterSpacing: "-0.02em" }}>UPI Pay</h2>
        <p style={{ color: "var(--text-dim)", margin: "4px 0 0", fontSize: "14px" }}>Secure Digital Payments</p>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: "20px" }}>
          <label style={{ display: "block", color: "var(--text-dim)", fontSize: "12px", marginBottom: "8px", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.05em" }}>Recipient VPA / Merchant</label>
          <input 
            type="text" 
            placeholder="merchant@upi"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            style={{
              width: "100%",
              background: "var(--bg-secondary)",
              border: "1px solid var(--border-color)",
              borderRadius: "12px",
              padding: "14px 16px",
              color: "var(--text-main)",
              fontSize: "16px",
              fontWeight: 500,
              outline: "none",
              boxSizing: "border-box",
              transition: "border-color 0.2s"
            }}
          />
        </div>

        <div style={{ marginBottom: "32px" }}>
          <label style={{ display: "block", color: "var(--text-dim)", fontSize: "12px", marginBottom: "8px", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.05em" }}>Amount (₹)</label>
          <div style={{ position: "relative" }}>
             <span style={{ position: "absolute", left: "16px", top: "50%", transform: "translateY(-50%)", color: "var(--text-main)", fontSize: "22px", fontWeight: 600 }}>₹</span>
             <input 
              type="number" 
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              style={{
                width: "100%",
                background: "var(--bg-secondary)",
                border: "1px solid var(--border-color)",
                borderRadius: "12px",
                padding: "14px 16px 14px 40px",
                color: "var(--text-main)",
                fontSize: "24px",
                fontWeight: "700",
                outline: "none",
                boxSizing: "border-box",
                transition: "border-color 0.2s"
              }}
            />
          </div>
        </div>

        <button 
          disabled={isProcessing}
          style={{
            width: "100%",
            background: isProcessing ? "#e2e8f0" : "var(--accent-blue)",
            color: isProcessing ? "var(--text-dim)" : "white",
            border: "none",
            borderRadius: "14px",
            padding: "16px",
            fontSize: "16px",
            fontWeight: "700",
            cursor: isProcessing ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "10px",
            transition: "all 0.2s",
            boxShadow: isProcessing ? "none" : "0 4px 12px rgba(37, 99, 235, 0.3)"
          }}
        >
          {isProcessing ? (
            "Encrypting..."
          ) : (
            <>Proceed to Pay <Send size={18} /></>
          )}
        </button>
      </form>

      <div style={{
        marginTop: "24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "8px",
        color: "var(--accent-green)",
        fontSize: "12px",
        fontWeight: 600
      }}>
        <ShieldCheck size={14} /> Powered by AI Fraud Shield
      </div>
    </div>
  );
};

export default UserPaymentCard;
