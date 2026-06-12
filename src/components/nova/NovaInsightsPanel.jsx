import React from 'react';
import { T } from '../../utils/theme.js';
import { computePlanningConfidence } from '../../utils/nova.js';

const evtLabel = { task_accepted:'Accepted', task_rejected:'Rejected', task_completed:'Completed', briefing_done:'Briefing', program_opened:'Opened' };
const evtColor = { task_accepted: T.green, task_rejected: T.rose, task_completed: T.accent, briefing_done: T.blue, program_opened: T.muted };

const relTime = (ts) => {
  const diff = Date.now() - new Date(ts).getTime();
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff/60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff/3600000)}h ago`;
  return `${Math.floor(diff/86400000)}d ago`;
};

export default function NovaInsightsPanel({
  novaState, apiKey, closeWaypoint, generateNovaPlan, calcStreak, getWeeklyData,
}) {
  const confidence = computePlanningConfidence(novaState.syncEvents);
  const confidenceColor = confidence >= 70 ? T.green : confidence >= 40 ? T.accent : T.muted;
  const evts = novaState.syncEvents;
  const accepted  = evts.filter(e => e.type === 'task_accepted').length;
  const rejected  = evts.filter(e => e.type === 'task_rejected').length;
  const completed = evts.filter(e => e.type === 'task_completed').length;
  const total = accepted + rejected;
  const acceptPct   = total > 0 ? Math.round(accepted / total * 100) : 50;
  const completePct = accepted > 0 ? Math.round(Math.min(completed / accepted, 1) * 100) : 0;
  const meaningfulEvts = evts.filter(e => ["task_accepted","task_rejected","task_completed","briefing_done"].includes(e.type));
  const richPct     = Math.round(Math.min(meaningfulEvts.length / 40, 1) * 100);
  const streak      = calcStreak();
  const weekly      = getWeeklyData();
  const avgPerDay   = weekly.length ? (weekly.reduce((s, d) => s + d.count, 0) / weekly.length).toFixed(1) : '0';
  const weekMax     = Math.max(...weekly.map(d => d.count), 1);
  const plan = novaState.dailyPlan;
  const today = new Date().toISOString().slice(0, 10);
  const planItems = (plan?.date === today && plan?.items) ? plan.items : [];
  const recentEvents = [...evts].reverse().slice(0, 12);

  return (
    <>
      <div className="wp-accent" style={{ background: T.accent }} />
      <div className="wp-hd">
        <button className="wp-close" onClick={closeWaypoint}>×</button>
        <div className="wp-badge"><span style={{ color:T.muted }}>Nova</span></div>
        <div className="wp-ttl" style={{ color:T.accent }}>PRODUCTIVITY INSIGHTS</div>
      </div>
      <div style={{ flex:1, overflowY:'auto', padding:'16px 18px', display:'flex', flexDirection:'column', gap:18 }}>

        {/* Confidence breakdown */}
        <div>
          <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:T.muted, letterSpacing:'.1em', marginBottom:10 }}>PLANNING CONFIDENCE</div>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
            <div style={{ fontFamily:"'Syne',sans-serif", fontSize:32, fontWeight:800, color:confidenceColor, lineHeight:1 }}>{confidence}%</div>
            <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:confidenceColor }}>{confidence >= 70 ? 'Nova knows you well' : confidence >= 40 ? 'Nova is learning fast' : 'Nova is getting started'}</div>
          </div>
          {[
            { label:'Suggestion accuracy', pct: acceptPct, detail:`${accepted} accepted / ${rejected} rejected` },
            { label:'Plan completion',     pct: completePct, detail:`${completed} of ${accepted} accepted tasks done` },
            { label:'Data richness',       pct: richPct, detail:`${meaningfulEvts.length} meaningful / ${evts.length} total events` },
          ].map(row => (
            <div key={row.label} style={{ marginBottom:8 }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:T.text }}>{row.label}</div>
                <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:T.muted }}>{row.detail}</div>
              </div>
              <div style={{ height:3, borderRadius:2, background:T.border, overflow:'hidden' }}>
                <div style={{ height:'100%', width:`${row.pct}%`, background: row.pct >= 70 ? T.green : row.pct >= 40 ? T.accent : T.muted, borderRadius:2 }} />
              </div>
            </div>
          ))}
        </div>

        {/* Work pattern */}
        <div>
          <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:T.muted, letterSpacing:'.1em', marginBottom:8 }}>WORK PATTERN</div>
          <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color: novaState.routine ? T.text : T.muted, lineHeight:1.7, background:T.bg, padding:'10px 12px', borderRadius:6, border:`1px solid ${T.border}` }}>
            {novaState.routine?.summary || 'No pattern learned yet — complete a Briefing to begin.'}
          </div>
        </div>

        {/* Performance */}
        <div>
          <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:T.muted, letterSpacing:'.1em', marginBottom:10 }}>PERFORMANCE</div>
          <div style={{ display:'flex', gap:12, marginBottom:12 }}>
            {[
              { label:'Day Streak', value: streak, unit:'days' },
              { label:'Daily Avg',  value: avgPerDay, unit:'tasks/day' },
            ].map(stat => (
              <div key={stat.label} style={{ flex:1, background:T.bg, border:`1px solid ${T.border}`, borderRadius:6, padding:'8px 10px' }}>
                <div style={{ fontFamily:"'Syne',sans-serif", fontSize:20, fontWeight:800, color:T.accent }}>{stat.value}</div>
                <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:8, color:T.muted, marginTop:2 }}>{stat.unit}</div>
                <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:8, color:T.muted }}>{stat.label}</div>
              </div>
            ))}
          </div>
          <div style={{ display:'flex', alignItems:'flex-end', gap:4, height:40 }}>
            {weekly.map(d => (
              <div key={d.day} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
                <div style={{ width:'100%', height: d.count > 0 ? `${Math.round(d.count / weekMax * 32)}px` : '2px', background: d.isToday ? T.accent : d.count > 0 ? `${T.accent}60` : T.border, borderRadius:2, transition:'height .3s' }} />
                <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:7, color: d.isToday ? T.accent : T.muted }}>{d.day}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Today's plan */}
        {planItems.length > 0 && (
          <div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
              <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:T.muted, letterSpacing:'.1em' }}>TODAY'S PLAN</div>
              <button onClick={e => { e.stopPropagation(); generateNovaPlan(); }} disabled={novaState.planGenLoading || !apiKey} style={{ background:'none', border:`1px solid ${T.border}`, borderRadius:4, color: novaState.planGenLoading ? T.muted : T.accent, cursor: novaState.planGenLoading || !apiKey ? 'default' : 'pointer', fontSize:8, padding:'2px 6px', fontFamily:"'IBM Plex Mono',monospace", opacity: novaState.planGenLoading ? .5 : 1 }}>{novaState.planGenLoading ? '···' : 'REFRESH'}</button>
            </div>
            {planItems.map((item, idx) => {
              const dotColor = item.complexity === 'high' ? T.rose : item.complexity === 'medium' ? T.accent : T.muted;
              return (
                <div key={item.id} style={{ padding:'8px 10px', marginBottom:6, background:T.bg, border:`1px solid ${T.border}`, borderLeft:`3px solid ${dotColor}`, borderRadius:4 }}>
                  <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:T.text, marginBottom:3 }}>{item.title}</div>
                  <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                    <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:8, color:T.muted }}>~{item.estimatedMinutes}m</span>
                    {item.goalTitle && <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:8, color:T.muted }}>· {item.goalTitle}</span>}
                    <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:8, padding:'1px 5px', borderRadius:3, background:`${dotColor}20`, color:dotColor, textTransform:'uppercase' }}>{item.complexity}</span>
                  </div>
                  {item.rationale && <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:8, color:T.muted, marginTop:4, lineHeight:1.5, opacity:.8 }}>{item.rationale}</div>}
                </div>
              );
            })}
          </div>
        )}

        {/* Recent activity */}
        {recentEvents.length > 0 && (
          <div>
            <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:T.muted, letterSpacing:'.1em', marginBottom:8 }}>RECENT ACTIVITY</div>
            {recentEvents.map((ev, i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 0', borderBottom: i < recentEvents.length - 1 ? `1px solid ${T.border}` : 'none' }}>
                <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:8, padding:'2px 5px', borderRadius:3, background:`${evtColor[ev.type] || T.muted}20`, color: evtColor[ev.type] || T.muted, textTransform:'uppercase', flexShrink:0 }}>{evtLabel[ev.type] || ev.type}</span>
                <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:T.text, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{ev.detail}</span>
                <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:8, color:T.muted, flexShrink:0 }}>{relTime(ev.ts)}</span>
              </div>
            ))}
          </div>
        )}

      </div>
    </>
  );
}
