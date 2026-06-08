import React, { useState } from 'react';
import { T } from '../utils/theme.js';
import meridianLogo from '../assets/meridian_logo.png';

export default function ApiKeyScreen({ onSave }) {
  const [val, setVal]       = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState('');

  const handleSave = async () => {
    const trimmed = val.trim();
    if (!trimmed) { setErr('Please enter your API key.'); return; }
    setSaving(true);
    try { await (window.electronAPI?.setApiKey(trimmed) ?? Promise.resolve()); }
    catch { /* storage failed but still update state so the app is usable */ }
    onSave(trimmed);
  };

  return (
    <div style={{ position:'fixed', inset:0, background:T.bg, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:16, padding:'40px 48px', width:440, boxShadow:'0 8px 40px #00000080' }}>
        <img src={meridianLogo} alt="Meridian" style={{ width:180, display:'block', marginBottom:12 }} />
        <div style={{ color:T.muted, fontSize:13, marginBottom:28, lineHeight:1.5 }}>
          Enter your OpenRouter API key to enable AI features.<br/>
          Get a free key at <strong>openrouter.ai</strong> — stored encrypted on this device.
        </div>
        <input
          type="password"
          placeholder="sk-or-..."
          value={val}
          onChange={e => { setVal(e.target.value); setErr(''); }}
          onKeyDown={e => e.key === 'Enter' && handleSave()}
          style={{ width:'100%', boxSizing:'border-box', background:T.surface, border:`1px solid ${err ? T.rose : T.border}`, borderRadius:8, padding:'10px 14px', color:T.text, fontSize:14, fontFamily:'IBM Plex Mono,monospace', outline:'none', marginBottom: err ? 6 : 16 }}
        />
        {err && <div style={{ color:T.rose, fontSize:12, marginBottom:14 }}>{err}</div>}
        <button
          onClick={handleSave}
          disabled={saving}
          style={{ width:'100%', background:T.accent, color:'#07090f', border:'none', borderRadius:8, padding:'11px 0', fontWeight:700, fontSize:14, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}
        >
          {saving ? 'Saving…' : 'Save & Continue'}
        </button>
      </div>
    </div>
  );
}
