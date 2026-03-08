import React, { useMemo } from 'react';
import { STATE_DATA } from '../utils/data-engine';

// Simple SVG India map using approximate state boundary paths (normalized to a 400x440 viewBox)
const STATE_PATHS = {
  'Maharashtra': 'M165,230 L195,220 L215,240 L220,270 L195,285 L165,275 L150,255 Z',
  'Rajasthan': 'M140,130 L200,120 L220,140 L215,175 L180,185 L145,175 L130,155 Z',
  'Uttar Pradesh': 'M190,130 L250,120 L265,140 L260,165 L230,175 L195,170 L185,150 Z',
  'Gujarat': 'M115,185 L155,175 L165,200 L160,225 L135,235 L110,220 L105,200 Z',
  'Madhya Pradesh': 'M160,185 L215,175 L230,195 L225,225 L200,235 L165,230 L150,210 Z',
  'West Bengal': 'M285,155 L310,145 L320,165 L315,195 L290,200 L275,185 L278,165 Z',
  'Karnataka': 'M165,275 L200,265 L215,285 L210,315 L185,325 L160,310 L152,290 Z',
  'Tamil Nadu': 'M185,315 L215,305 L225,325 L218,360 L195,370 L172,355 L168,330 Z',
  'Bihar': 'M255,145 L290,135 L300,155 L295,178 L265,183 L250,170 Z',
  'Andhra Pradesh': 'M195,265 L235,255 L250,275 L245,310 L215,318 L192,305 L185,285 Z',
  'Telangana': 'M195,245 L230,238 L242,255 L238,278 L210,282 L193,268 Z',
  'Punjab': 'M155,100 L185,93 L195,110 L190,128 L163,133 L148,118 Z',
  'Kerala': 'M165,330 L185,322 L192,345 L188,380 L168,388 L152,372 L155,348 Z',
  'Haryana': 'M160,112 L190,105 L198,120 L194,140 L168,145 L155,130 Z',
  'Delhi': 'M180,130 L190,126 L196,134 L192,144 L182,147 L175,140 Z',
  'Odisha': 'M255,200 L288,193 L298,215 L292,245 L262,250 L248,230 Z',
  'Jharkhand': 'M258,165 L290,158 L300,178 L295,200 L265,205 L252,188 Z',
  'Assam': 'M300,130 L335,122 L345,140 L338,162 L308,168 L295,152 Z',
  'Chhattisgarh': 'M220,205 L257,198 L268,220 L262,255 L230,260 L214,240 Z',
  'Uttarakhand': 'M190,108 L225,100 L235,116 L230,135 L200,140 L185,126 Z',
  'Himachal Pradesh': 'M165,90 L200,83 L212,98 L207,115 L178,120 L160,107 Z',
  'Jammu & Kashmir': 'M155,55 L205,45 L225,65 L215,90 L185,95 L155,82 Z',
  'Goa': 'M150,285 L162,280 L168,292 L163,305 L151,308 L143,298 Z',
  'default': '',
};

const IndiaHeatmap = () => {
  const stateMap = useMemo(() => {
    const map = {};
    STATE_DATA.forEach(s => { map[s.state] = s; });
    return map;
  }, []);

  const getFillColor = (stateName) => {
    const s = stateMap[stateName];
    if (!s) return '#f1f5f9';
    const rate = s.rate;
    if (rate > 2.0) return '#dc2626';
    if (rate > 1.5) return '#ef4444';
    if (rate > 1.0) return '#f97316';
    if (rate > 0.6) return '#f59e0b';
    return '#22c55e';
  };

  return (
    <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 16, padding: '24px', boxShadow: 'var(--card-shadow)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            🗺️ India Fraud Heatmap
          </h3>
          <p style={{ margin: '4px 0 0', color: 'var(--text-dim)', fontSize: 13 }}>State-wise fraud rate distribution</p>
        </div>
        {/* Legend */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {[{ color: '#dc2626', label: 'Critical (>2%)' }, { color: '#f97316', label: 'High (1–2%)' }, { color: '#f59e0b', label: 'Moderate (0.6–1%)' }, { color: '#22c55e', label: 'Low (<0.6%)' }].map(({ color, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 12, height: 12, borderRadius: 3, background: color }} />
              <span style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 500 }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 24 }}>
        {/* SVG Map */}
        <svg viewBox="80 40 290 370" style={{ flex: '0 0 320px', maxWidth: 320 }}>
          {Object.entries(STATE_PATHS).map(([state, path]) => {
            if (state === 'default' || !path) return null;
            const stateData = stateMap[state];
            return (
              <g key={state}>
                <path
                  d={path}
                  fill={getFillColor(state)}
                  stroke="white"
                  strokeWidth="1.5"
                  style={{ cursor: 'pointer', transition: 'opacity 0.2s' }}
                  onMouseOver={e => e.target.style.opacity = '0.7'}
                  onMouseOut={e => e.target.style.opacity = '1'}
                >
                  <title>{state}: {stateData ? `${stateData.rate}% fraud rate, ${stateData.fraud} cases` : 'No data'}</title>
                </path>
              </g>
            );
          })}
        </svg>

        {/* Right side: State list sorted by fraud rate */}
        <div style={{ flex: 1, overflowY: 'auto', maxHeight: 340 }}>
          {STATE_DATA.sort((a, b) => b.rate - a.rate).map((s) => (
            <div key={s.state} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', marginBottom: 6, background: '#f8fafc', borderRadius: 10, border: '1px solid var(--border-color)' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)' }}>{s.state}</div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{s.fraud} cases / {s.volume.toLocaleString()} txns</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 60, height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(s.rate / 3 * 100, 100)}%`, height: '100%', background: getFillColor(s.state), borderRadius: 3 }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 800, color: getFillColor(s.state), minWidth: 36, textAlign: 'right' }}>{s.rate}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default IndiaHeatmap;
