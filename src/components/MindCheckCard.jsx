import React from 'react';
import { T } from '../utils/theme.js';

export default function MindCheckCard({ onMindCheck, onMoveOn }) {
  return (
    <div style={{
      position:'fixed', bottom:76, right:20, zIndex:200,
      background:T.card, border:`1px solid ${T.accent}40`,
      borderRadius:12, padding:'16px 18px', width:250,
      boxShadow:`0 8px 32px rgba(0,0,0,.7)`,
    }}>
      <div style={{ fontFamily:"'Syne',sans-serif", fontSize:13, fontWeight:800, color:T.accent, marginBottom:4 }}>Task Complete ✦</div>
      <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:T.muted, marginBottom:14, lineHeight:1.6 }}>
        Take a moment to review your routines before moving on.
      </div>
      <div style={{ display:'flex', gap:8 }}>
        <button onClick={onMoveOn}
          style={{ flex:1, padding:'7px', borderRadius:6, background:'transparent', border:`1px solid ${T.border}`, color:T.muted, fontFamily:"'Syne',sans-serif", fontSize:11, cursor:'pointer', transition:'all .15s' }}
          onMouseEnter={e => e.currentTarget.style.borderColor=T.muted}
          onMouseLeave={e => e.currentTarget.style.borderColor=T.border}
        >Move On</button>
        <button onClick={onMindCheck}
          style={{ flex:1, padding:'7px', borderRadius:6, background:T.accentLo, border:`1px solid ${T.accent}50`, color:T.accent, fontFamily:"'Syne',sans-serif", fontSize:11, fontWeight:700, cursor:'pointer', transition:'all .15s' }}
          onMouseEnter={e => e.currentTarget.style.background=`${T.accent}22`}
          onMouseLeave={e => e.currentTarget.style.background=T.accentLo}
        >Mind Check</button>
      </div>
    </div>
  );
}
