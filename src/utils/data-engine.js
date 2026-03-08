import { MERCHANT_CATEGORIES, DEVICES, STATES, BANKS, FRAUD_INDICATORS } from "../constants/mock-data";

export const rng = (min,max) => Math.random()*(max-min)+min;
export const rngInt = (min,max) => Math.floor(rng(min,max+1));
export const pick = arr => arr[rngInt(0,arr.length-1)];
export const gaussian = (mean,std) => {
  let u=0,v=0;
  while(u===0) u=Math.random();
  while(v===0) v=Math.random();
  return mean + std * Math.sqrt(-2*Math.log(u)) * Math.cos(2*Math.PI*v);
};

export function generateTransaction(id, isFraud=null) {
  const hour = rngInt(0,23);
  const isNight = hour>=22||hour<=5;
  const amount = isFraud
    ? (Math.random()<0.6 ? rng(50000,500000) : rng(1,200))
    : gaussian(2800,3200);
  const fraudScore = isFraud!==null ? (isFraud ? rng(0.65,0.99) : rng(0.01,0.35)) : rng(0,1);
  const actualFraud = isFraud!==null ? isFraud : fraudScore>0.7;
  const indicators = [];
  if(actualFraud) {
    const n = rngInt(1,4);
    const shuffled = [...FRAUD_INDICATORS].sort(()=>Math.random()-0.5);
    indicators.push(...shuffled.slice(0,n));
  }

  // Generate human-readable explanation for Phase 3 (Explainable AI)
  let explanation = "No significant risk factors detected. Transaction meets standard behavioral profile.";
  if (actualFraud) {
    const reasons = indicators.map(ind => {
      switch(ind) {
        case "high_amount": return "unusually high transaction amount for this account";
        case "unusual_time": return "initiated during non-standard hours (night-time anomaly)";
        case "new_device": return "originating from an unrecognized hardware signature";
        case "velocity_breach": return "rapid succession of payments exceeding safety thresholds";
        case "geo_mismatch": return "geographic location inconsistent with previous user activity";
        case "merchant_risk": return "recipient identified as a high-risk or blacklisted entity";
        case "account_age": return "recent account creation with no established trust history";
        case "multiple_attempts": return "preceded by several failed authentication attempts";
        default: return ind.replace("_", " ");
      }
    });
    explanation = `Flagged due to a combination of: ${reasons.join(", ")}. Overall ensemble confidence at ${(fraudScore * 100).toFixed(1)}%.`;
  }

  return {
    id: `TXN${String(id).padStart(8,'0')}`,
    amount: Math.max(1, Math.round(Math.abs(amount))),
    merchant: pick(MERCHANT_CATEGORIES),
    device: pick(DEVICES),
    state: pick(STATES),
    bank: pick(BANKS),
    hour,
    isNight,
    isFraud: actualFraud,
    fraudScore: Math.round(fraudScore*1000)/1000,
    indicators,
    explanation, // Added for XAI
    timestamp: new Date(Date.now() - rng(0, 86400000*7)),
    status: actualFraud && fraudScore>0.85 ? "BLOCKED" : actualFraud && fraudScore>0.65 ? "FLAGGED" : "CLEARED",
    modelScores: {
      randomForest: Math.min(0.99, fraudScore + rng(-0.08,0.08)),
      xgboost: Math.min(0.99, fraudScore + rng(-0.06,0.06)),
      neuralNet: Math.min(0.99, fraudScore + rng(-0.10,0.10)),
      isolation: Math.min(0.99, fraudScore + rng(-0.12,0.12)),
    }
  };
}

export function generateDataset(n=660) {
  const fraudCount = Math.floor(n*0.05);
  const legit = Array.from({length:n-fraudCount},(_,i)=>generateTransaction(i+1,false));
  const fraud = Array.from({length:fraudCount},(_,i)=>generateTransaction(n-fraudCount+i+1,true));
  return [...legit,...fraud].sort(()=>Math.random()-0.5);
}

export const HOURLY_FRAUD = Array.from({length:24},(_,h)=>({
  hour:`${String(h).padStart(2,'0')}:00`,
  transactions: rngInt(800,3200),
  fraud: h>=22||h<=4 ? rngInt(12,28) : rngInt(1,8),
  amount: rngInt(100000,800000)
}));

export const CATEGORY_RISK = MERCHANT_CATEGORIES.map(cat=>({
  category: cat,
  riskScore: Math.round(rng(15,85)),
  transactions: rngInt(200,2000),
  fraudRate: Math.round(rng(0.5,8.5)*10)/10,
})).sort((a,b)=>b.riskScore-a.riskScore);

export const STATE_DATA = STATES.map(s=>({
  state:s,
  volume:rngInt(50000,500000),
  fraud:rngInt(50,800),
  rate:Math.round(rng(0.1,2.5)*100)/100,
}));
