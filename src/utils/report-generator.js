/**
 * Cybercrime Report Generator
 * Generates a pre-filled cybercrime report text that can be copied
 * or used to file a complaint at cybercrime.gov.in
 */

export function generateCrimeReport(transaction) {
  const {
    merchant = 'Unknown Merchant',
    amount = 0,
    upiId = '',
    status = 'BLOCKED',
    fraudScore = 0,
    indicators = [],
    created_at,
    id,
  } = transaction || {};

  const timestamp = created_at
    ? new Date(created_at).toLocaleString('en-IN', { dateStyle: 'long', timeStyle: 'short' })
    : new Date().toLocaleString('en-IN', { dateStyle: 'long', timeStyle: 'short' });

  const fraudType = detectFraudType(indicators, merchant, upiId);
  const reportId = `FS-${Date.now().toString(36).toUpperCase()}`;

  const report = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  UPI FRAUD SHIELD — CYBERCRIME INCIDENT REPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Report ID     : ${reportId}
Generated On  : ${timestamp}
AI Verdict    : ${status} (Risk Score: ${Math.round((fraudScore || 0) * 100)}%)

━━ TRANSACTION DETAILS ━━━━━━━━━━━━━━━━━━━━━━━━━
Beneficiary   : ${merchant}
UPI ID        : ${upiId || 'Not captured'}
Amount        : ₹${Number(amount).toLocaleString('en-IN')}
Date/Time     : ${timestamp}
Transaction ID: ${id || 'N/A'}

━━ FRAUD CLASSIFICATION ━━━━━━━━━━━━━━━━━━━━━━━━
Detected Type : ${fraudType}
AI Indicators : ${indicators.length > 0 ? indicators.join(', ') : 'Heuristic pattern match'}

━━ AI ANALYSIS SUMMARY ━━━━━━━━━━━━━━━━━━━━━━━━━
Our AI ensemble model (Random Forest + Gradient Boosting + 
Isolation Forest) assigned a fraud risk score of 
${Math.round((fraudScore || 0) * 100)}%, exceeding our threshold of 70%, 
which resulted in the payment being automatically BLOCKED
to protect the user.

━━ ACTION REQUIRED ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. File a complaint at: https://cybercrime.gov.in
2. Call National Cybercrime Helpline: 1930
3. Report to your bank's fraud helpline immediately
4. Forward suspicious messages to: 7726 (SPAM)

━━ ADDITIONAL INFORMATION ━━━━━━━━━━━━━━━━━━━━━━
• Do NOT share your OTP, PIN, or password with anyone
• Legitimate banks/NPCI never ask for your UPI PIN
• If money was lost, call 1930 within 24 hours for
  best chance of recovery
• Screenshot this report for your records

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Powered by UPI Fraud Shield — AI-Powered Payment Security
  This report was generated automatically by AI analysis.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  `.trim();

  return { report, reportId, fraudType };
}

function detectFraudType(indicators = [], merchant = '', upiId = '') {
  const all = [...indicators, merchant, upiId].join(' ').toLowerCase();
  if (all.includes('kyc') || all.includes('aadhar')) return 'KYC / Identity Fraud';
  if (all.includes('prize') || all.includes('winner') || all.includes('lottery')) return 'Lottery / Prize Scam';
  if (all.includes('tech') || all.includes('helpdesk') || all.includes('support')) return 'Fake Tech Support Scam';
  if (all.includes('otp') || all.includes('pin')) return 'OTP / Credential Phishing';
  if (all.includes('high_amount') || all.includes('large')) return 'High-Value Transaction Fraud';
  if (all.includes('night') || all.includes('off_hour')) return 'Unusual-Time Transaction';
  if (all.includes('new_merchant') || all.includes('unverified')) return 'Unverified Merchant Fraud';
  return 'Suspicious UPI Transaction';
}

export function copyReport(reportText) {
  if (navigator.clipboard) {
    return navigator.clipboard.writeText(reportText);
  }
  // Fallback for older browsers
  const el = document.createElement('textarea');
  el.value = reportText;
  document.body.appendChild(el);
  el.select();
  document.execCommand('copy');
  document.body.removeChild(el);
  return Promise.resolve();
}
