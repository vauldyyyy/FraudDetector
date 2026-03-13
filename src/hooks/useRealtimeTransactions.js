import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import useStore from '../store/useStore';
import { generateTransaction } from '../utils/data-engine';

export const applyAdminRules = (tx, currentRules) => {
  let finalStatus = tx.status;
  const appliedRules = [];

  for (const rule of currentRules.filter(r => r.enabled)) {
    const txValue = tx[rule.field];
    let match = false;
    const ruleValue = rule.value;

    if (rule.operator === 'gt' && txValue > ruleValue) match = true;
    if (rule.operator === 'lt' && txValue < ruleValue) match = true;
    if (rule.operator === 'eq' && String(txValue).toLowerCase() === String(ruleValue).toLowerCase()) match = true;

    if (match) {
      appliedRules.push(rule.name);
      if (rule.action === 'Block') finalStatus = 'BLOCKED';
      else if (rule.action === 'Flag' && finalStatus !== 'BLOCKED') finalStatus = 'FLAGGED';
    }
  }

  if (appliedRules.length > 0) {
    return {
      ...tx,
      status: finalStatus,
      isFraud: finalStatus !== 'CLEARED',
      explanation: `${tx.explanation} (Overridden by Admin Rules: ${appliedRules.join(', ')})`,
      indicators: [...new Set([...(tx.indicators || []), 'admin_rule_override'])]
    };
  }
  return tx;
};

export const useRealtimeTransactions = () => {
  const { 
    setDataset, 
    setLiveTransactions, 
    addAuditLog, 
    setAlertCount, 
    addNotification, 
    isMonitoring, 
    alertRules 
  } = useStore();
  
  const counterRef = useRef(1000);

  useEffect(() => {
    // 1. Fetch ALL seeded historical data from Supabase
    const fetchInitialData = async () => {
      try {
        const { data, error } = await supabase
          .from('transactions')
          .select('*')
          .order('id', { ascending: false })
          .limit(1000); 
        
        if (data && !error) {
          const mappedData = data.map(tx => ({
            ...tx,
            fraudScore: tx.fraud_score,
            isFraud: tx.is_fraud
          }));
          
          setDataset(mappedData);
          setLiveTransactions(prev => {
            const combined = [...mappedData, ...prev];
            return combined.filter((v, i, a) => a.findIndex(t => (t.id === v.id)) === i).slice(0, 1000);
          });
          addAuditLog(`Connected to Supabase. Loaded ${mappedData.length} historical database records.`, "success");
        } else if (error) {
           addAuditLog(`Supabase Connection Error: ${error.message}`, "warning");
        }
      } catch (err) {}
    };

    fetchInitialData();

    // 2. Subscribe to Supabase real-time inserts
    const subscription = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'transactions' },
        (payload) => {
          const newTx = {
            ...payload.new,
            fraudScore: payload.new.fraud_score,
            isFraud: payload.new.is_fraud,
            isLive: true 
          };
          
          setLiveTransactions(prev => [newTx, ...prev].slice(0, 100));
          
          addAuditLog(`[LIVE DATABASE] New transaction from ${newTx.merchant}: ₹${newTx.amount.toLocaleString()}`, 
            newTx.status === 'BLOCKED' ? 'error' : newTx.status === 'FLAGGED' ? 'warning' : 'success');

          if (newTx.status === "BLOCKED" || newTx.status === "FLAGGED") {
            setAlertCount(a => a + 1);
            
            addNotification({
              id: `notif-${newTx.id}-${Date.now()}`,
              type: newTx.status === 'BLOCKED' ? 'error' : 'warning',
              title: newTx.status === 'BLOCKED' ? 'Transaction Blocked (LIVE)' : 'Fraud Alert (LIVE)',
              message: newTx.status === 'BLOCKED' 
                ? `SECURITY ALERT: Payment of ₹${newTx.amount.toLocaleString()} to ${newTx.merchant} was blocked due to pattern match.`
                : `CAUTION: Potential fraud detected for ₹${newTx.amount.toLocaleString()} to ${newTx.merchant}.`,
              transaction: newTx
            });
          }
        }
      )
      .subscribe();

    // 3. Background Mock Data Generator
    let mockInterval;
    if (isMonitoring) {
      mockInterval = setInterval(() => {
        const isFraud = Math.random() < 0.08; 
        let tx = generateTransaction(++counterRef.current, isFraud);
        tx.isLive = false; 
        tx = applyAdminRules(tx, alertRules);
        
        setLiveTransactions(prev => [tx, ...prev].slice(0, 1000)); 
        
        if (tx.status === "BLOCKED" || tx.status === "FLAGGED") {
          setAlertCount(a => a + 1);
        }
      }, 3500); 
    }

    return () => {
      supabase.removeChannel(subscription);
      if (mockInterval) clearInterval(mockInterval);
    };
  }, [addAuditLog, setDataset, setLiveTransactions, setAlertCount, addNotification, isMonitoring, alertRules]);

  return { counterRef };
};
