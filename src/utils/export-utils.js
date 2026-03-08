// export-utils.js - Utilities for exporting fraud data

/**
 * Converts an array of transaction objects to a CSV string and triggers a browser download.
 * @param {Array} transactions - Array of transaction objects to export
 * @param {string} filename - Name of the downloaded file
 */
export const exportToCSV = (transactions, filename = "fraud_report.csv") => {
  if (!transactions || transactions.length === 0) {
    alert("No transactions to export.");
    return;
  }

  const headers = [
    "ID", "Amount (INR)", "Merchant", "Status", "Fraud Score (%)",
    "Device", "State", "Bank", "Hour", "Is Fraud", "Risk Indicators", "Explanation", "Timestamp"
  ];

  const rows = transactions.map(tx => [
    tx.id || "",
    tx.amount || 0,
    `"${(tx.merchant || "").replace(/"/g, '""')}"`,
    tx.status || "",
    ((tx.fraudScore || tx.fraud_score || 0) * 100).toFixed(1),
    tx.device || "",
    tx.state || "",
    tx.bank || "",
    tx.hour || "",
    (tx.isFraud || tx.is_fraud) ? "Yes" : "No",
    `"${(tx.indicators || []).join(", ")}"`,
    `"${(tx.explanation || "").replace(/"/g, '""')}"`,
    tx.created_at || tx.timestamp || ""
  ]);

  const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
  
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

/**
 * Copies a text summary to clipboard and shows a success message
 * @param {string} text 
 */
export const copyToClipboard = (text) => {
  navigator.clipboard.writeText(text).then(() => {
    // Handled in calling component
  });
};
