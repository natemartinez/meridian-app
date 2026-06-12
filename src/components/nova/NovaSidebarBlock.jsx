import React from 'react';
import { T } from '../../utils/theme.js';
import { computePlanningConfidence } from '../../utils/nova.js';

const fmtTime = (mins) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const ap = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${m.toString().padStart(2, '0')}${ap}`;
};

export default function NovaSidebarBlock({
  novaState, waypointOpen, waypointContext,
  prioritizeInput, setPrioritizeInput,
  generateNovaPlan, closeWaypoint, openWaypoint,
  apiKey,
}) {
  const confidence = computePlanningConfidence(novaState.syncEvents);
  const confidenceColor = confidence >= 70 ? T.green : confidence >= 40 ? T.accent : T.muted;
  const confidenceLabel = confidence >= 70 ? 'Knows you well' : confidence >= 40 ? 'Learning fast' : 'Getting started';
  const plan = novaState.dailyPlan;
  const today = new Date().toISOString().slice(0, 10);
  const planItems = (plan?.date === today && plan?.items) ? plan.items : [];
  const insightsOpen = waypointOpen && waypointContext?.type === 'nova-insights';
  const planError = novaState.planError;

  return (
    <div className="sec nova-block">
      <div
        style={{ borderRadius:7, border:`1px solid ${insightsOpen ? T.accent : T.border}`, background:T.card, overflow:'hidden', cursor:'pointer', transition:'border-color .2s' }}
        onClick={() => insightsOpen ? closeWaypoint() : openWaypoint({ type:'nova-insights' })}
      >
        {/* Confidence header */}
        <div style={{ padding:'8px 10px 6px' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:5 }}>
            <div className="nova-lbl" style={{ fontFamily:"'IBM Plex Mono',monospace", color:T.muted, letterSpacing:'.08em' }}>NOVA CONFIDENCE</div>
            <div className="nova-pct" style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, color:confidenceColor }}>{confidence}%</div>
          </div>
          <div style={{ height:3, borderRadius:2, background:T.border, overflow:'hidden', marginBottom:4 }}>
            <div style={{ height:'100%', width:`${confidence}%`, background:confidenceColor, borderRadius:2, transition:'width .5s ease' }} />
          </div>
          <div className="nova-status" style={{ fontFamily:"'IBM Plex Mono',monospace", color:confidenceColor, opacity:.8 }}>{confidenceLabel}</div>
        </div>
        {/* Divider */}
        <div style={{ height:1, background:T.border }} />
        {/* Daily plan header */}
        <div style={{ padding:'6px 10px 4px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div className="plan-lbl" style={{ fontFamily:"'IBM Plex Mono',monospace", color:T.muted, letterSpacing:'.08em' }}>TODAY'S PLAN</div>
          <button
            onClick={e => { e.stopPropagation(); generateNovaPlan(prioritizeInput); }}
            disabled={novaState.planGenLoading || !apiKey}
            className="plan-refresh-btn"
            style={{ background:'none', border:`1px solid ${T.border}`, borderRadius:4, color: novaState.planGenLoading ? T.muted : T.accent, cursor: novaState.planGenLoading || !apiKey ? 'default' : 'pointer', padding:'2px 5px', fontFamily:"'IBM Plex Mono',monospace", letterSpacing:'.05em', opacity: novaState.planGenLoading ? .5 : 1 }}
          >{novaState.planGenLoading ? '···' : 'REFRESH'}</button>
        </div>
        {/* Prioritization input */}
        <div style={{ padding:'0 10px 6px' }} onClick={e => e.stopPropagation()}>
          <input
            value={prioritizeInput}
            onChange={e => setPrioritizeInput(e.target.value)}
            placeholder="What should I prioritize today?"
            style={{ width:'100%', boxSizing:'border-box', background:T.bg, border:`1px solid ${T.border}`, borderRadius:4, padding:'5px 7px', color:T.text, fontFamily:"'IBM Plex Mono',monospace", fontSize:9, outline:'none' }}
            onKeyDown={e => {
              if (e.key === 'Enter' && prioritizeInput.trim()) {
                e.stopPropagation();
                generateNovaPlan(prioritizeInput);
              }
            }}
          />
        </div>
        {/* Plan error message */}
        {planError && (
          <div style={{ padding:'6px 10px', fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:T.rose, lineHeight:1.6, borderTop:`1px solid ${T.border}` }}>
            {planError}
          </div>
        )}
        {/* Plan items */}
        {novaState.planGenLoading && planItems.length === 0 ? (
          <div style={{ padding:'8px 10px', fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:T.muted, textAlign:'center' }}>Building plan…</div>
        ) : planItems.length === 0 && !planError ? (
          <div style={{ padding:'8px 10px', fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:T.muted, lineHeight:1.6 }}>
            {apiKey ? 'No plan yet — complete a Briefing or tap Refresh.' : 'Add an API key to generate plans.'}
          </div>
        ) : planItems.length > 0 ? (
          <div style={{ maxHeight:160, overflowY:'auto', padding:'2px 0 6px' }}>
            {planItems.map((item, idx) => {
              const dotColor = item.complexity === 'high' ? T.rose : item.complexity === 'medium' ? T.accent : T.muted;
              return (
                <div key={item.id} style={{ padding:'5px 10px', display:'flex', alignItems:'flex-start', gap:6, borderBottom: idx < planItems.length - 1 ? `1px solid ${T.border}` : 'none' }}>
                  <div style={{ width:4, height:4, borderRadius:'50%', background:dotColor, marginTop:4, flexShrink:0 }} />
                  <div style={{ flex:1, minWidth:0 }}>
                    <div className="plan-item-title" style={{ fontFamily:"'IBM Plex Mono',monospace", color:T.text, lineHeight:1.4, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.title}</div>
                    <div className="plan-item-meta" style={{ fontFamily:"'IBM Plex Mono',monospace", color:T.muted, marginTop:1 }}>
                      {item.startMinutes !== undefined ? `${fmtTime(item.startMinutes)}` : ''} ~{item.estimatedMinutes}m{item.goalTitle ? ` · ${item.goalTitle.slice(0,18)}${item.goalTitle.length > 18 ? '…' : ''}` : ''}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
