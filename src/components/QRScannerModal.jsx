import React, { useState, useEffect, useRef } from 'react';
import { X, Camera, ShieldCheck, ShieldX, RefreshCw, ArrowRight, AlertTriangle, Zap } from 'lucide-react';
import { predictFraud } from '../utils/data-engine';
import { analyzeMerchant } from '../utils/MerchantIntelligence';

// ─── Parse UPI URL from QR scan ───────────────────────────────────────────────
function parseUPIString(raw) {
  try {
    // Handle upi://pay?pa=...&pn=...&am=...
    let url;
    if (raw.startsWith('upi://')) {
      url = new URL(raw.replace('upi://', 'https://upi.dummy/'));
    } else if (raw.includes('@')) {
      // Raw UPI ID (e.g. "someone@oksbi")
      return { pa: raw.trim(), pn: raw.split('@')[0], am: null };
    } else {
      return null;
    }
    return {
      pa: url.searchParams.get('pa') || '',
      pn: url.searchParams.get('pn') || '',
      am: url.searchParams.get('am') ? parseFloat(url.searchParams.get('am')) : null,
    };
  } catch {
    return null;
  }
}

// ─── Scanning Screen (camera) ──────────────────────────────────────────────────
const CameraScanner = ({ onDetected, onError }) => {
  const divRef = useRef(null);
  const scannerRef = useRef(null);
  const [status, setStatus] = useState('starting'); // 'starting' | 'scanning' | 'error'
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    let mounted = true;

    const startScanner = async () => {
      try {
        // Dynamic import to avoid SSR issues
        const { Html5Qrcode } = await import('html5-qrcode');
        if (!mounted || !divRef.current) return;

        const scanner = new Html5Qrcode('qr-scan-region');
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: 'environment' }, // rear camera by default
          { fps: 10, qrbox: { width: 220, height: 220 }, aspectRatio: 1 },
          (decoded) => {
            if (!mounted) return;
            onDetected(decoded);
          },
          () => {} // ignore non-QR frames
        );
        if (mounted) setStatus('scanning');
      } catch (err) {
        if (!mounted) return;
        const msg = err?.message || String(err);
        if (msg.includes('permission') || msg.includes('NotAllowed')) {
          setErrorMsg('Camera permission denied. Please allow camera access and try again.');
        } else if (msg.includes('NotFound') || msg.includes('no camera')) {
          setErrorMsg('No camera found on this device. Use the Demo QR tab instead.');
        } else {
          setErrorMsg(`Camera error: ${msg}`);
        }
        setStatus('error');
        onError && onError(msg);
      }
    };

    startScanner();

    return () => {
      mounted = false;
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
        scannerRef.current = null;
      }
    };
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      {/* Camera viewport */}
      <div style={{ position: 'relative', width: 280, height: 280 }}>
        {/* Corner frame */}
        {[{top:0,left:0},{top:0,right:0},{bottom:0,left:0},{bottom:0,right:0}].map((pos,i)=>(
          <div key={i} style={{
            position:'absolute', width:32, height:32, ...pos,
            borderTop: pos.top===0 ? '3px solid #3b82f6' : 'none',
            borderBottom: pos.bottom===0 ? '3px solid #3b82f6' : 'none',
            borderLeft: pos.left===0 ? '3px solid #3b82f6' : 'none',
            borderRight: pos.right===0 ? '3px solid #3b82f6' : 'none',
          }} />
        ))}

        {/* html5-qrcode mounts here */}
        <div id="qr-scan-region" style={{
          width: '100%', height: '100%', borderRadius: 12, overflow: 'hidden',
          background: status === 'error' ? '#1a1a2e' : 'black'
        }} />

        {status === 'starting' && (
          <div style={{
            position:'absolute', inset:0, display:'flex', flexDirection:'column',
            alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.8)', borderRadius:12
          }}>
            <RefreshCw size={32} color="#3b82f6" style={{animation:'spin 1s linear infinite'}} />
            <span style={{color:'rgba(255,255,255,0.7)', fontSize:13, marginTop:12}}>Starting camera…</span>
          </div>
        )}

        {status === 'error' && (
          <div style={{
            position:'absolute', inset:0, display:'flex', flexDirection:'column',
            alignItems:'center', justifyContent:'center', padding:16, borderRadius:12, background:'#1a1a2e'
          }}>
            <Camera size={32} color="#ef4444" style={{marginBottom:12}} />
            <p style={{color:'#fca5a5', fontSize:12, textAlign:'center', margin:0}}>{errorMsg}</p>
          </div>
        )}
      </div>

      {status === 'scanning' && (
        <p style={{color:'rgba(255,255,255,0.55)', fontSize:12, textAlign:'center', margin:0}}>
          Point camera at any UPI QR code. It will auto-detect.
        </p>
      )}
    </div>
  );
};

// ─── Analysis Screen ──────────────────────────────────────────────────────────
const AnalyzingScreen = ({ vpa, merchantName }) => (
  <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:20,padding:'20px 0'}}>
    <div style={{
      width:80,height:80,borderRadius:'50%',
      background:'linear-gradient(135deg,#1e3a5f,#2563eb)',
      display:'flex',alignItems:'center',justifyContent:'center',
      boxShadow:'0 0 40px rgba(59,130,246,0.4)',
      animation:'pulse 1.2s ease-in-out infinite'
    }}>
      <Zap size={36} color="white" />
    </div>
    <div style={{textAlign:'center'}}>
      <div style={{color:'white',fontWeight:800,fontSize:18,marginBottom:6}}>Analyzing with AI…</div>
      <div style={{color:'rgba(255,255,255,0.6)',fontSize:13}}>{merchantName || vpa}</div>
    </div>
    <div style={{display:'flex',flexDirection:'column',gap:8,width:'100%',maxWidth:280}}>
      {['Running ML ensemble models…','Checking fraud database…','Analyzing transaction patterns…'].map((s,i)=>(
        <div key={i} style={{
          display:'flex',alignItems:'center',gap:10,
          background:'rgba(255,255,255,0.08)',borderRadius:10,padding:'10px 14px'
        }}>
          <RefreshCw size={14} color="#60a5fa" style={{animation:`spin ${0.8+i*0.2}s linear infinite`,flexShrink:0}} />
          <span style={{color:'rgba(255,255,255,0.7)',fontSize:12}}>{s}</span>
        </div>
      ))}
    </div>
    <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}} @keyframes pulse{0%,100%{box-shadow:0 0 20px rgba(59,130,246,0.4)}50%{box-shadow:0 0 60px rgba(59,130,246,0.7)}}`}</style>
  </div>
);

// ─── Result Screen ────────────────────────────────────────────────────────────
const ResultCard = ({ result, amount, onProceed, onBack, onClose }) => {
  const { merchant, mlScore, status, indicators, merchantInfo } = result;
  const isBlocked = status === 'BLOCKED' || status === 'FLAGGED';
  const safeColor = '#16a34a';
  const dangerColor = '#dc2626';
  const color = isBlocked ? dangerColor : safeColor;

  return (
    <div style={{background:'white',borderRadius:28,padding:28,maxWidth:360,width:'90%',textAlign:'center',animation:'slideUp 0.3s ease-out'}}>
      {/* Icon */}
      <div style={{
        width:80,height:80,borderRadius:'50%',margin:'0 auto 16px',
        background: isBlocked ? '#fef2f2' : '#f0fdf4',
        border:`3px solid ${color}`,
        display:'flex',alignItems:'center',justifyContent:'center',fontSize:36
      }}>
        {isBlocked ? '🚨' : '✅'}
      </div>

      <h3 style={{margin:'0 0 4px',fontSize:20,fontWeight:900,color}}>
        {isBlocked ? (status === 'FLAGGED' ? '⚠️ High Risk Detected' : '🚫 Payment Blocked') : '✅ Merchant Verified Safe'}
      </h3>
      <p style={{margin:'0 0 20px',fontSize:13,color:'#64748b'}}>{merchant}</p>

      {/* Merchant card */}
      <div style={{background:'#f8fafc',borderRadius:14,padding:'14px 16px',marginBottom:16,textAlign:'left',border:'1px solid #e2e8f0'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
          <div>
            <div style={{fontSize:15,fontWeight:800,color:'#1e293b'}}>
              {merchantInfo?.icon || (isBlocked ? '⚠️' : '💳')} {merchantInfo?.name || merchant.split('@')[0]}
            </div>
            <div style={{fontSize:12,color:'#64748b'}}>{merchantInfo?.category || 'UPI Merchant'}</div>
          </div>
          <div style={{textAlign:'right'}}>
            <div style={{fontSize:11,color:'#64748b',fontWeight:600}}>AI Score</div>
            <div style={{fontSize:22,fontWeight:900,color}}>{Math.round(mlScore * 100)}%</div>
          </div>
        </div>

        {/* Trust bar */}
        <div style={{height:6,background:'#e2e8f0',borderRadius:3,overflow:'hidden',marginBottom:8}}>
          <div style={{
            height:'100%',
            width:`${mlScore*100}%`,
            background: mlScore > 0.7 ? dangerColor : mlScore > 0.4 ? '#f59e0b' : safeColor,
            borderRadius:3, transition:'width 0.8s ease-out'
          }} />
        </div>

        {merchantInfo?.knownFraud && (
          <div style={{background:'#fef2f2',borderRadius:8,padding:'8px 12px',border:'1px solid #fca5a5',marginBottom:8}}>
            <div style={{fontSize:11,fontWeight:700,color:dangerColor}}>
              🚨 {merchantInfo.reportCount} FRAUD REPORTS — {merchantInfo.fraudType}
            </div>
          </div>
        )}
        {merchantInfo?.knownSafe && (
          <div style={{background:'#f0fdf4',borderRadius:8,padding:'8px 12px',border:'1px solid #bbf7d0'}}>
            <div style={{fontSize:11,fontWeight:700,color:safeColor}}>
              ✅ Verified merchant · Trust Score: {merchantInfo.trustScore}/100
            </div>
          </div>
        )}
      </div>

      {/* Indicators */}
      {indicators && indicators.length > 0 && (
        <div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:20,textAlign:'left'}}>
          {indicators.slice(0,4).map((ind, i) => (
            <div key={i} style={{
              fontSize:12,color:'#475569',background:'#f8fafc',
              border:'1px solid #e2e8f0',borderRadius:8,padding:'7px 12px',fontWeight:500
            }}>
              {isBlocked ? '🚩' : '✅'} {ind.replace(/_/g,' ').replace(/\b\w/g,l=>l.toUpperCase())}
            </div>
          ))}
        </div>
      )}

      {/* Amount */}
      {amount > 0 && (
        <div style={{
          background: isBlocked ? '#fef2f2' : '#f0fdf4',
          borderRadius:12,padding:'10px 16px',marginBottom:20,
          border:`1px solid ${isBlocked ? '#fca5a5' : '#bbf7d0'}`
        }}>
          <span style={{fontSize:13,color:'#64748b',fontWeight:600}}>Payment Amount: </span>
          <span style={{fontSize:16,fontWeight:900,color}}> ₹{amount.toLocaleString('en-IN')}</span>
        </div>
      )}

      {/* Actions */}
      <div style={{display:'flex',gap:10}}>
        <button onClick={onBack} style={{flex:1,padding:'12px',borderRadius:12,border:'1px solid #e2e8f0',background:'white',color:'#64748b',cursor:'pointer',fontWeight:700,fontSize:13}}>
          ← Scan Again
        </button>
        {!isBlocked ? (
          <button onClick={onProceed} style={{flex:2,padding:'12px',borderRadius:12,border:'none',background:safeColor,color:'white',cursor:'pointer',fontWeight:800,fontSize:14,display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
            Pay {amount > 0 ? `₹${amount.toLocaleString('en-IN')}` : 'Now'} <ArrowRight size={16} />
          </button>
        ) : (
          <button onClick={onClose} style={{flex:2,padding:'12px',borderRadius:12,border:'none',background:dangerColor,color:'white',cursor:'pointer',fontWeight:800,fontSize:14}}>
            🚫 Block & Report
          </button>
        )}
      </div>
    </div>
  );
};

// ─── Manual UPI ID Entry ──────────────────────────────────────────────────────
const ManualEntry = ({ onSubmit }) => {
  const [upi, setUpi] = useState('');
  const [amt, setAmt] = useState('500');
  const DEMO = [
    { label: '✅ Amazon', vpa: 'amazon@amazonpay', amt: 499 },
    { label: '✅ Swiggy', vpa: 'swiggy@icici', amt: 249 },
    { label: '🚫 Prize Scam', vpa: 'winner.prize@upi', amt: 5000 },
    { label: '🚫 Tech Support', vpa: 'helpdesk.tech@ybl', amt: 2000 },
    { label: '🚫 KYC Scam', vpa: 'kyc.update@upi', amt: 1 },
    { label: '👤 Friend (Rahul)', vpa: 'rahul.kumar@oksbi', amt: 200 },
  ];
  return (
    <div style={{display:'flex',flexDirection:'column',gap:12,padding:'0 4px'}}>
      <p style={{color:'rgba(255,255,255,0.5)',fontSize:11,textAlign:'center',margin:0,textTransform:'uppercase',letterSpacing:'0.06em'}}>Tap a demo or enter manually</p>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
        {DEMO.map(d => (
          <button key={d.vpa} onClick={() => { setUpi(d.vpa); setAmt(String(d.amt)); }}
            style={{
              background: upi === d.vpa ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.08)',
              border: `1px solid ${upi === d.vpa ? '#3b82f6' : 'rgba(255,255,255,0.15)'}`,
              borderRadius:10, padding:'10px 8px', color:'white', cursor:'pointer',
              fontSize:11, fontWeight:600, textAlign:'center', transition:'all 0.15s'
            }}>
            {d.label}<br/>
            <span style={{fontSize:9,color:'rgba(255,255,255,0.5)',fontFamily:'monospace'}}>{d.vpa.length > 18 ? d.vpa.slice(0,16)+'…' : d.vpa}</span>
          </button>
        ))}
      </div>
      <input value={upi} onChange={e=>setUpi(e.target.value)} placeholder="or type any UPI ID…"
        style={{background:'rgba(255,255,255,0.1)',border:'1px solid rgba(255,255,255,0.2)',borderRadius:10,padding:'10px 14px',color:'white',fontSize:14,outline:'none'}} />
      <div style={{display:'flex',gap:8,alignItems:'center'}}>
        <span style={{color:'rgba(255,255,255,0.6)',fontSize:18,fontWeight:700}}>₹</span>
        <input type="number" value={amt} onChange={e=>setAmt(e.target.value)} placeholder="Amount"
          style={{flex:1,background:'rgba(255,255,255,0.1)',border:'1px solid rgba(255,255,255,0.2)',borderRadius:10,padding:'10px 14px',color:'white',fontSize:14,outline:'none'}} />
      </div>
      <button onClick={() => upi && onSubmit(upi, parseFloat(amt)||0)}
        disabled={!upi}
        style={{
          padding:'14px',borderRadius:12,border:'none',
          background: upi ? '#3b82f6' : 'rgba(255,255,255,0.15)',
          color:'white',cursor: upi ? 'pointer' : 'not-allowed',
          fontWeight:800,fontSize:15
        }}>
        Analyze Payment →
      </button>
    </div>
  );
};


// ─── Main Modal ───────────────────────────────────────────────────────────────
const QRScannerModal = ({ isOpen, onClose, onProceed }) => {
  const [tab, setTab] = useState('camera'); // 'camera' | 'manual'
  const [phase, setPhase] = useState('scan'); // 'scan' | 'analyzing' | 'result'
  const [pendingVPA, setPendingVPA] = useState(null);
  const [pendingAmount, setPendingAmount] = useState(0);
  const [result, setResult] = useState(null);
  const detectedRef = useRef(false);

  // Reset on open/close
  useEffect(() => {
    if (!isOpen) {
      setPhase('scan');
      setResult(null);
      setPendingVPA(null);
      detectedRef.current = false;
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDetected = async (rawText) => {
    if (detectedRef.current) return; // prevent double-fire
    detectedRef.current = true;

    const parsed = parseUPIString(rawText);
    if (!parsed || !parsed.pa) {
      detectedRef.current = false;
      return;
    }

    const vpa = parsed.pa;
    const amt = parsed.am || pendingAmount || 0;
    setPendingVPA(vpa);
    setPendingAmount(amt);
    setPhase('analyzing');

    // Get merchant intelligence
    const merchantInfo = analyzeMerchant(vpa, amt);

    // Call ML API
    let mlResult;
    try {
      const hour = new Date().getHours();
      mlResult = await predictFraud({
        amount: amt || 500,
        hour,
        merchant: merchantInfo?.name || vpa,
        category: merchantInfo?.category || 'Unknown',
        bank: 'SBI',
        device: 'Mobile',
        isNight: hour >= 22 || hour <= 5,
      });
    } catch {
      mlResult = { risk_score: merchantInfo?.riskBoost > 0.3 ? 0.85 : 0.15, status: merchantInfo?.riskBoost > 0.3 ? 'BLOCKED' : 'CLEARED', indicators: [] };
    }

    // Merge ML score with merchant intelligence boost
    let finalScore = parseFloat(mlResult.risk_score || mlResult.fraud_score || 0.15);
    if (merchantInfo?.riskBoost) finalScore = Math.min(0.99, Math.max(0.01, finalScore + merchantInfo.riskBoost));
    if (merchantInfo?.knownFraud) finalScore = Math.max(finalScore, 0.88);
    if (merchantInfo?.knownSafe) finalScore = Math.min(finalScore, 0.15);

    const finalStatus = finalScore > 0.75 ? 'BLOCKED' : finalScore > 0.45 ? 'FLAGGED' : 'CLEARED';

    setResult({
      merchant: vpa,
      mlScore: finalScore,
      status: finalStatus,
      indicators: mlResult.indicators || [],
      merchantInfo: merchantInfo,
    });
    setPhase('result');
  };

  const handleManualSubmit = (vpa, amount) => {
    setPendingAmount(amount);
    handleDetected(vpa.includes('@') ? vpa : `upi://pay?pa=${vpa}&am=${amount}`);
  };

  const handleProceed = () => {
    if (!result) return;
    const merchantInfo = result.merchantInfo;
    onProceed({
      merchant: merchantInfo?.name || result.merchant,
      amount: pendingAmount || 500,
      category: merchantInfo?.category || 'QR Payment',
      upiId: result.merchant,
    });
    onClose();
  };

  const handleBack = () => {
    setPhase('scan');
    setResult(null);
    setPendingVPA(null);
    detectedRef.current = false;
  };

  return (
    <div style={{
      position:'fixed', inset:0, zIndex:4000,
      background:'rgba(0,0,0,0.94)',
      display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
      padding: 20,
    }}>
      {/* Close */}
      <button onClick={onClose} style={{position:'absolute',top:20,right:20,background:'rgba(255,255,255,0.12)',border:'none',borderRadius:'50%',width:40,height:40,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:'white',zIndex:1}}>
        <X size={20} />
      </button>

      {phase === 'scan' && (
        <div style={{width:'100%',maxWidth:360,display:'flex',flexDirection:'column',gap:20}}>
          <div style={{textAlign:'center'}}>
            <div style={{color:'white',fontWeight:800,fontSize:20,marginBottom:4}}>🛡️ Secure QR Pay</div>
            <div style={{color:'rgba(255,255,255,0.5)',fontSize:12}}>AI-powered fraud detection before every payment</div>
          </div>

          {/* Tab switcher */}
          <div style={{display:'flex',background:'rgba(255,255,255,0.1)',borderRadius:12,padding:4}}>
            {[{id:'camera',label:'📷 Camera Scan'},{id:'manual',label:'⌨️ Enter UPI / Demo'}].map(t=>(
              <button key={t.id} onClick={()=>setTab(t.id)} style={{
                flex:1,padding:'9px',borderRadius:9,border:'none',cursor:'pointer',fontWeight:700,fontSize:13,
                background: tab===t.id ? 'white' : 'transparent',
                color: tab===t.id ? '#1e293b' : 'rgba(255,255,255,0.6)',
                transition:'all 0.2s'
              }}>{t.label}</button>
            ))}
          </div>

          {tab === 'camera' ? (
            <CameraScanner onDetected={handleDetected} onError={()=>setTab('manual')} />
          ) : (
            <ManualEntry onSubmit={handleManualSubmit} />
          )}
        </div>
      )}

      {phase === 'analyzing' && (
        <div style={{width:'100%',maxWidth:360}}>
          <AnalyzingScreen vpa={pendingVPA} merchantName={analyzeMerchant(pendingVPA)?.name} />
        </div>
      )}

      {phase === 'result' && result && (
        <ResultCard
          result={result}
          amount={pendingAmount}
          onProceed={handleProceed}
          onBack={handleBack}
          onClose={onClose}
        />
      )}

      <style>{`@keyframes slideUp{from{opacity:0;transform:translateY(30px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  );
};

export default QRScannerModal;
