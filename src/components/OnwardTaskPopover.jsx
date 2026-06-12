import React from 'react';
import { T } from '../utils/theme.js';

export default function OnwardTaskPopover({ item, cardX, cardY, projects, onStartFocus, onToggleDone, onClose }) {
  const fmt = (m) => {
    const h = Math.floor(m / 60);
    const min = m % 60;
    const ap = h >= 12 ? 'PM' : 'AM';
    return `${h % 12 || 12}:${min.toString().padStart(2, '0')}${ap}`;
  };
  const color = item.priority === 'high' ? T.rose : T.blue;
  const linkedGoal = projects.find(p => p.id === item.goalId);

  return (
    <div style={{ position:'fixed', inset:0, zIndex:300 }} onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position:'fixed',
          left: Math.min(cardX + 8, window.innerWidth - 260),
          top:  Math.min(cardY + 8, window.innerHeight - 200),
          width:240,
          background:'#0d1017',
          border:`1px solid ${color}55`,
          borderRadius:10,
          padding:'14px 16px',
          boxShadow:'0 8px 32px rgba(0,0,0,.6)',
          zIndex:301,
        }}
      >
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
          <div style={{ width:6, height:6, borderRadius:'50%', background:color, flexShrink:0 }} />
          <span style={{ fontFamily:"'Syne',sans-serif", fontSize:13, fontWeight:700, color:T.text, flex:1 }}>{item.title}</span>
          <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:color }}>{fmt(item.hour)}</span>
        </div>
        {linkedGoal && (
          <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:T.muted, marginBottom:10 }}>
            ↳ {linkedGoal.title}
          </div>
        )}
        <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
          <button
            onClick={() => onStartFocus(item)}
            style={{ background:`${T.green}18`, border:`1px solid ${T.green}55`, borderRadius:6, color:T.green, padding:'8px 0', fontFamily:"'Syne',sans-serif", fontSize:11, fontWeight:700, cursor:'pointer', letterSpacing:'.06em' }}
          >▶ Start Focus Session</button>
          <button
            onClick={() => onToggleDone(item)}
            style={{ background: item.done ? `${T.muted}18` : `${color}18`, border:`1px solid ${item.done ? T.muted : color}55`, borderRadius:6, color: item.done ? T.muted : color, padding:'7px 0', fontFamily:"'IBM Plex Mono',monospace", fontSize:11, cursor:'pointer' }}
          >{item.done ? '↩ Mark Undone' : '✓ Mark Done'}</button>
        </div>
      </div>
    </div>
  );
}
