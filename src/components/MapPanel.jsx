import React from 'react';
import { T } from '../utils/theme.js';
import { progress } from '../utils/helpers.js';

export default function MapPanel({ hoveredWeek, projects, weeklyInsights, onWeeklyCheckin, companionLoading }) {
  if (hoveredWeek === null) {
    return (
      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:24, textAlign:'center' }}>
        <p style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:11, color:T.muted, lineHeight:1.8 }}>Hover a week<br/>to see goals.</p>
      </div>
    );
  }
  // Build the week's date range
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const weekStart = new Date(startOfMonth);
  weekStart.setDate(weekStart.getDate() + hoveredWeek * 7 - startOfMonth.getDay());
  const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 6);
  const fmtDate = d => d.toLocaleDateString('en-US', { month:'short', day:'numeric' });

  const isInWeek = deadline => {
    const d = new Date(deadline);
    return d >= weekStart && d <= weekEnd;
  };
  const fmtFullDate = d => d ? new Date(d).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' }) : '';
  const daysUntil = d => {
    if (!d) return null;
    const diff = Math.ceil((new Date(d) - new Date()) / (1000 * 60 * 60 * 24));
    return diff;
  };
  const high   = projects.filter(p => p.priority==='high' && p.deadline && isInWeek(p.deadline));
  const low    = projects.filter(p => p.priority!=='high' && p.deadline && isInWeek(p.deadline));
  const overdue = projects.filter(p => {
    if (!p.deadline) return false;
    const d = new Date(p.deadline);
    return d < weekStart && (p.subtasks.filter(s=>s.done).length + p.checkpoints.filter(c=>c.done).length) < (p.subtasks.length + p.checkpoints.length);
  });

  const TierRow = ({ items, label, color }) => items.length === 0 ? null : (
    <div style={{ marginBottom:14 }}>
      <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:8, color, letterSpacing:'.12em', marginBottom:7 }}>{label}</div>
      {items.map(p => {
        const pct = progress(p);
        const days = daysUntil(p.deadline);
        const isOverdue = days !== null && days < 0;
        const isUrgent = days !== null && days >= 0 && days <= 3;
        const deadlineText = isOverdue ? `${Math.abs(days)}d overdue` : days === 0 ? 'Due today' : `${days}d left`;
        const deadlineColor = isOverdue ? '#f77171' : isUrgent ? '#f0b429' : '#56687f';
        return (
          <div key={p.id} style={{ marginBottom:10, padding:'8px 10px', background:'rgba(27,35,54,0.4)', borderRadius:6 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
              <span style={{ fontSize:11, color:T.text, fontWeight:600 }}>{p.title}</span>
              <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:p.color }}>{pct}%</span>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
              <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:deadlineColor }}>
                {isOverdue ? '⚠ ' : isUrgent ? '⚡ ' : ''}{fmtFullDate(p.deadline)} • {deadlineText}
              </span>
            </div>
            <div style={{ height:3, background:T.dim, borderRadius:2 }}>
              <div style={{ height:'100%', width:`${pct}%`, background:p.color, borderRadius:2 }} />
            </div>
          </div>
        );
      })}
    </div>
  );
  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      <div style={{ padding:'18px 18px 14px', borderBottom:`1px solid ${T.border}` }}>
        <div style={{ fontFamily:"'Syne',sans-serif", fontSize:16, fontWeight:700, color:T.accent, marginBottom:2 }}>MAP</div>
        <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:T.muted }}>
          {fmtDate(weekStart)} — {fmtDate(weekEnd)}
        </div>
      </div>
      <div style={{ flex:1, overflowY:'auto', padding:'14px 18px' }}>
        <TierRow items={high}    label="HIGH PRIORITY" color={T.rose} />
        <TierRow items={low}     label="LOW PRIORITY"  color={T.blue} />
        <TierRow items={overdue} label="OVERDUE"       color={T.muted} />
        {high.length===0 && low.length===0 && overdue.length===0 && (
          <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:11, color:T.muted, textAlign:'center', marginTop:16 }}>No goals this week.</div>
        )}

        {/* ── NOVA Weekly Check-in ── */}
        <div style={{ marginTop: 16, borderTop: `1px solid ${T.border}`, paddingTop: 14 }}>
          <div style={{ display:'flex', alignItems:'center', gap: 8, marginBottom: 10 }}>
            <div style={{
              width: 20, height: 20, borderRadius: 5,
              background: `${T.accent}18`, border: `1px solid ${T.accent}40`,
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize: 10,
            }}>✦</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily:"'Syne',sans-serif", fontSize: 11, fontWeight: 700, color: T.accent }}>NOVA Weekly Check-in</div>
              <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize: 8, color: T.muted }}>Goal alignment scan</div>
            </div>
            <button
              onClick={onWeeklyCheckin}
              disabled={companionLoading || weeklyInsights?.loading}
              style={{
                background: companionLoading || weeklyInsights?.loading ? T.border : `${T.accent}18`,
                border: `1px solid ${companionLoading || weeklyInsights?.loading ? T.border : T.accent}40`,
                borderRadius: 5, padding: '5px 10px',
                color: companionLoading || weeklyInsights?.loading ? T.muted : T.accent,
                fontFamily:"'IBM Plex Mono',monospace", fontSize: 8,
                cursor: companionLoading || weeklyInsights?.loading ? 'default' : 'pointer',
                letterSpacing: '0.05em', whiteSpace: 'nowrap',
              }}
            >{weeklyInsights?.loading ? 'Scanning…' : 'Scan Week'}</button>
          </div>

          {weeklyInsights?.loading && (
            <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize: 9, color: T.muted, padding: '8px 0', textAlign:'center' }}>
              NOVA is analyzing your week…
            </div>
          )}

          {weeklyInsights?.error && (
            <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize: 9, color: T.rose, padding: '8px 0' }}>
              {weeklyInsights.error}
            </div>
          )}

          {weeklyInsights?.text && !weeklyInsights?.loading && (
            <div style={{
              background: `${T.accent}08`,
              border: `1px solid ${T.accent}25`,
              borderRadius: 6, padding: '10px 12px',
              fontFamily:"'IBM Plex Mono',monospace",
              fontSize: 10, color: T.text,
              lineHeight: 1.6,
            }}>
              {weeklyInsights.text}
            </div>
          )}

          {!weeklyInsights && (
            <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize: 9, color: T.muted, padding: '4px 0' }}>
              Click "Scan Week" for NOVA's assessment of your weekly goal alignment.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
