import React, { useState } from 'react';
import { T } from '../utils/theme.js';
import { uid } from '../utils/helpers.js';

export default function MindCheckPage({ routines, setRoutines }) {
  const phases = [
    { key:'before', label:'BEFORE', color: T.blue   },
    { key:'during', label:'DURING', color: T.accent },
    { key:'after',  label:'AFTER',  color: T.green  },
  ];
  const [addInputs, setAddInputs] = useState({ before:'', during:'', after:'' });

  const addRoutine = (phase) => {
    const text = addInputs[phase].trim();
    if (!text) return;
    setRoutines(prev => [...prev, { id: uid(), phase, text }]);
    setAddInputs(prev => ({ ...prev, [phase]: '' }));
  };

  return (
    <div style={{ width:'100%', height:'100%', background:T.bg, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      <div style={{ padding:'24px 28px 18px', borderBottom:`1px solid ${T.border}`, flexShrink:0 }}>
        <div style={{ fontFamily:"'Syne',sans-serif", fontSize:20, fontWeight:800, color:T.accent, letterSpacing:'.07em' }}>MIND CHECK</div>
        <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:T.muted, marginTop:3, letterSpacing:'.12em' }}>mental routines for deep work</div>
      </div>
      <div style={{ flex:1, overflowY:'auto', padding:'8px 28px 28px' }}>
        {phases.map(ph => (
          <div key={ph.key} style={{ marginTop:28 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
              <div style={{ height:1, flex:1, background:ph.color, opacity:.25 }} />
              <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, letterSpacing:'.18em', color:ph.color, fontWeight:700 }}>{ph.label}</span>
              <div style={{ height:1, flex:1, background:ph.color, opacity:.25 }} />
            </div>
            {routines.filter(r => r.phase === ph.key).map(r => (
              <div key={r.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 0', borderBottom:`1px solid ${T.border}` }}>
                <div style={{ width:6, height:6, borderRadius:'50%', background:ph.color, flexShrink:0, opacity:.7 }} />
                <span style={{ flex:1, fontFamily:"'IBM Plex Mono',monospace", fontSize:11, color:T.text, lineHeight:1.5 }}>{r.text}</span>
                <button
                  onClick={() => setRoutines(prev => prev.filter(x => x.id !== r.id))}
                  style={{ background:'none', border:'none', color:T.muted, cursor:'pointer', fontSize:14, padding:'0 2px', lineHeight:1, opacity:.4, transition:'opacity .15s' }}
                  onMouseEnter={e => e.currentTarget.style.opacity=1}
                  onMouseLeave={e => e.currentTarget.style.opacity=.4}
                >×</button>
              </div>
            ))}
            <div style={{ display:'flex', gap:6, marginTop:10 }}>
              <input
                value={addInputs[ph.key]}
                onChange={e => setAddInputs(prev => ({ ...prev, [ph.key]: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && addRoutine(ph.key)}
                placeholder={`Add ${ph.label.toLowerCase()} routine...`}
                style={{ flex:1, background:T.card, border:`1px solid ${T.border}`, borderRadius:6, padding:'7px 10px', color:T.text, fontFamily:"'IBM Plex Mono',monospace", fontSize:10, outline:'none' }}
              />
              <button
                onClick={() => addRoutine(ph.key)}
                style={{ background:`${ph.color}18`, border:`1px solid ${ph.color}40`, borderRadius:6, padding:'7px 12px', color:ph.color, cursor:'pointer', fontFamily:"'Syne',sans-serif", fontSize:12, fontWeight:700 }}
              >+</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
