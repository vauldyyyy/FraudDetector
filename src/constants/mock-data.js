export const MERCHANT_CATEGORIES = ["E-Commerce","Food & Dining","Utilities","Travel","Entertainment","Healthcare","Education","Retail","Finance","Gaming"];
export const DEVICES = Array.from({length:30}, (_,i)=>`DEV_${String(i+1).padStart(4,'0')}`);
export const STATES = ["Maharashtra","Delhi","Karnataka","Tamil Nadu","Telangana","Gujarat","UP","West Bengal","Rajasthan","Punjab"];
export const BANKS = ["SBI","HDFC","ICICI","Axis","Kotak","PNB","Canara","BOB","Union","Yes Bank"];
export const FRAUD_INDICATORS = ["high_amount","unusual_time","new_device","velocity_breach","geo_mismatch","merchant_risk","account_age","multiple_attempts"];

export const MODEL_METRICS = [
  {name:"Random Forest",accuracy:96.8,precision:94.2,recall:91.7,f1:92.9,auc:0.987,color:"#f59e0b"},
  {name:"XGBoost",accuracy:97.3,precision:95.1,recall:93.4,f1:94.2,auc:0.991,color:"#10b981"},
  {name:"Neural Network",accuracy:96.1,precision:93.8,recall:90.2,f1:91.9,auc:0.983,color:"#6366f1"},
  {name:"Isolation Forest",accuracy:89.4,precision:82.1,recall:85.6,f1:83.8,auc:0.934,color:"#ec4899"},
  {name:"Ensemble",accuracy:98.1,precision:96.7,recall:95.2,f1:95.9,auc:0.996,color:"#f97316"},
];

export const ROC_DATA = Array.from({length:21},(_,i)=>{
  const fpr = i/20;
  return {
    fpr: Math.round(fpr*100)/100,
    ensemble: Math.min(1, fpr + (1-fpr)*0.98*(1-Math.pow(fpr,0.15))),
    rf: Math.min(1, fpr + (1-fpr)*0.96*(1-Math.pow(fpr,0.18))),
    xgb: Math.min(1, fpr + (1-fpr)*0.97*(1-Math.pow(fpr,0.16))),
    nn: Math.min(1, fpr + (1-fpr)*0.95*(1-Math.pow(fpr,0.20))),
    random: fpr
  };
}).map(d=>({...d,
  ensemble:Math.round(Math.min(d.ensemble,1)*1000)/1000,
  rf:Math.round(Math.min(d.rf,1)*1000)/1000,
  xgb:Math.round(Math.min(d.xgb,1)*1000)/1000,
  nn:Math.round(Math.min(d.nn,1)*1000)/1000,
}));

export const FEATURE_IMPORTANCE = [
  {feature:"Transaction Amount",rf:0.187,xgb:0.201,nn:0.165},
  {feature:"Transaction Hour",rf:0.134,xgb:0.118,nn:0.142},
  {feature:"Velocity Score",rf:0.156,xgb:0.167,nn:0.148},
  {feature:"Merchant Category",rf:0.098,xgb:0.089,nn:0.112},
  {feature:"Device Age",rf:0.121,xgb:0.134,nn:0.109},
  {feature:"Geo Distance",rf:0.143,xgb:0.129,nn:0.138},
  {feature:"Account Age",rf:0.087,xgb:0.092,nn:0.098},
  {feature:"Failed Attempts",rf:0.074,xgb:0.070,nn:0.088},
].sort((a,b)=>b.rf-a.rf);

export const SMOTE_DATA = [
  {label:"Before SMOTE",legit:627,fraud:33},
  {label:"After SMOTE",legit:627,fraud:570},
];
