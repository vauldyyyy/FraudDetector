import React, { useState } from 'react';
import { Plus, Trash2, AlertCircle, Settings, ToggleLeft, ToggleRight } from 'lucide-react';

const DEFAULT_RULES = [
  { id: 1, name: 'High Value Block', field: 'amount', operator: 'gt', value: 100000, action: 'Block', enabled: true },
  { id: 2, name: 'Night-time Flag', field: 'hour', operator: 'gt', value: 22, action: 'Flag', enabled: true },
  { id: 3, name: 'Device: Rooted', field: 'device', operator: 'eq', value: 'Rooted Android', action: 'Flag', enabled: false },
];

const AlertRulesEngine = ({ onRulesChange }) => {
  const [rules, setRules] = useState(DEFAULT_RULES);
  const [form, setForm] = useState({ name: '', field: 'amount', operator: 'gt', value: '', action: 'Flag' });
  const [showForm, setShowForm] = useState(false);

  const FIELDS = ['amount', 'hour', 'fraudScore', 'device', 'status'];
  const OPERATORS = [{ v: 'gt', label: '>' }, { v: 'lt', label: '<' }, { v: 'eq', label: '=' }];
  const ACTIONS = ['Flag', 'Block', 'Log'];

  const addRule = () => {
    if (!form.name || !form.value) return;
    const newRule = { ...form, id: Date.now(), enabled: true, value: isNaN(form.value) ? form.value : Number(form.value) };
    const updated = [...rules, newRule];
    setRules(updated);
    if (onRulesChange) onRulesChange(updated);
    setForm({ name: '', field: 'amount', operator: 'gt', value: '', action: 'Flag' });
    setShowForm(false);
  };

  const toggleRule = (id) => {
    const updated = rules.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r);
    setRules(updated);
    if (onRulesChange) onRulesChange(updated);
  };

  const deleteRule = (id) => {
    const updated = rules.filter(r => r.id !== id);
    setRules(updated);
    if (onRulesChange) onRulesChange(updated);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header Card */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 14, padding: '16px 20px', boxShadow: 'var(--card-shadow)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Settings size={18} color="var(--accent-blue)" />
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: 'var(--text-main)' }}>Alert Rules Engine</h3>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>{rules.filter(r => r.enabled).length} active rules · {rules.length} total</p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          style={{ background: 'var(--accent-blue)', color: 'white', border: 'none', borderRadius: 10, padding: '8px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <Plus size={16} /> Add Rule
        </button>
      </div>

      {/* Add Rule Form */}
      {showForm && (
        <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 14, padding: '20px' }}>
          <h4 style={{ margin: '0 0 16px', color: 'var(--text-main)', fontSize: 14, fontWeight: 700 }}>Create New Rule</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: 10, alignItems: 'end' }}>
            {[
              { label: 'Rule Name', el: <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. High Amount Alert" style={inputStyle} /> },
              { label: 'Field', el: <select value={form.field} onChange={e => setForm({...form, field: e.target.value})} style={inputStyle}>{FIELDS.map(f => <option key={f}>{f}</option>)}</select> },
              { label: 'Condition', el: <select value={form.operator} onChange={e => setForm({...form, operator: e.target.value})} style={inputStyle}>{OPERATORS.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}</select> },
              { label: 'Value', el: <input value={form.value} onChange={e => setForm({...form, value: e.target.value})} placeholder="e.g. 50000" style={inputStyle} /> },
              { label: 'Action', el: <select value={form.action} onChange={e => setForm({...form, action: e.target.value})} style={inputStyle}>{ACTIONS.map(a => <option key={a}>{a}</option>)}</select> },
            ].map(({ label, el }) => (
              <div key={label}><div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', marginBottom: 4, textTransform: 'uppercase' }}>{label}</div>{el}</div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 16, justifyContent: 'flex-end' }}>
            <button onClick={() => setShowForm(false)} style={{ ...btnStyle, background: 'white', color: 'var(--text-dim)', border: '1px solid var(--border-color)' }}>Cancel</button>
            <button onClick={addRule} style={{ ...btnStyle, background: 'var(--accent-blue)', color: 'white', border: 'none' }}>Save Rule</button>
          </div>
        </div>
      )}

      {/* Rules List */}
      <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 14, overflow: 'hidden', boxShadow: 'var(--card-shadow)' }}>
        <div style={{ background: '#f8fafc', borderBottom: '1px solid var(--border-color)', padding: '12px 20px', display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 80px 80px', gap: 8 }}>
          {['Rule Name', 'Condition', 'Value', 'Action', 'Status', ''].map(h => (
            <div key={h} style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase' }}>{h}</div>
          ))}
        </div>
        {rules.map(rule => (
          <div key={rule.id} style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9', display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 80px 80px', gap: 8, alignItems: 'center', opacity: rule.enabled ? 1 : 0.5 }}>
            <div style={{ color: 'var(--text-main)', fontSize: 14, fontWeight: 600 }}>{rule.name}</div>
            <div style={{ color: 'var(--text-dim)', fontSize: 13 }}>{rule.field} {OPERATORS.find(o => o.v === rule.operator)?.label}</div>
            <div style={{ color: 'var(--text-main)', fontSize: 13, fontFamily: 'monospace', fontWeight: 700 }}>{String(rule.value)}</div>
            <div>
              <span style={{
                background: rule.action === 'Block' ? '#fef2f2' : rule.action === 'Flag' ? '#fffbeb' : '#f0fdf4',
                color: rule.action === 'Block' ? '#dc2626' : rule.action === 'Flag' ? '#d97706' : '#16a34a',
                border: `1px solid ${rule.action === 'Block' ? '#fca5a5' : rule.action === 'Flag' ? '#fcd34d' : '#86efac'}`,
                borderRadius: 6, padding: '3px 8px', fontSize: 11, fontWeight: 700
              }}>
                {rule.action}
              </span>
            </div>
            <button onClick={() => toggleRule(rule.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, color: rule.enabled ? '#16a34a' : '#94a3b8' }}>
              {rule.enabled ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
            </button>
            <button onClick={() => deleteRule(rule.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#cbd5e1', display: 'flex' }} onMouseOver={e => e.currentTarget.style.color = '#dc2626'} onMouseOut={e => e.currentTarget.style.color = '#cbd5e1'}>
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        {rules.length === 0 && (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-dim)', fontSize: 14 }}>
            <AlertCircle size={32} style={{ marginBottom: 12, opacity: 0.3 }} />
            <p style={{ margin: 0 }}>No rules defined. Click "Add Rule" to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
};

const inputStyle = {
  width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #bae6fd',
  background: 'white', fontSize: 13, color: 'var(--text-main)', outline: 'none', boxSizing: 'border-box'
};

const btnStyle = {
  padding: '10px 18px', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 700
};

export default AlertRulesEngine;
