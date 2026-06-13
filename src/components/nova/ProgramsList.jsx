import React from 'react';
import { T } from '../../utils/theme.js';

const PROGRAMS = [
  {
    id: 'briefing',
    label: 'Briefing',
    desc: 'Full debrief to start your day',
    color: '#F59E0B',
    icon: (
      <svg width="13" height="13" viewBox="0 0 13 13">
        <circle cx="6.5" cy="6.5" r="5" fill="none" stroke="#F59E0B" strokeWidth="1.4"/>
        <path d="M6.5 4v3l2 1" fill="none" stroke="#F59E0B" strokeWidth="1.3" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: 'focus',
    label: 'Focus',
    desc: 'Quick sprint, get locked in',
    color: T.blue,
    icon: (
      <svg width="13" height="13" viewBox="0 0 13 13">
        <path d="M6.5 1.5 L11.5 6.5 L6.5 11.5 L1.5 6.5 Z" fill="none" stroke={T.blue} strokeWidth="1.4"/>
        <circle cx="6.5" cy="6.5" r="2" fill={T.blue}/>
      </svg>
    ),
  },
  {
    id: 'regroup',
    label: 'Re-group',
    desc: 'Reset and recalibrate',
    color: T.purple,
    icon: (
      <svg width="13" height="13" viewBox="0 0 13 13">
        <path d="M2 6.5 A4.5 4.5 0 0 1 10 3.5" fill="none" stroke={T.purple} strokeWidth="1.4" strokeLinecap="round"/>
        <path d="M11 6.5 A4.5 4.5 0 0 1 3 9.5" fill="none" stroke={T.purple} strokeWidth="1.4" strokeLinecap="round"/>
        <polygon points="10,1.5 12,4 8,4" fill={T.purple}/>
        <polygon points="3,8.5 1,11 5,11" fill={T.purple}/>
      </svg>
    ),
  },
  {
    id: 'preview',
    label: 'Preview',
    desc: 'Plan the next day',
    color: T.cyan,
    icon: (
      <svg width="13" height="13" viewBox="0 0 13 13">
        <path d="M6.5 1.5 L11.5 6.5 L6.5 11.5 L1.5 6.5 Z" fill="none" stroke={T.cyan} strokeWidth="1.4"/>
        <circle cx="6.5" cy="6.5" r="1.5" fill={T.cyan}/>
        <path d="M6.5 4v3l2 1" fill="none" stroke={T.cyan} strokeWidth="1.2" strokeLinecap="round"/>
      </svg>
    ),
  },
];

export default function ProgramsList({ mainPage, onOpenProgram, onBackToHQ, addSyncEvent }) {
  return (
    <div className="sec" style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column', gap:6 }}>
      <div className="secl">
        <span className="pip" style={{ background: T.accent }} />
        PROGRAMS
      </div>
      {PROGRAMS.map(prog => {
        const isActive = mainPage === `program-${prog.id}`;
        return (
          <div
            key={prog.id}
            onClick={() => {
              if (isActive) { onBackToHQ(); }
              else {
                onOpenProgram(prog.id);
                addSyncEvent('program_opened', prog.id);
              }
            }}
            style={{
              display:'flex', alignItems:'center', gap:9, padding:'8px 10px',
              borderRadius:7, cursor:'pointer', userSelect:'none',
              background: isActive ? `${prog.color}18` : 'transparent',
              border: `1px solid ${isActive ? prog.color + '55' : T.border}`,
              transition:'all .15s',
            }}
          >
            <div style={{ width:28, height:28, borderRadius:6, background:`${prog.color}18`, border:`1px solid ${prog.color}30`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              {prog.icon}
            </div>
            <div style={{ flex:1, overflow:'hidden' }}>
              <div style={{ fontFamily:"'Syne',sans-serif", fontSize:11, fontWeight:700, color: isActive ? prog.color : T.text, letterSpacing:'.03em' }}>{prog.label}</div>
              <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:T.muted, marginTop:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{prog.desc}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
