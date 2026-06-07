import React from 'react';
import { T } from '../utils/theme.js';

export default function CompassWidget({ activePage, onNavigate }) {
  const arms = [
    { dir:'N', page:'onward',  label:'ONWARD',  top:'calc(0% - 22px)', left:'50%', transform:'translateX(-50%)', color:'#e05c5c' },
    { dir:'E', page:'map',     label:'MAP',     top:'50%',   left:'calc(100% + 8px)', transform:'translateY(-50%)', color:'#5b8de8' },
    { dir:'S', page:'skills',  label:'SKILLS',  top:'calc(100% + 8px)', left:'50%', transform:'translateX(-50%)', color:'#55bb78' },
    { dir:'W', page:'paths',   label:'PATHS',   top:'50%',   right:'calc(100% + 8px)', transform:'translateY(-50%)', color:'#e09944' },
  ];
  return (
    <div style={{
      position:'relative', width:56, height:56,
    }}>
      {/* Center button */}
      <button
        onClick={() => onNavigate('constellation')}
        style={{
          position:'absolute', top:'50%', left:'50%',
          transform:'translate(-50%,-50%)',
          width:28, height:28, borderRadius:'50%',
          background: activePage==='constellation' ? T.accent : T.card,
          border:`1.5px solid ${activePage==='constellation' ? T.accent : T.border}`,
          color: activePage==='constellation' ? T.bg : T.muted,
          fontSize:11, fontWeight:800, fontFamily:"'Syne',sans-serif",
          cursor:'pointer', pointerEvents:'all',
          display:'flex', alignItems:'center', justifyContent:'center',
          transition:'all .18s',
          lineHeight:1,
        }}
        title="Constellation"
      >✦</button>
      {/* N tick */}
      <div style={{ position:'absolute', top:'6px', left:'50%', transform:'translateX(-50%)', width:'1.5px', height:'6px', background: activePage==='onward' ? T.accent : T.dim, pointerEvents:'none' }} />
      {/* E tick */}
      <div style={{ position:'absolute', top:'50%', right:'6px', transform:'translateY(-50%)', width:'6px', height:'1.5px', background: activePage==='map' ? T.accent : T.dim, pointerEvents:'none' }} />
      {/* S tick */}
      <div style={{ position:'absolute', bottom:'6px', left:'50%', transform:'translateX(-50%)', width:'1.5px', height:'6px', background: activePage==='skills' ? T.accent : T.dim, pointerEvents:'none' }} />
      {/* W tick */}
      <div style={{ position:'absolute', top:'50%', left:'6px', transform:'translateY(-50%)', width:'6px', height:'1.5px', background: activePage==='paths' ? T.accent : T.dim, pointerEvents:'none' }} />
      {/* Arm labels */}
      {arms.map(a => (
        <button key={a.page}
          onClick={() => onNavigate(a.page)}
          style={{
            position:'absolute',
            top: a.top, left: a.left, right: a.right,
            transform: a.transform,
            pointerEvents:'all',
            background:'none', border:'none', cursor:'pointer',
            fontFamily:"'IBM Plex Mono',monospace",
            fontSize: a.page==='onward' ? 11 : 9,
            fontWeight: 700,
            color: a.color,
            opacity: activePage===a.page ? 1 : 0.55,
            letterSpacing:'.1em', whiteSpace:'nowrap', padding:'3px 4px',
            transition:'opacity .15s',
          }}
        >{a.label}</button>
      ))}
    </div>
  );
}
