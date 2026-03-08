import React, { useState, useMemo } from 'react';
import {
  Send, QrCode, CreditCard, ChevronRight, Eye, EyeOff,
  Shield, ShieldCheck, AlertTriangle, ArrowUpRight, ArrowDownLeft,
  Home, Clock, BarChart2, User, Wallet, Bell, Settings
} from 'lucide-react';
import QRScannerModal from './QRScannerModal';
import UserRiskProfile from './UserRiskProfile';

// ─── Helper ──────────────────────────────────────────────────────────────────
const fmt = (n) => `₹${Number(n).toLocaleString('en-IN')}`;
const ACCENT = '#1a73e8'; // Google blue

const getMerchantIcon = (merchant = '') => {
  const m = merchant.toLowerCase();
  if (m.includes('amazon') || m.includes('flipkart') || m.includes('shop') || m.includes('commerce')) return '🛒';
  if (m.includes('uber') || m.includes('ola') || m.includes('travel') || m.includes('rail')) return '🚕';
  if (m.includes('zomato') || m.includes('swiggy') || m.includes('food') || m.includes('dining')) return '🍕';
  if (m.includes('netflix') || m.includes('hotstar') || m.includes('spotify')) return '🎬';
  if (m.includes('electric') || m.includes('util') || m.includes('broadband')) return '💡';
  if (m.includes('pharma') || m.includes('health') || m.includes('hospital')) return '🏥';
  if (m.includes('school') || m.includes('educat') || m.includes('univ')) return '🎓';
  if (m.includes('blocked') || m.includes('scam') || m.includes('fraud')) return '🚫';
  return '💳';
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const TabBar = ({ active, setActive }) => {
  const tabs = [
    { id: 'home', icon: <Home size={20} />, label: 'Home' },
    { id: 'history', icon: <Clock size={20} />, label: 'History' },
    { id: 'safety', icon: <Shield size={20} />, label: 'Safety' },
    { id: 'profile', icon: <User size={20} />, label: 'Profile' },
  ];
  return (
    <div style={{
      position: 'sticky', bottom: 0, background: 'white', borderTop: '1px solid #e8eaed',
      display: 'flex', justifyContent: 'space-around', padding: '8px 0 4px', zIndex: 10
    }}>
      {tabs.map(t => (
        <button key={t.id} onClick={() => setActive(t.id)} style={{
          background: 'none', border: 'none', padding: '4px 12px', cursor: 'pointer',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
          color: active === t.id ? ACCENT : '#9aa0a6', transition: 'color 0.2s'
        }}>
          {t.icon}
          <span style={{ fontSize: 10, fontWeight: active === t.id ? 700 : 500 }}>{t.label}</span>
        </button>
      ))}
    </div>
  );
};

// Send Money Modal
const SendMoneyModal = ({ onClose, onSend }) => {
  const [upi, setUpi] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const QUICK_CONTACTS = [
    { name: 'Arjun', upi: 'arjun.mehta@sbi', initials: 'AM', color: '#4285f4' },
    { name: 'Priya', upi: 'priya.sharma@upi', initials: 'PS', color: '#ea4335' },
    { name: 'Rahul', upi: 'rahul.k@hdfc', initials: 'RK', color: '#34a853' },
    { name: 'Sneha', upi: 'sneha.g@paytm', initials: 'SG', color: '#fbbc04' },
  ];
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'white', zIndex: 20, display: 'flex', flexDirection: 'column', borderRadius: 'inherit', overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f3f4', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#5f6368', padding: 4 }}>←</button>
        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#202124' }}>Send Money</h3>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
        {/* Quick contacts */}
        <div style={{ marginBottom: 24 }}>
          <p style={{ margin: '0 0 12px', fontSize: 12, color: '#5f6368', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Recent Contacts</p>
          <div style={{ display: 'flex', gap: 16 }}>
            {QUICK_CONTACTS.map(c => (
              <div key={c.name} onClick={() => setUpi(c.upi)} style={{ textAlign: 'center', cursor: 'pointer' }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: c.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800, fontSize: 16, marginBottom: 6, border: upi === c.upi ? `3px solid ${ACCENT}` : '3px solid transparent' }}>{c.initials}</div>
                <div style={{ fontSize: 11, color: '#202124', fontWeight: 600 }}>{c.name}</div>
              </div>
            ))}
          </div>
        </div>
        {/* UPI ID */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, color: '#5f6368', fontWeight: 600, display: 'block', marginBottom: 6 }}>UPI ID / Phone Number</label>
          <input value={upi} onChange={e => setUpi(e.target.value)} placeholder="name@upi or 9876543210" style={{ width: '100%', padding: '12px 14px', border: `2px solid ${upi ? ACCENT : '#e8eaed'}`, borderRadius: 12, fontSize: 15, outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s' }} />
        </div>
        {/* Amount */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, color: '#5f6368', fontWeight: 600, display: 'block', marginBottom: 6 }}>Amount</label>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 20, fontWeight: 700, color: '#202124' }}>₹</span>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" style={{ width: '100%', padding: '12px 14px 12px 32px', border: `2px solid ${amount ? ACCENT : '#e8eaed'}`, borderRadius: 12, fontSize: 24, fontWeight: 800, outline: 'none', boxSizing: 'border-box', color: '#202124' }} />
          </div>
          {/* Quick amounts */}
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            {[100, 500, 1000, 2000].map(a => (
              <button key={a} onClick={() => setAmount(String(a))} style={{ flex: 1, padding: '7px 0', border: `1px solid ${amount == a ? ACCENT : '#e8eaed'}`, borderRadius: 8, background: amount == a ? '#e8f0fe' : 'white', color: amount == a ? ACCENT : '#5f6368', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>+{a}</button>
            ))}
          </div>
        </div>
        {/* Note */}
        <div style={{ marginBottom: 24 }}>
          <label style={{ fontSize: 12, color: '#5f6368', fontWeight: 600, display: 'block', marginBottom: 6 }}>Add a Note (optional)</label>
          <input value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Dinner split" style={{ width: '100%', padding: '10px 14px', border: '1px solid #e8eaed', borderRadius: 12, fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
        </div>
        <button onClick={() => { if (upi && amount) { onSend({ merchant: upi, amount: parseFloat(amount), note }); onClose(); } }} disabled={!upi || !amount}
          style={{ width: '100%', background: upi && amount ? ACCENT : '#e8eaed', color: upi && amount ? 'white' : '#9aa0a6', border: 'none', borderRadius: 14, padding: '15px', fontSize: 16, fontWeight: 800, cursor: upi && amount ? 'pointer' : 'not-allowed', transition: 'all 0.2s' }}>
          Send Now →
        </button>
      </div>
    </div>
  );
};

// ─── Home Screen ──────────────────────────────────────────────────────────────
const HomeScreen = ({ transactions, onSend, onQR, onViewBasis }) => {
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [showSend, setShowSend] = useState(false);

  const balance = useMemo(() => {
    const cleared = transactions.filter(t => t.status === 'CLEARED').reduce((s, t) => s + (t.amount || 0), 0);
    return Math.max(24850, 50000 - (cleared % 30000));
  }, [transactions]);

  const recent = transactions.slice(0, 4);

  const quickActions = [
    { icon: <Send size={22} />, label: 'Send', color: '#1a73e8', onClick: () => setShowSend(true) },
    { icon: <QrCode size={22} />, label: 'Scan QR', color: '#34a853', onClick: onQR },
    { icon: <ArrowDownLeft size={22} />, label: 'Request', color: '#fbbc04', onClick: () => {} },
    { icon: <CreditCard size={22} />, label: 'Pay Bills', color: '#ea4335', onClick: () => {} },
  ];

  return (
    <div style={{ flex: 1, overflowY: 'auto', position: 'relative' }}>
      {showSend && <SendMoneyModal onClose={() => setShowSend(false)} onSend={(data) => { onSend(data); setShowSend(false); }} />}

      {/* Balance Card */}
      <div style={{ background: `linear-gradient(135deg, ${ACCENT} 0%, #1557b0 100%)`, padding: '24px 20px 28px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -20, right: -20, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.07)' }} />
        <div style={{ position: 'absolute', bottom: -30, left: -10, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Available Balance</div>
          <button onClick={() => setBalanceVisible(!balanceVisible)} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8, padding: '4px 8px', cursor: 'pointer', color: 'rgba(255,255,255,0.8)', display: 'flex', alignItems: 'center' }}>
            {balanceVisible ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
        <div style={{ fontSize: 36, fontWeight: 900, color: 'white', letterSpacing: '-0.02em', marginBottom: 4 }}>
          {balanceVisible ? fmt(balance) : '₹ ••••••'}
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>ananya.sharma@upi · SBI</div>
      </div>

      <div style={{ padding: '0 16px' }}>
        {/* Quick Actions */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, margin: '16px 0' }}>
          {quickActions.map(({ icon, label, color, onClick }) => (
            <button key={label} onClick={onClick} style={{ background: 'white', border: '1px solid #e8eaed', borderRadius: 16, padding: '14px 6px 10px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', transition: 'all 0.2s' }}
              onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <div style={{ width: 42, height: 42, borderRadius: '50%', background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color }}>{icon}</div>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#202124' }}>{label}</span>
            </button>
          ))}
        </div>

        {/* Offers Banner */}
        <div style={{ background: 'linear-gradient(135deg, #e8f5e9, #f1f8e9)', border: '1px solid #c8e6c9', borderRadius: 16, padding: '14px 16px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#1b5e20' }}>🎁 Cashback Offer</div>
            <div style={{ fontSize: 11, color: '#2e7d32', marginTop: 2 }}>Get ₹50 back on first 3 QR payments this week</div>
          </div>
          <ChevronRight size={18} color="#2e7d32" />
        </div>

        {/* Recent Activity */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: '#202124' }}>Recent Activity</span>
            <span style={{ fontSize: 12, color: ACCENT, fontWeight: 700, cursor: 'pointer' }}>See all</span>
          </div>
          {recent.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px 20px', color: '#9aa0a6', fontSize: 13 }}>No transactions yet</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {recent.map((tx) => (
                <div key={tx.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '12px 14px', borderRadius: 14, background: 'white',
                  border: `1px solid ${tx.status === 'BLOCKED' ? '#fca5a5' : '#f1f3f4'}`,
                  background: tx.status === 'BLOCKED' ? '#fff5f5' : 'white',
                  cursor: 'pointer', marginBottom: 4
                }} onClick={() => tx.status !== 'CLEARED' && onViewBasis(tx)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: tx.status === 'BLOCKED' ? '#fee2e2' : tx.status === 'FLAGGED' ? '#fef3c7' : '#e8f0fe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                      {getMerchantIcon(tx.merchant)}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#202124' }}>{tx.merchant || 'Unknown'}</div>
                      <div style={{ fontSize: 11, color: '#9aa0a6', marginTop: 1 }}>
                        {tx.status === 'BLOCKED' ? '🚫 Blocked' : tx.status === 'FLAGGED' ? '⚠️ Flagged' : '✅ Cleared'} · {new Date(tx.created_at || Date.now()).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: tx.status === 'BLOCKED' ? '#dc2626' : '#202124' }}>
                      {tx.status === 'BLOCKED' ? '−' : '−'}{fmt(tx.amount)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── History Screen ───────────────────────────────────────────────────────────
const HistoryScreen = ({ transactions, onViewBasis }) => {
  const grouped = useMemo(() => {
    const groups = {};
    transactions.slice(0, 30).forEach(tx => {
      const date = new Date(tx.created_at || tx.timestamp || Date.now());
      const key = date.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
      if (!groups[key]) groups[key] = { label: key, txns: [], total: 0 };
      groups[key].txns.push(tx);
      groups[key].total += tx.amount || 0;
    });
    return Object.values(groups);
  }, [transactions]);

  const totalSpent = transactions.slice(0, 30).filter(t => t.status === 'CLEARED').reduce((s, t) => s + (t.amount || 0), 0);
  const blocked = transactions.filter(t => t.status === 'BLOCKED').length;

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
      {/* Monthly summary */}
      <div style={{ background: 'linear-gradient(135deg, #1a73e8, #1557b0)', borderRadius: 20, padding: '20px', marginBottom: 20, color: 'white' }}>
        <div style={{ fontSize: 12, opacity: 0.7, fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>This Month</div>
        <div style={{ fontSize: 30, fontWeight: 900, letterSpacing: '-0.02em' }}>{fmt(totalSpent)}</div>
        <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>spent · {blocked} payments blocked by AI</div>
        <div style={{ display: 'flex', gap: 12, marginTop: 14 }}>
          {[
            { label: 'Cleared', val: transactions.filter(t => t.status === 'CLEARED').length, color: '#a8f0c6' },
            { label: 'Flagged', val: transactions.filter(t => t.status === 'FLAGGED').length, color: '#fde68a' },
            { label: 'Blocked', val: blocked, color: '#fca5a5' },
          ].map(({ label, val, color }) => (
            <div key={label} style={{ flex: 1, background: 'rgba(255,255,255,0.12)', borderRadius: 10, padding: '8px 10px', textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 900, color }}>{val}</div>
              <div style={{ fontSize: 10, opacity: 0.75 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Transaction Groups */}
      {grouped.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#9aa0a6', paddingTop: 40 }}>No transactions yet. Make a payment!</div>
      ) : grouped.map(group => (
        <div key={group.label} style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#5f6368', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{group.label}</span>
            <span style={{ fontSize: 12, color: '#9aa0a6' }}>{fmt(group.total)}</span>
          </div>
          {group.txns.map(tx => (
            <div key={tx.id} onClick={() => tx.status !== 'CLEARED' && onViewBasis(tx)} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '12px 0', borderBottom: '1px solid #f1f3f4', cursor: tx.status !== 'CLEARED' ? 'pointer' : 'default'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: tx.status === 'BLOCKED' ? '#fee2e2' : '#e8f0fe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                  {getMerchantIcon(tx.merchant)}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#202124' }}>{tx.merchant}</div>
                  <div style={{ fontSize: 11, color: '#9aa0a6' }}>
                    {tx.status === 'BLOCKED' ? '🚫 Blocked' : tx.status === 'FLAGGED' ? '⚠️ Flagged' : '✅'} · AI Score: {((tx.fraudScore || tx.fraud_score || 0) * 100).toFixed(0)}%
                  </div>
                </div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 800, color: tx.status === 'BLOCKED' ? '#dc2626' : '#202124' }}>
                {fmt(tx.amount)}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

// ─── Profile Screen ───────────────────────────────────────────────────────────
const ProfileScreen = () => {
  const menuItems = [
    { icon: '🏦', label: 'Linked Bank Accounts', sub: 'SBI Savings ••4521' },
    { icon: '🔔', label: 'Notifications', sub: 'All alerts enabled' },
    { icon: '🔒', label: 'Privacy & Security', sub: 'UPI PIN, Biometrics' },
    { icon: '📋', label: 'Transaction Limits', sub: '₹1,00,000 / day' },
    { icon: '🎁', label: 'Rewards & Cashback', sub: '340 points earned' },
    { icon: '❓', label: 'Help & Support', sub: 'FAQs, raise a dispute' },
  ];
  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      {/* Profile hero */}
      <div style={{ background: `linear-gradient(135deg, ${ACCENT}, #1557b0)`, padding: '28px 20px', textAlign: 'center' }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', margin: '0 auto 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, border: '3px solid rgba(255,255,255,0.4)' }}>👤</div>
        <div style={{ color: 'white', fontSize: 18, fontWeight: 800 }}>Ananya Sharma</div>
        <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 4 }}>ananya.sharma@upi</div>
        <div style={{ display: 'inline-block', background: 'rgba(255,255,255,0.15)', borderRadius: 20, padding: '4px 14px', color: 'rgba(255,255,255,0.9)', fontSize: 12, fontWeight: 700, marginTop: 10 }}>
          ✅ KYC Verified
        </div>
      </div>
      {/* Menu */}
      <div style={{ padding: '12px 16px' }}>
        {menuItems.map(({ icon, label, sub }) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: '1px solid #f1f3f4', cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <span style={{ fontSize: 22 }}>{icon}</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#202124' }}>{label}</div>
                <div style={{ fontSize: 11, color: '#9aa0a6', marginTop: 1 }}>{sub}</div>
              </div>
            </div>
            <ChevronRight size={16} color="#d1d5db" />
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Safety Screen ───────────────────────────────────────────────────────────
const SafetyScreen = ({ transactions }) => {
  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
      <div style={{ marginBottom: 8 }}>
        <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 800, color: '#202124' }}>Account Safety</h3>
        <p style={{ margin: 0, fontSize: 12, color: '#9aa0a6' }}>Your AI-powered fraud protection status</p>
      </div>
      
      {/* Safety badge */}
      <div style={{ background: 'linear-gradient(135deg, #e8f5e9, #c8e6c9)', border: '1px solid #a5d6a7', borderRadius: 16, padding: '16px 20px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#2e7d32', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ShieldCheck size={26} color="white" />
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#1b5e20' }}>AI Fraud Shield Active</div>
          <div style={{ fontSize: 12, color: '#2e7d32', marginTop: 2 }}>All transactions monitored in real-time</div>
        </div>
      </div>

      <UserRiskProfile transactions={transactions} />

      {/* Protection features */}
      <div style={{ marginTop: 16 }}>
        <h4 style={{ fontSize: 13, fontWeight: 800, color: '#202124', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Protection Features</h4>
        {[
          { icon: '🔍', title: 'ML Fraud Detection', desc: '5-model ensemble with 99.6% accuracy', on: true },
          { icon: '🌐', title: 'Network Analysis', desc: 'Detects fraud rings and merchant networks', on: true },
          { icon: '📍', title: 'Location Verification', desc: 'Geo-mismatch flagging enabled', on: true },
          { icon: '⚡', title: 'Velocity Protection', desc: 'Rate-limit alerts for rapid transactions', on: true },
          { icon: '🤖', title: 'Anomaly Detection', desc: 'Isolation Forest behavioral monitoring', on: true },
        ].map(({ icon, title, desc, on }) => (
          <div key={title} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f1f3f4' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 20 }}>{icon}</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#202124' }}>{title}</div>
                <div style={{ fontSize: 11, color: '#9aa0a6' }}>{desc}</div>
              </div>
            </div>
            <div style={{ width: 38, height: 22, borderRadius: 11, background: on ? '#34a853' : '#e8eaed', position: 'relative' }}>
              <div style={{ position: 'absolute', top: 2, left: on ? 18 : 2, width: 18, height: 18, borderRadius: '50%', background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.2s' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Main Mobile App ──────────────────────────────────────────────────────────
const MobileUPIApp = ({ transactions, onPayment, onViewBasis }) => {
  const [tab, setTab] = useState('home');
  const [qrOpen, setQrOpen] = useState(false);
  const [notifCount] = useState(2);

  const handleQRProceed = (data) => {
    onPayment(data);
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', background: '#f8f9fa', minHeight: '100vh' }}>
      {/* Container */}
      <div style={{
        width: '100%',
        maxWidth: '500px', // Centered on desktop, full width on mobile
        minHeight: '100vh',
        background: 'white',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        boxShadow: '0 0 20px rgba(0,0,0,0.05)'
      }}>
        {/* App Top Bar */}
        <div style={{ background: ACCENT, padding: '16px 20px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🛡️</div>
            <div>
              <div style={{ color: 'white', fontSize: 15, fontWeight: 800 }}>UPI Fraud Shield</div>
              <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10 }}>AI-Powered Payment Security</div>
            </div>
          </div>
          <div style={{ position: 'relative' }}>
            <Bell size={22} color="white" style={{ cursor: 'pointer' }} />
            {notifCount > 0 && <div style={{ position: 'absolute', top: -4, right: -4, width: 14, height: 14, borderRadius: '50%', background: '#ea4335', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 800, color: 'white' }}>{notifCount}</div>}
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', background: '#f8f9fa', display: 'flex', flexDirection: 'column' }}>
          {tab === 'home' && <HomeScreen transactions={transactions} onSend={onPayment} onQR={() => setQrOpen(true)} onViewBasis={onViewBasis} />}
          {tab === 'history' && <HistoryScreen transactions={transactions} onViewBasis={onViewBasis} />}
          {tab === 'safety' && <SafetyScreen transactions={transactions} />}
          {tab === 'profile' && <ProfileScreen />}
        </div>

        {/* Tab Bar */}
        <TabBar active={tab} setActive={setTab} />
      </div>

      {/* QR Scanner (full-page overlay) */}
      <QRScannerModal isOpen={qrOpen} onClose={() => setQrOpen(false)} onProceed={handleQRProceed} />
    </div>
  );
};

export default MobileUPIApp;
