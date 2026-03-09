/**
 * MerchantIntelligence.js
 * 
 * Merchant lookup table for quick risk classification of UPI VPAs.
 * Used as supplementary signal alongside ML model predictions.
 */

// Known safe merchants — verified businesses with track record
export const KNOWN_SAFE = {
  'amazon@amazonpay':       { name: 'Amazon India', category: 'E-Commerce',    icon: '🛒', trustScore: 98 },
  'amazon.pay@apl':         { name: 'Amazon Pay',   category: 'E-Commerce',    icon: '🛒', trustScore: 98 },
  'flipkart@axisbank':      { name: 'Flipkart',     category: 'E-Commerce',    icon: '🛍️', trustScore: 96 },
  'swiggy@icici':           { name: 'Swiggy',       category: 'Food Delivery', icon: '🍕', trustScore: 94 },
  'zomato@icici':           { name: 'Zomato',       category: 'Food Delivery', icon: '🍔', trustScore: 93 },
  'irctc@upi':              { name: 'IRCTC',        category: 'Travel',        icon: '🚂', trustScore: 99 },
  'ola@upiaxis':            { name: 'Ola Cabs',     category: 'Transport',     icon: '🚕', trustScore: 90 },
  'uber@hsbc':              { name: 'Uber',         category: 'Transport',     icon: '🚗', trustScore: 91 },
  'netflix@icici':          { name: 'Netflix',      category: 'Entertainment', icon: '🎬', trustScore: 95 },
  'hotstar@hdfcbank':       { name: 'Hotstar',      category: 'Entertainment', icon: '📺', trustScore: 95 },
  'paytm@paytm':            { name: 'Paytm',        category: 'Wallet',        icon: '💳', trustScore: 89 },
  'phonepe@ybl':            { name: 'PhonePe',      category: 'Wallet',        icon: '💰', trustScore: 92 },
  'bsnl@upi':               { name: 'BSNL',         category: 'Utility',       icon: '📞', trustScore: 97 },
  'jio@icicipay':           { name: 'Jio',          category: 'Telecom',       icon: '📱', trustScore: 96 },
  'bigbasket@okaxis':       { name: 'BigBasket',    category: 'Grocery',       icon: '🥦', trustScore: 93 },
};

// Known fraud merchant patterns — blacklisted
export const KNOWN_FRAUD = {
  'winner.prize@upi':       { name: 'Lucky Winner Prize', fraudType: 'Lottery Scam',    reportCount: 312, score: 0.97 },
  'helpdesk.tech@ybl':      { name: 'Tech Support',       fraudType: 'Support Scam',    reportCount: 187, score: 0.95 },
  'refund.amazon@upi':      { name: 'Amazon Refund',      fraudType: 'Impersonation',   reportCount: 241, score: 0.96 },
  'cashback.offer@okicici': { name: 'Cashback Offer',     fraudType: 'Phishing',        reportCount: 98,  score: 0.93 },
  'kyc.update@upi':         { name: 'KYC Update',         fraudType: 'KYC Scam',        reportCount: 456, score: 0.98 },
  'loan.approval@ybl':      { name: 'Loan Agent',         fraudType: 'Loan Scam',       reportCount: 134, score: 0.91 },
  'pm.relief.fund@upi':     { name: 'PM Relief Fund',     fraudType: 'Charity Scam',    reportCount: 567, score: 0.99 },
  'free.recharge@upi':      { name: 'Free Recharge',      fraudType: 'Phishing',        reportCount: 89,  score: 0.88 },
};

// Risky VPA pattern keywords (regex-like checks on the UPI ID)
export const FRAUD_KEYWORDS = [
  'winner', 'prize', 'lottery', 'helpdesk', 'tech.support', 'techsupport',
  'refund', 'cashback.offer', 'kyc.update', 'kyc-update', 'loan.approval',
  'relief.fund', 'free.recharge', 'gift.card', 'reward.claim', 'lucky.draw',
  'job.offer', 'work.from.home', 'blocked.account', 'account.verify',
];

// Safe VPA pattern signals (banks, known handles)
export const SAFE_BANK_HANDLES = [
  '@okaxis', '@okhdfcbank', '@okicici', '@oksbi',
  '@axisbank', '@hdfcbank', '@icici', '@sbi',
  '@upi', '@ybl', '@ibl', '@hsbc', '@icicipay',
  '@apl', '@amazonpay', '@paytm',
];

/**
 * Analyze a UPI VPA and return intelligence
 * @param {string} vpa - The UPI Virtual Payment Address (e.g., "swiggy@icici")
 * @param {number} amount - Payment amount
 * @returns {Object} merchant intelligence object
 */
export function analyzeMerchant(vpa, amount = 0) {
  if (!vpa) return null;
  const vpaLower = vpa.toLowerCase().trim();

  // 1. Check exact known safe match
  if (KNOWN_SAFE[vpaLower]) {
    return { ...KNOWN_SAFE[vpaLower], vpa, knownSafe: true, knownFraud: false, riskBoost: -0.4 };
  }

  // 2. Check exact known fraud match
  if (KNOWN_FRAUD[vpaLower]) {
    const f = KNOWN_FRAUD[vpaLower];
    return { name: f.name, category: 'Suspicious', icon: '🚨',
      trustScore: Math.round((1 - f.score) * 100), vpa,
      knownSafe: false, knownFraud: true, riskBoost: 0.5,
      fraudType: f.fraudType, reportCount: f.reportCount };
  }

  // 3. Check for fraud keywords in VPA
  const fraudKeywordMatch = FRAUD_KEYWORDS.find(k => vpaLower.includes(k));
  if (fraudKeywordMatch) {
    return {
      name: formatVPAName(vpa), category: 'Suspicious', icon: '⚠️',
      trustScore: 15, vpa, knownSafe: false, knownFraud: false,
      riskBoost: 0.35, suspiciousKeyword: fraudKeywordMatch
    };
  }

  // 4. Check for safe bank handles (personal transfers)
  const safeBankHandle = SAFE_BANK_HANDLES.find(h => vpaLower.endsWith(h));
  const isPersonalVPA = safeBankHandle && !vpaLower.includes('.');
  if (isPersonalVPA) {
    // Looks like a personal UPI ID (e.g., rahulkumar@oksbi)
    return {
      name: formatVPAName(vpa), category: 'Personal Transfer', icon: '👤',
      trustScore: 82, vpa, knownSafe: false, knownFraud: false,
      riskBoost: -0.15, isPersonal: true
    };
  }

  // 5. Unknown merchant — return neutral
  return {
    name: formatVPAName(vpa), category: 'Unknown', icon: '💳',
    trustScore: 50, vpa, knownSafe: false, knownFraud: false,
    riskBoost: 0.05
  };
}

/** Convert VPA to a display name */
function formatVPAName(vpa) {
  const [user] = vpa.split('@');
  return user.replace(/[._-]/g, ' ')
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
