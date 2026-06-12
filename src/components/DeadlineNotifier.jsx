import React from 'react';
import { T } from '../utils/theme.js';

export default function DeadlineNotifier({ deadlineAlerts, onDismiss, onViewInMap }) {
  if (!deadlineAlerts.length) return null;

  return (
    <div className="overlay" onClick={onDismiss}>
      <div className="modal" style={{ width:360, maxHeight:'70vh' }} onClick={e => e.stopPropagation()}>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16 }}>
          <span style={{ fontSize:20 }}>⏰</span>
          <h2 style={{ color:T.accent, fontSize:16, margin:0 }}>Deadline Alerts</h2>
        </div>
        <div style={{ maxHeight:'50vh', overflowY:'auto', marginBottom:16 }}>
          {deadlineAlerts.map(alert => (
            <div key={alert.id} style={{
              padding:'10px 12px',
              background:'rgba(27,35,54,0.5)',
              borderRadius:6,
              marginBottom:8,
              borderLeft:`3px solid ${alert.color}`,
            }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                <span style={{ fontSize:12, color:T.text, fontWeight:600 }}>{alert.title}</span>
                <span style={{
                  fontFamily:"'IBM Plex Mono',monospace",
                  fontSize:9,
                  color:alert.color,
                  padding:'2px 6px',
                  background:`${alert.color}15`,
                  borderRadius:4,
                }}>
                  {alert.type === 'overdue' ? `${Math.abs(alert.days)}d overdue` :
                   alert.days === 0 ? 'Due today' :
                   alert.days === 1 ? '1 day left' :
                   `${alert.days} days left`}
                </span>
              </div>
              <div style={{ fontSize:9, color:T.muted, marginTop:4, fontFamily:"'IBM Plex Mono',monospace" }}>
                {alert.priority === 'high' ? 'High priority' : 'Low priority'} • Click to view in Map
              </div>
            </div>
          ))}
        </div>
        <div className="m-btns" style={{ justifyContent:'space-between' }}>
          <button className="m-cancel" onClick={onDismiss}>Dismiss</button>
          <button className="m-ok" onClick={onViewInMap}>View in Map</button>
        </div>
      </div>
    </div>
  );
}
