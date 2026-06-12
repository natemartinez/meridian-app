import React from 'react';
import { T } from '../../utils/theme.js';
import { progress } from '../../utils/helpers.js';

export default function GoalDetailPanel({
  proj,
  renamingGoalId, renameValue, setRenamingGoalId, setRenameValue,
  addInput, setAddInput,
  toggleSubtask, toggleCheckpoint, deleteSubtask, deleteCheckpoint,
  addSubtask, addCheckpoint, completeGoal, renameGoal,
  closeWaypoint, setConfirmDelete,
  sunId, setSunId,
  companionLoading, aiMsg, companionName,
  checkIn, suggestSubtask,
}) {
  if (!proj) return null;
  const pct = progress(proj);

  return (
    <>
      <div className="wp-accent" style={{ background: proj.color }} />
      <div className="wp-hd">
        <button className="wp-close" onClick={closeWaypoint}>×</button>
        <div className="wp-badge">
          <span style={{ width:5, height:5, borderRadius:'50%', background:proj.color, display:'inline-block' }} />
          <span style={{ color: proj.color }}>Goal</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          {renamingGoalId === proj.id ? (
            <input
              autoFocus
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              onBlur={() => { renameGoal(proj.id, renameValue); setRenamingGoalId(null); }}
              onKeyDown={e => {
                if (e.key === 'Enter') { renameGoal(proj.id, renameValue); setRenamingGoalId(null); }
                if (e.key === 'Escape') setRenamingGoalId(null);
              }}
              style={{ flex:1, background:'transparent', border:'none', borderBottom:`1px solid ${proj.color}`, color:proj.color, fontFamily:"'Syne',sans-serif", fontSize:15, fontWeight:700, outline:'none', padding:'2px 0', width:'100%' }}
            />
          ) : (
            <div className="wp-ttl" style={{ color: proj.color, flex:1 }}>{proj.title}</div>
          )}
          <button
            title="Rename goal"
            onClick={() => { setRenamingGoalId(proj.id); setRenameValue(proj.title); }}
            style={{ background:'none', border:'none', color:T.muted, cursor:'pointer', fontSize:12, padding:'2px 4px', flexShrink:0, lineHeight:1 }}
          >✎</button>
          <button
            title="Delete goal"
            onClick={() => setConfirmDelete(proj.id)}
            style={{ background:'none', border:'none', color:T.rose, cursor:'pointer', fontSize:14, padding:'2px 4px', flexShrink:0, lineHeight:1, opacity:.7 }}
          >🗑</button>
        </div>
        {proj.desc && <div className="wp-dsc">{proj.desc}</div>}
      </div>
      <div className="wp-pg">
        <div className="wp-pgr">
          <span>Progress</span>
          <span style={{ fontSize:12, fontWeight:700, color: proj.color }}>{pct}%</span>
        </div>
        <div className="wp-pgtr">
          <div className="wp-pgf" style={{ width:`${pct}%`, background: proj.color }} />
        </div>
      </div>
      <div className="wp-bdy">
        {proj.subtasks.length > 0 && (
          <>
            <div className="wsh">
              <svg width="10" height="10" viewBox="0 0 10 10"><rect x="1" y="1" width="8" height="8" rx="1.5" fill="none" stroke={T.muted} strokeWidth="1.2"/><path d="M3 5l1.5 1.5 3-3" fill="none" stroke={T.muted} strokeWidth="1.2" strokeLinecap="round"/></svg>
              Subtasks
            </div>
            {proj.subtasks.map(st => (
              <div key={st.id} className="wti">
                <div className={`wck${st.done ? ' done' : ''}`} onClick={() => toggleSubtask(proj.id, st.id)}>
                  {st.done && <svg width="8" height="8" viewBox="0 0 8 8"><path d="M1 4l2 2 4-4" fill="none" stroke={T.green} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </div>
                <div className={`wtx${st.done ? ' dn' : ''}`}>{st.title}</div>
                <button className="w-del" onClick={() => deleteSubtask(proj.id, st.id)}>×</button>
              </div>
            ))}
          </>
        )}
        {proj.checkpoints.length > 0 && (
          <>
            <div className="wsh" style={{ marginTop: proj.subtasks.length ? 10 : 0 }}>
              <svg width="10" height="10" viewBox="0 0 10 10"><rect x="1.5" y="1.5" width="7" height="7" rx="1.5" fill="none" stroke={T.blue} strokeWidth="1.2" transform="rotate(45 5 5)"/></svg>
              <span style={{ color: T.blue }}>Checkpoints</span>
            </div>
            {proj.checkpoints.map(cp => (
              <div key={cp.id} className="wti">
                <div className={`wdm${cp.done ? ' done' : ''}`} onClick={() => toggleCheckpoint(proj.id, cp.id)}>
                  {cp.done && <svg width="7" height="7" viewBox="0 0 7 7" style={{ transform:'rotate(-45deg)' }}><path d="M1 3.5l1.8 1.8 3.5-3.5" fill="none" stroke={T.blue} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </div>
                <div className="wtx">{cp.title}</div>
                <button className="w-del" onClick={() => deleteCheckpoint(proj.id, cp.id)}>×</button>
              </div>
            ))}
          </>
        )}
        <div className="w-add-row">
          <input
            className="w-add-inp"
            placeholder="Add subtask or checkpoint..."
            value={addInput}
            onChange={e => setAddInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addSubtask()}
          />
        </div>
        <div style={{ display:'flex', gap:5, marginTop:5 }}>
          <button className="w-add-btn" onClick={addSubtask} disabled={!addInput.trim()}>+ Task</button>
          <button className="w-add-btn" onClick={addCheckpoint} disabled={!addInput.trim()}>◆ CP</button>
        </div>
        {pct === 100 && !proj.completedAt && (
          <button
            onClick={() => completeGoal(proj.id)}
            style={{ marginTop:10, width:'100%', background:`${T.green}12`, border:`1px solid ${T.green}40`, borderRadius:6, padding:'7px', color:T.green, fontFamily:"'Syne',sans-serif", fontSize:10, fontWeight:700, cursor:'pointer', letterSpacing:'.05em' }}
          >✓ Mark Complete</button>
        )}
        {sunId !== proj.id && (
          <button
            onClick={() => setSunId(proj.id)}
            style={{ marginTop:10, width:'100%', background:`${T.accent}12`, border:`1px solid ${T.accent}35`, borderRadius:6, padding:'7px', color:T.accent, fontFamily:"'Syne',sans-serif", fontSize:10, fontWeight:700, cursor:'pointer', letterSpacing:'.05em' }}
          >☀ Make Focus Sun</button>
        )}
        {sunId === proj.id && (
          <div style={{ marginTop:10, textAlign:'center', fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:T.accent, opacity:.7 }}>★ This is the Focus Sun</div>
        )}
      </div>
      <div className="wp-ai">
        <div className="wp-ai-h">
          <div className="wp-ai-orb">
            <svg width="13" height="13" viewBox="0 0 13 13"><polygon points="6.5,1 8,5 12.5,5.2 9.2,8 10.3,12.5 6.5,9.8 2.7,12.5 3.8,8 0.5,5.2 5,5" fill="currentColor"/></svg>
          </div>
          <div>
            <div className="wp-ai-lbl">{companionName}</div>
            <div className="wp-ai-sub">Contextual reflection</div>
          </div>
          <div className="wp-ai-dot" />
        </div>
        <div className="wp-ai-b">
          <div className="wp-ai-msg">
            {companionLoading ? 'thinking...' : (aiMsg || 'Ask for a check-in or subtask suggestion.')}
          </div>
          <div className="wp-ai-btns">
            <button
              className="waib"
              style={{ color: proj.color, borderColor:`${proj.color}40`, background:`${proj.color}10` }}
              onClick={checkIn}
              disabled={companionLoading}
            >✦ Check In</button>
            <button
              className="waib"
              style={{ color: T.purple, borderColor:`${T.purple}40`, background:`${T.purple}10` }}
              onClick={suggestSubtask}
              disabled={companionLoading}
            >+ Suggest</button>
          </div>
        </div>
      </div>
    </>
  );
}
