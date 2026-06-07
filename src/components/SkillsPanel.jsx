import React, { useState } from 'react';
import { T } from '../utils/theme.js';

export default function SkillsPanel({ skills, selectedSkillId, onUpdateLevel, onAddSubskill }) {
  const [newSub, setNewSub] = useState('');
  const group = skills.find(s => s.id === selectedSkillId);
  if (!group) {
    return (
      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:24, textAlign:'center' }}>
        <p style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:11, color:T.muted, lineHeight:1.8 }}>Click a skill group<br/>to edit it.</p>
      </div>
    );
  }
  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      <div style={{ padding:'18px 18px 14px', borderBottom:`1px solid ${T.border}` }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <div style={{ width:10, height:10, borderRadius:'50%', background:group.color }} />
          <div style={{ fontFamily:"'Syne',sans-serif", fontSize:16, fontWeight:700, color:group.color }}>{group.name}</div>
        </div>
        <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:T.muted, marginTop:2 }}>skill group</div>
      </div>
      <div style={{ flex:1, overflowY:'auto', padding:'14px 18px' }}>
        {group.subskills.map(ss => (
          <div key={ss.id} style={{ marginBottom:16 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
              <span style={{ fontSize:12, color:T.text, fontWeight:600 }}>{ss.name}</span>
              <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:group.color, fontWeight:700 }}>Lv.{ss.level}</span>
            </div>
            <input
              type="range" min={1} max={10} value={ss.level}
              onChange={e => onUpdateLevel(group.id, ss.id, Number(e.target.value))}
              style={{ width:'100%', accentColor:group.color, cursor:'pointer' }}
            />
            <div style={{ display:'flex', gap:2, marginTop:4 }}>
              {Array.from({ length:10 }, (_,i) => (
                <div key={i} style={{ flex:1, height:3, borderRadius:1, background: i < ss.level ? group.color : T.dim }} />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div style={{ padding:'12px 18px', borderTop:`1px solid ${T.border}` }}>
        <div style={{ display:'flex', gap:6 }}>
          <input
            style={{ flex:1, background:T.card, border:`1px solid ${T.border}`, borderRadius:6, padding:'7px 10px', color:T.text, fontFamily:"'IBM Plex Mono',monospace", fontSize:11, outline:'none' }}
            placeholder="New sub-skill..."
            value={newSub}
            onChange={e => setNewSub(e.target.value)}
            onKeyDown={e => { if (e.key==='Enter' && newSub.trim()) { onAddSubskill(group.id, newSub.trim()); setNewSub(''); } }}
          />
          <button
            onClick={() => { if (newSub.trim()) { onAddSubskill(group.id, newSub.trim()); setNewSub(''); } }}
            style={{ background:`${group.color}18`, border:`1px solid ${group.color}40`, borderRadius:6, padding:'7px 12px', color:group.color, fontFamily:"'Syne',sans-serif", fontSize:11, fontWeight:700, cursor:'pointer' }}
          >+</button>
        </div>
      </div>
    </div>
  );
}
