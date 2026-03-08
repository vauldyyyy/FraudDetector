import React, { useState, useEffect } from 'react';
import { Shield, Smartphone, X, CheckCircle2, RefreshCw } from 'lucide-react';

const OTPModal = ({ isOpen, onVerify, onCancel, transaction }) => {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [timeLeft, setTimeLeft] = useState(30);
  const [shaking, setShaking] = useState(false);
  const [verified, setVerified] = useState(false);
  const VALID_OTP = "482916";

  useEffect(() => {
    if (!isOpen) { setOtp(['', '', '', '', '', '']); setTimeLeft(30); setVerified(false); return; }
    const timer = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(timer); onCancel(); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isOpen]);

  if (!isOpen || !transaction) return null;

  const handleInput = (val, idx) => {
    if (!/^\d*$/.test(val)) return;
    const newOtp = [...otp];
    newOtp[idx] = val.slice(-1);
    setOtp(newOtp);
    if (val && idx < 5) document.getElementById(`otp-${idx+1}`)?.focus();
  };

  const handleKeyDown = (e, idx) => {
    if (e.key === 'Backspace' && !otp[idx] && idx > 0) document.getElementById(`otp-${idx-1}`)?.focus();
  };

  const handleVerify = () => {
    const entered = otp.join('');
    if (entered.length < 6) return;
    if (entered === VALID_OTP) {
      setVerified(true);
      setTimeout(() => onVerify(), 800);
    } else {
      setShaking(true);
      setOtp(['', '', '', '', '', '']);
      document.getElementById('otp-0')?.focus();
      setTimeout(() => setShaking(false), 600);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000, padding: 20 }}>
      <div style={{
        background: 'white', borderRadius: '28px', padding: '36px', maxWidth: 420, width: '100%',
        boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.2)', animation: 'slideIn 0.3s ease-out',
        border: '1px solid var(--border-color)'
      }}>
        {verified ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <CheckCircle2 size={56} color="#16a34a" style={{ marginBottom: 16 }} />
            <h3 style={{ color: '#16a34a', fontSize: 22, fontWeight: 800, margin: 0 }}>Verified!</h3>
            <p style={{ color: 'var(--text-dim)', marginTop: 8 }}>Processing your payment...</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: 28 }}>
              <div style={{ width: 60, height: 60, background: '#eff6ff', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', border: '1px solid #bfdbfe' }}>
                <Smartphone size={28} color="var(--accent-blue)" />
              </div>
              <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: 'var(--text-main)' }}>OTP Verification</h3>
              <p style={{ margin: '8px 0 0', color: 'var(--text-dim)', fontSize: 14, lineHeight: 1.5 }}>
                This payment to <strong>{transaction.merchant}</strong> was flagged as suspicious. Enter the OTP sent to your registered mobile.
              </p>
            </div>

            {/* Amount Card */}
            <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 14, padding: '14px 18px', textAlign: 'center', marginBottom: 24 }}>
              <div style={{ color: '#92400e', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Amount to Pay</div>
              <div style={{ color: '#78350f', fontSize: 28, fontWeight: 900, fontFamily: 'monospace' }}>₹{(transaction.amount || 0).toLocaleString()}</div>
            </div>

            {/* OTP Boxes */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 20, animation: shaking ? 'shake 0.5s ease' : 'none' }}>
              {otp.map((digit, idx) => (
                <input
                  key={idx}
                  id={`otp-${idx}`}
                  type="text"
                  value={digit}
                  onChange={e => handleInput(e.target.value, idx)}
                  onKeyDown={e => handleKeyDown(e, idx)}
                  maxLength={1}
                  style={{
                    width: 46, height: 54, textAlign: 'center', fontSize: 24, fontWeight: 800,
                    border: `2px solid ${digit ? 'var(--accent-blue)' : 'var(--border-color)'}`,
                    borderRadius: 12, outline: 'none', background: digit ? '#eff6ff' : '#f8fafc',
                    color: 'var(--text-main)', transition: 'all 0.15s', cursor: 'text'
                  }}
                />
              ))}
            </div>

            {/* Timer */}
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <span style={{ color: timeLeft < 10 ? '#dc2626' : 'var(--text-dim)', fontSize: 13, fontWeight: 600 }}>
                OTP expires in {timeLeft}s
              </span>
            </div>

            <p style={{ textAlign: 'center', color: '#64748b', fontSize: 12, marginBottom: 20 }}>
              Demo OTP: <strong style={{ fontFamily: 'monospace', color: 'var(--accent-blue)' }}>482916</strong>
            </p>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={onCancel} style={{ flex: 1, padding: '12px', borderRadius: 12, border: '1px solid var(--border-color)', background: 'white', color: 'var(--text-dim)', cursor: 'pointer', fontWeight: 700, fontSize: 14 }}>
                Cancel
              </button>
              <button
                onClick={handleVerify}
                disabled={otp.join('').length < 6}
                style={{
                  flex: 2, padding: '12px', borderRadius: 12, border: 'none',
                  background: otp.join('').length === 6 ? 'var(--accent-blue)' : '#e2e8f0',
                  color: otp.join('').length === 6 ? 'white' : 'var(--text-dim)',
                  cursor: otp.join('').length === 6 ? 'pointer' : 'not-allowed',
                  fontWeight: 800, fontSize: 14, transition: 'all 0.2s'
                }}
              >
                Verify & Pay
              </button>
            </div>
          </>
        )}
      </div>
      <style>{`
        @keyframes shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-8px)} 75%{transform:translateX(8px)} }
      `}</style>
    </div>
  );
};

export default OTPModal;
