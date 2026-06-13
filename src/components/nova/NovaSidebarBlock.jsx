import React from 'react';
import { T } from '../../utils/theme.js';
import { computePlanningConfidence } from '../../utils/nova.js';

export default function NovaSidebarBlock({
  novaState, mainPage, onOpenInsights, onBackToHQ,
}) {
  const confidence = computePlanningConfidence(novaState.syncEvents);
  const confidenceColor = confidence >= 70 ? T.green : confidence >= 40 ? T.accent : T.muted;
  const confidenceLabel = confidence >= 70 ? 'Knows you well' : confidence >= 40 ? 'Learning fast' : 'Getting started';
  const insightsOpen = mainPage === 'nova-insights';

  return (
    <div className="sec nova-block">
      <div
        style={{ borderRadius:7, border:`1px solid ${insightsOpen ? T.accent : T.border}`, background:T.card, overflow:'hidden', cursor:'pointer', transition:'border-color .2s' }}
        onClick={() => insightsOpen ? onBackToHQ() : onOpenInsights()}
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
      </div>
    </div>
  );
}
