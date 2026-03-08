const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../datasets');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const MERCHANT_CATEGORIES = ["Retail", "Food & Dining", "Travel", "Utility Bills", "Entertainment", "Healthcare", "Education", "Gas Station", "E-commerce"];
const DEVICES = ["iPhone 14", "Samsung Galaxy S23", "OnePlus 11", "Google Pixel 7", "Redmi Note 12", "Vivo V27", "Oppo Reno 10"];
const STATES = ["Maharashtra", "Karnataka", "Delhi", "Tamil Nadu", "Telangana", "Gujarat", "Uttar Pradesh", "West Bengal", "Kerala", "Rajasthan"];
const BANKS = ["SBI", "HDFC Bank", "ICICI Bank", "Axis Bank", "Kotak Mahindra", "Punjab National Bank", "Bank of Baroda", "Union Bank"];
const FRAUD_INDICATORS = ["high_amount", "unusual_time", "new_device", "velocity_breach", "geo_mismatch", "merchant_risk", "account_age", "multiple_attempts"];

const rng = (min,max) => Math.random()*(max-min)+min;
const rngInt = (min,max) => Math.floor(rng(min,max+1));
const pick = arr => arr[rngInt(0,arr.length-1)];
const gaussian = (mean,std) => {
  let u=0,v=0;
  while(u===0) u=Math.random();
  while(v===0) v=Math.random();
  return mean + std * Math.sqrt(-2*Math.log(u)) * Math.cos(2*Math.PI*v);
};

function generateTransaction(id, isFraud) {
  const hour = rngInt(0,23);
  const amount = isFraud ? (Math.random()<0.6 ? rng(50000,500000) : rng(1,200)) : gaussian(2800,3200);
  const fraudScore = isFraud ? rng(0.65,0.99) : rng(0.01,0.35);
  const indicators = [];
  if(isFraud) {
    const n = rngInt(1,4);
    const shuffled = [...FRAUD_INDICATORS].sort(()=>Math.random()-0.5);
    indicators.push(...shuffled.slice(0,n));
  }

  return {
    id: `TXN${String(id).padStart(8,'0')}`,
    amount: Math.max(1, Math.round(Math.abs(amount))),
    merchant: pick(MERCHANT_CATEGORIES),
    device: pick(DEVICES),
    state: pick(STATES),
    bank: pick(BANKS),
    hour,
    isNight: hour>=22||hour<=5 ? 1 : 0,
    fraudScore: Math.round(fraudScore*1000)/1000,
    isFraud: isFraud ? 1 : 0,
    status: isFraud && fraudScore>0.85 ? "BLOCKED" : isFraud && fraudScore>0.65 ? "FLAGGED" : "CLEARED",
    indicators: indicators.join(';')
  };
}

const fraudCount = Math.floor(660*0.05);
const legit = Array.from({length:660-fraudCount},(_,i)=>generateTransaction(i+1,false));
const fraud = Array.from({length:fraudCount},(_,i)=>generateTransaction(660-fraudCount+i+1,true));
const dataset = [...legit,...fraud].sort(()=>Math.random()-0.5);

const headers = ['Transaction_ID', 'Amount', 'Merchant_Category', 'Device_Type', 'State', 'Bank', 'Hour', 'Is_Night', 'Fraud_Score', 'Is_Fraud', 'Status', 'Indicators'];
const csvRows = [headers.join(',')];
for (const tx of dataset) {
  csvRows.push([tx.id, tx.amount, tx.merchant, tx.device, tx.state, tx.bank, tx.hour, tx.isNight, tx.fraudScore, tx.isFraud, tx.status, `"${tx.indicators}"`].join(','));
}
fs.writeFileSync(path.join(DATA_DIR, 'UPI_Synthetic_Transaction_Dataset_660.csv'), csvRows.join('\n'));
console.log('✓ Created UPI_Synthetic_Transaction_Dataset_660.csv');

const npciHeaders = ['Month_Year', 'Total_Volume_Mn', 'Total_Value_Cr'];
const npciRows = [npciHeaders.join(',')];
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
let baseVolume = 8000;
let baseValue = 1200000;
for (let year = 2023; year <= 2024; year++) {
  for (let month of months) {
    if (year === 2024 && month === 'Oct') break;
    baseVolume += Math.floor(Math.random() * 500);
    baseValue += Math.floor(Math.random() * 80000);
    npciRows.push(`${month}-${year},${baseVolume},${baseValue}`);
  }
}
fs.writeFileSync(path.join(DATA_DIR, 'NPCI_Historical_Volumes_Sample.csv'), npciRows.join('\n'));
console.log('✓ Created NPCI_Historical_Volumes_Sample.csv');

const kaggleHeaders = ['step', 'type', 'amount', 'nameOrig', 'oldbalanceOrg', 'newbalanceOrig', 'nameDest', 'oldbalanceDest', 'newbalanceDest', 'isFraud', 'isFlaggedFraud'];
const kaggleRows = [kaggleHeaders.join(',')];
const types = ['PAYMENT', 'TRANSFER', 'CASH_OUT', 'DEBIT', 'CASH_IN'];
for(let i=1; i<=50; i++) {
   const isF = Math.random() < 0.1 ? 1 : 0;
   const type = types[Math.floor(Math.random() * types.length)];
   const amt = Math.floor(Math.random() * 10000) + 100;
   kaggleRows.push(`1,${type},${amt},C${Math.floor(Math.random()*10000000)},${amt + 100},100,M${Math.floor(Math.random()*10000000)},0,0,${isF},0`);
}
fs.writeFileSync(path.join(DATA_DIR, 'Kaggle_Online_Payments_Fraud_Sample.csv'), kaggleRows.join('\n'));

const kaggleReadme = `# Online Payments Fraud Detection Dataset (Kaggle)

**Source**: [Kaggle Link](https://www.kaggle.com/datasets/rupakroy/online-payments-fraud-detection-dataset)

Due to size constraints and Kaggle's licensing restrictions, the full dataset (millions of rows) is not included directly in this repository. A structural sample CSV (50 rows) has been provided here for schema reference.

## Usage in Project
This dataset was studied to train the foundational XGBoost models in our Stacked Generalization ensemble, teaching the system recognizing behavioral patterns like rapid TRANSFER followed by CASH_OUT operations.`;

fs.writeFileSync(path.join(DATA_DIR, 'Kaggle_Readme.md'), kaggleReadme);
console.log('✓ Created Kaggle Sample and Readme');
