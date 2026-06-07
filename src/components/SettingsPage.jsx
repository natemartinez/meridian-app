import React, { useState, useEffect } from 'react';
import { T } from '../utils/theme.js';

export default function SettingsPage({ apiKey, setApiKey, intensity, setIntensity, showApiKey, setShowApiKey, companionName, setCompanionName, setMainPage }) {
  const [keyVal, setKeyVal]       = useState(apiKey || '');
  const [keySaved, setKeySaved]   = useState(false);
  const [modelVal, setModelVal]   = useState('');
  const [modelSaved, setModelSaved] = useState(false);

  useEffect(() => {
    (window.electronAPI?.getModel() ?? Promise.resolve('')).then(m => setModelVal(m || ''));
  }, []);

  const saveKey = async () => {
    const trimmed = keyVal.trim();
    if (!trimmed) return;
    try { await (window.electronAPI?.setApiKey(trimmed) ?? Promise.resolve()); }
    catch { /* storage error — key still usable for this session */ }
    setApiKey?.(trimmed);
    setKeySaved(true);
    setTimeout(() => setKeySaved(false), 2000);
  };

  const saveModel = async () => {
    const trimmed = modelVal.trim();
    if (!trimmed) return;
    try { await (window.electronAPI?.setModel(trimmed) ?? Promise.resolve()); }
    catch { /* ignore */ }
    setModelSaved(true);
    setTimeout(() => setModelSaved(false), 2000);
  };

  const setLevel = (level, val) => {
    const n = parseInt(val, 10);
    if (isNaN(n) || n < 1) return;
    setIntensity(prev => ({ ...prev, [level]: n }));
  };

  return (
    <div style={{ width:'100%', height:'100%', overflowY:'auto', background:T.bg, padding:'28px 32px', boxSizing:'border-box' }}>
      <div style={{ maxWidth:560, margin:'0 auto' }}>
        <div style={{ marginBottom:28 }}>
          <div style={{ fontFamily:"'Syne',sans-serif", fontSize:20, fontWeight:800, color:T.accent, letterSpacing:'.07em' }}>SETTINGS</div>
          <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:T.muted, marginTop:2 }}>configure meridian</div>
        </div>
        {/* API Key */}
        <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:10, padding:'18px 20px', marginBottom:16 }}>
          <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:T.muted, letterSpacing:'.12em', marginBottom:12 }}>OPENROUTER API KEY</div>
          <div style={{ display:'flex', gap:8, marginBottom:8 }}>
            <input
              type={showApiKey ? 'text' : 'password'}
              value={keyVal}
              onChange={e => { setKeyVal(e.target.value); setKeySaved(false); }}
              onKeyDown={e => e.key === 'Enter' && saveKey()}
              placeholder="sk-or-..."
              style={{ flex:1, background:T.card, border:`1px solid ${T.border}`, borderRadius:6, padding:'8px 12px', color:T.text, fontFamily:"'IBM Plex Mono',monospace", fontSize:11, outline:'none' }}
            />
            <button onClick={() => setShowApiKey(v => !v)}
              style={{ background:'none', border:`1px solid ${T.border}`, borderRadius:6, color:T.muted, fontSize:12, cursor:'pointer', padding:'0 12px', fontFamily:"'IBM Plex Mono',monospace" }}>
              {showApiKey ? 'hide' : 'show'}
            </button>
            <button onClick={saveKey}
              style={{ background: keySaved ? T.green : T.accentLo, border:`1px solid ${keySaved ? T.green : T.accent}50`, borderRadius:6, color: keySaved ? T.green : T.accent, fontSize:12, fontWeight:700, cursor:'pointer', padding:'0 16px', fontFamily:"'Syne',sans-serif", transition:'all .2s' }}>
              {keySaved ? '✓ saved' : 'save'}
            </button>
          </div>
          <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:T.muted }}>OpenRouter API key — used for AI Check-in, Plan My Day, Suggest Subtask</div>
        </div>
        {/* AI Model */}
        <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:10, padding:'18px 20px', marginBottom:16 }}>
          <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:T.muted, letterSpacing:'.12em', marginBottom:12 }}>AI MODEL</div>
          <div style={{ display:'flex', gap:8, marginBottom:8 }}>
            <input
              type="text"
              value={modelVal}
              onChange={e => { setModelVal(e.target.value); setModelSaved(false); }}
              onKeyDown={e => e.key === 'Enter' && saveModel()}
              placeholder="provider/model-name:free"
              style={{ flex:1, background:T.card, border:`1px solid ${T.border}`, borderRadius:6, padding:'8px 12px', color:T.text, fontFamily:"'IBM Plex Mono',monospace", fontSize:11, outline:'none' }}
            />
            <button onClick={saveModel}
              style={{ background: modelSaved ? T.green : T.accentLo, border:`1px solid ${modelSaved ? T.green : T.accent}50`, borderRadius:6, color: modelSaved ? T.green : T.accent, fontSize:12, fontWeight:700, cursor:'pointer', padding:'0 16px', fontFamily:"'Syne',sans-serif", transition:'all .2s' }}>
              {modelSaved ? '✓ saved' : 'save'}
            </button>
          </div>
          <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:T.muted }}>OpenRouter model ID — find free models at openrouter.ai/models</div>
        </div>
        {/* AI Companion Name */}
        <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:10, padding:'18px 20px', marginBottom:16 }}>
          <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:T.muted, letterSpacing:'.12em', marginBottom:12 }}>AI COMPANION</div>
          <div style={{ display:'flex', gap:8 }}>
            <input
              type="text"
              value={companionName}
              onChange={e => setCompanionName(e.target.value)}
              placeholder="AI Companion"
              maxLength={32}
              style={{ flex:1, background:T.card, border:`1px solid ${T.border}`, borderRadius:6, padding:'8px 12px', color:T.text, fontFamily:"'IBM Plex Mono',monospace", fontSize:11, outline:'none' }}
            />
          </div>
          <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:T.muted, marginTop:8 }}>Name shown in the AI companion header on the Waypoint panel</div>
        </div>

        {/* Nova Knowledge Pool */}
        <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:10, padding:'18px 20px', marginBottom:16 }}>
          <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:T.muted, letterSpacing:'.12em', marginBottom:4 }}>NOVA KNOWLEDGE POOL</div>
          <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:T.dim, marginBottom:14 }}>Manage what Nova knows about you — AI-inferred facts and your manual corrections</div>
          <button onClick={() => setMainPage?.('knowledge-pool')}
            style={{ background:'none', border:`1px solid rgba(240,180,41,0.3)`, borderRadius:6, color:T.accent, fontFamily:"'IBM Plex Mono',monospace", fontSize:10, padding:'7px 16px', cursor:'pointer', letterSpacing:'.04em' }}>
            Open Knowledge Pool →
          </button>
        </div>

        {/* Time-blocking intensity */}
        <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:10, padding:'18px 20px' }}>
          <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:T.muted, letterSpacing:'.12em', marginBottom:4 }}>TIME-BLOCKING</div>
          <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:T.dim, marginBottom:16 }}>Duration per focus block by intensity level</div>
          {[
            { key:'low',    label:'LOW',    color:T.blue  },
            { key:'medium', label:'MEDIUM', color:T.accent },
            { key:'high',   label:'HIGH',   color:T.rose  },
          ].map(row => (
            <div key={row.key} style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
              <div style={{ width:60, fontFamily:"'IBM Plex Mono',monospace", fontSize:10, fontWeight:600, color:row.color, letterSpacing:'.06em' }}>{row.label}</div>
              <input
                type="number"
                min="1"
                value={intensity[row.key]}
                onChange={e => setLevel(row.key, e.target.value)}
                style={{ width:64, background:T.card, border:`1px solid ${T.border}`, borderRadius:6, padding:'6px 10px', color:T.text, fontFamily:"'IBM Plex Mono',monospace", fontSize:12, outline:'none', textAlign:'center' }}
              />
              <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:T.muted }}>min</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
