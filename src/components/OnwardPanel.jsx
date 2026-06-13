import React, { useState } from 'react';
import { T } from '../utils/theme.js';
import { progress } from '../utils/helpers.js';

const fmtTime = (mins) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const ap = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${m.toString().padStart(2, '0')}${ap}`;
};

export default function OnwardPanel({
  onwardItems, onwardForm, setOnwardForm, projects, onAdd, onDelete, onToggleDone,
  selectedId, onSelectGoal, onToggleFocus, onConfirmDelete, availableTasks,
  onDeleteAvailableTask, onDragStart, onMoveItem, onStartFocus, onReturnToAvailable,
  // New props
  backlogItems = [], deferredItems = [], onRestoreFromBacklog, selectedForToday = [],
  // Plan props
  novaState, prioritizeInput, setPrioritizeInput, generateNovaPlan, apiKey,
}) {
  const [showBacklog, setShowBacklog] = useState(false);

  // Generate time slots from 6:00 to 23:45 in 15-minute increments
  const timeSlots = Array.from({ length: 18 * 4 }, (_, i) => {
    const totalMinutes = (6 * 60) + (i * 15);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return { hour: h, minute: m, value: totalMinutes };
  });
  const fmt = (totalMinutes) => {
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${m.toString().padStart(2, '0')}${ampm}`;
  };
  const today = new Date().toDateString();

  // Filter: show only today's items that are NOT deferred and NOT in backlog
  const todayItems = onwardItems
    .filter(it => (!it.date || it.date === today))
    .filter(it => !deferredItems.find(d => d.id === it.id))
    .filter(it => !backlogItems.find(b => b.id === it.id))
    .sort((a,b) => a.hour - b.hour);

  // Deferred items that should appear today
  const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const todayName = dayNames[new Date().getDay()];
  const visibleDeferred = deferredItems.filter(d => d.deferredTo === todayName);

  // Plan data
  const plan = novaState?.dailyPlan;
  const planDate = new Date().toISOString().slice(0, 10);
  const planItems = (plan?.date === planDate && plan?.items) ? plan.items : [];
  const planError = novaState?.planError;

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      <div style={{ padding:'18px 18px 14px', borderBottom:`1px solid ${T.border}` }}>
        <div style={{ fontFamily:"'Syne',sans-serif", fontSize:16, fontWeight:700, color:T.accent, marginBottom:2 }}>ONWARD</div>
        <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:T.muted }}>today's time blocks</div>
      </div>

      {/* ── Today's Plan (top-right area) ── */}
      <div style={{ padding:'10px 18px', borderBottom:`1px solid ${T.border}`, background:`${T.accent}04` }}>
        {/* Daily plan header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
          <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:T.muted, letterSpacing:'.08em' }}>TODAY'S PLAN</div>
          <button
            onClick={e => { e.stopPropagation(); generateNovaPlan && generateNovaPlan(prioritizeInput); }}
            disabled={novaState?.planGenLoading || !apiKey}
            style={{ background:'none', border:`1px solid ${T.border}`, borderRadius:4, color: novaState?.planGenLoading ? T.muted : T.accent, cursor: novaState?.planGenLoading || !apiKey ? 'default' : 'pointer', padding:'2px 5px', fontFamily:"'IBM Plex Mono',monospace", fontSize:8, letterSpacing:'.05em', opacity: novaState?.planGenLoading ? .5 : 1 }}
          >{novaState?.planGenLoading ? '···' : 'REFRESH'}</button>
        </div>
        {/* Prioritization input */}
        <div style={{ marginBottom:6 }} onClick={e => e.stopPropagation()}>
          <input
            value={prioritizeInput || ''}
            onChange={e => setPrioritizeInput && setPrioritizeInput(e.target.value)}
            placeholder="What should I prioritize today?"
            style={{ width:'100%', boxSizing:'border-box', background:T.bg, border:`1px solid ${T.border}`, borderRadius:4, padding:'5px 7px', color:T.text, fontFamily:"'IBM Plex Mono',monospace", fontSize:9, outline:'none' }}
            onKeyDown={e => {
              if (e.key === 'Enter' && prioritizeInput?.trim()) {
                e.stopPropagation();
                generateNovaPlan && generateNovaPlan(prioritizeInput);
              }
            }}
          />
        </div>
        {/* Plan error message */}
        {planError && (
          <div style={{ padding:'4px 0', fontFamily:"'IBM Plex Mono',monospace", fontSize:8, color:T.rose, lineHeight:1.5 }}>
            {planError}
          </div>
        )}
        {/* Plan items */}
        {novaState?.planGenLoading && planItems.length === 0 ? (
          <div style={{ padding:'6px 0', fontFamily:"'IBM Plex Mono',monospace", fontSize:8, color:T.muted, textAlign:'center' }}>Building plan…</div>
        ) : planItems.length === 0 && !planError ? (
          <div style={{ padding:'6px 0', fontFamily:"'IBM Plex Mono',monospace", fontSize:8, color:T.muted, lineHeight:1.5 }}>
            {apiKey ? 'No plan yet — complete a Briefing or tap Refresh.' : 'Add an API key to generate plans.'}
          </div>
        ) : planItems.length > 0 ? (
          <div style={{ maxHeight:120, overflowY:'auto' }}>
            {planItems.map((item, idx) => {
              const dotColor = item.complexity === 'high' ? T.rose : item.complexity === 'medium' ? T.accent : T.muted;
              return (
                <div key={item.id} style={{ padding:'4px 0', display:'flex', alignItems:'flex-start', gap:6, borderBottom: idx < planItems.length - 1 ? `1px solid ${T.border}` : 'none' }}>
                  <div style={{ width:4, height:4, borderRadius:'50%', background:dotColor, marginTop:4, flexShrink:0 }} />
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:T.text, lineHeight:1.4, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.title}</div>
                    <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:8, color:T.muted, marginTop:1 }}>
                      {item.startMinutes !== undefined ? `${fmtTime(item.startMinutes)}` : ''} ~{item.estimatedMinutes}m{item.goalTitle ? ` · ${item.goalTitle.slice(0,18)}${item.goalTitle.length > 18 ? '…' : ''}` : ''}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>

      {/* Add form */}
      <div style={{ padding:'12px 18px', borderBottom:`1px solid ${T.border}` }}>
        <input
          style={{ width:'100%', boxSizing:'border-box', background:T.card, border:`1px solid ${T.border}`, borderRadius:6, padding:'7px 10px', color:T.text, fontFamily:"'IBM Plex Mono',monospace", fontSize:11, outline:'none', marginBottom:8 }}
          placeholder="Task title..."
          value={onwardForm.title}
          onChange={e => setOnwardForm(f => ({ ...f, title: e.target.value }))}
          onKeyDown={e => e.key==='Enter' && onAdd()}
        />
        <div style={{ display:'flex', gap:6, marginBottom:8 }}>
          <select
            value={onwardForm.hour}
            onChange={e => setOnwardForm(f => ({ ...f, hour: Number(e.target.value) }))}
            style={{ flex:1, background:T.card, border:`1px solid ${T.border}`, borderRadius:6, padding:'6px 8px', color:T.text, fontFamily:"'IBM Plex Mono',monospace", fontSize:11, outline:'none' }}
          >
            {timeSlots.map(t => <option key={t.value} value={t.value}>{fmt(t.value)}</option>)}
          </select>
          <select
            value={onwardForm.priority}
            onChange={e => setOnwardForm(f => ({ ...f, priority: e.target.value }))}
            style={{ flex:1, background:T.card, border:`1px solid ${T.border}`, borderRadius:6, padding:'6px 8px', color:T.text, fontFamily:"'IBM Plex Mono',monospace", fontSize:11, outline:'none' }}
          >
            <option value="low">Low</option>
            <option value="high">High</option>
          </select>
        </div>
        <select
          value={onwardForm.goalId || ''}
          onChange={e => setOnwardForm(f => ({ ...f, goalId: e.target.value || null }))}
          style={{ width:'100%', background:T.card, border:`1px solid ${T.border}`, borderRadius:6, padding:'6px 8px', color:T.text, fontFamily:"'IBM Plex Mono',monospace", fontSize:11, outline:'none', marginBottom:8 }}
        >
          <option value="">No linked goal</option>
          {projects.filter(p => !p.completedAt).map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
        </select>
        <button
          onClick={onAdd}
          disabled={!onwardForm.title.trim()}
          style={{ width:'100%', background:`${T.accent}18`, border:`1px solid ${T.accent}40`, borderRadius:6, padding:'8px', color:T.accent, fontFamily:"'Syne',sans-serif", fontSize:12, fontWeight:700, cursor: onwardForm.title.trim() ? 'pointer' : 'not-allowed', opacity: onwardForm.title.trim() ? 1 : .4 }}
        >+ Add Task</button>
      </div>
      {/* Available Tasks - draggable subtasks/checkpoints */}
      {availableTasks && availableTasks.length > 0 && (
        <div style={{ padding:'12px 18px', borderBottom:`1px solid ${T.border}`, maxHeight:'200px', overflowY:'auto' }}>
          <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:8, color:T.muted, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:8 }}>Available Tasks</div>
          {availableTasks.map(task => (
            <div
              key={`${task.type}-${task.id}`}
              draggable
              onDragStart={() => onDragStart && onDragStart(task)}
              style={{
                display:'flex',
                alignItems:'center',
                gap:8,
                padding:'6px 8px',
                marginBottom:4,
                background:T.card,
                border:`1px solid ${T.border}`,
                borderLeft:`3px solid ${task.goalId ? task.goalColor : T.border}`,
                borderRadius:4,
                cursor:'grab',
                transition:'all 0.15s'
              }}
            >
              <span style={{ flex:1, fontSize:9.5, color:T.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{task.title}</span>
              <span style={{
                fontFamily:"'IBM Plex Mono',monospace",
                fontSize:7,
                padding:'2px 6px',
                borderRadius:3,
                background: task.type === 'subtask' ? `${T.blue}15` : task.type === 'freeform' ? `${T.accent}15` : `${T.purple}15`,
                color: task.type === 'subtask' ? T.blue : task.type === 'freeform' ? T.accent : T.purple,
                textTransform:'uppercase'
              }}>{task.type === 'subtask' ? 'Subtask' : task.type === 'freeform' ? 'Task' : 'Checkpoint'}</span>
              <button
                onClick={(e) => { e.stopPropagation(); onDeleteAvailableTask && onDeleteAvailableTask(task); }}
                style={{
                  background:'none',
                  border:'none',
                  color:T.rose,
                  cursor:'pointer',
                  fontSize:13,
                  lineHeight:1,
                  padding:'0 2px',
                  opacity:0.5,
                  transition:'opacity 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                onMouseLeave={e => e.currentTarget.style.opacity = '0.5'}
                title="Delete task"
              >×</button>
            </div>
          ))}
        </div>
      )}
      {availableTasks && availableTasks.length === 0 && (
        <div style={{ padding:'12px 18px', borderBottom:`1px solid ${T.border}` }}>
          <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:8, color:T.muted, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:4 }}>Available Tasks</div>
          <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:T.muted, textAlign:'center', padding:'8px 0' }}>All caught up!</div>
        </div>
      )}

      {/* ── Selected for Today indicator ── */}
      {selectedForToday.length > 0 && (
        <div style={{ padding:'8px 18px', borderBottom:`1px solid ${T.border}`, background:`${T.green}08` }}>
          <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:8, color:T.green, letterSpacing:'0.08em' }}>
            Today's Focus ({selectedForToday.length}/3)
          </div>
        </div>
      )}

      {/* ── Deferred items visible today ── */}
      {visibleDeferred.length > 0 && (
        <div style={{ padding:'8px 18px', borderBottom:`1px solid ${T.border}` }}>
          <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:8, color:T.accent, letterSpacing:'0.08em', marginBottom:6 }}>DEFERRED — Due Today</div>
          {visibleDeferred.map(d => (
            <div key={d.id} style={{
              display:'flex', alignItems:'center', gap:8,
              padding:'5px 8px', marginBottom:3,
              background: T.card, border:`1px solid ${T.border}`,
              borderRadius:4, opacity: 0.8,
            }}>
              <span style={{ flex:1, fontSize:10, color:T.text }}>{d.title}</span>
              <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:7, color:T.accent, padding:'1px 5px', borderRadius:3, background:`${T.accent}15` }}>DEFERRED</span>
            </div>
          ))}
        </div>
      )}

      {/* Task list */}
      <div style={{ flex:1, overflowY:'auto', padding:'16px 18px' }}>
        {todayItems.length === 0 ? (
          <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:14, color:T.muted, textAlign:'center', marginTop:24, lineHeight:1.8 }}>No tasks yet.<br/>Add your first time block.</div>
        ) : todayItems.map((item, index) => (
          <div key={item.id} style={{ display:'flex', alignItems:'center', gap:16, padding:'18px 0', borderBottom:`1px solid ${T.border}` }}>
            <button
              onClick={() => onToggleDone(item.id)}
              style={{ width:28, height:28, borderRadius:6, border:`3px solid ${item.done ? T.green : T.muted}`, background: item.done ? T.green : 'transparent', flexShrink:0, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', padding:0 }}
            >{item.done && <span style={{ fontSize:16, color:T.bg, lineHeight:1 }}>✓</span>}</button>
            <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:16, fontWeight:700, color:item.done ? T.muted : T.accent, width:70, flexShrink:0 }}>{fmt(item.hour)}</div>
            <span style={{ flex:1, fontSize:18, fontWeight:600, color: item.done ? T.muted : T.text, textDecoration: item.done ? 'line-through' : 'none' }}>{item.title}</span>
            {onStartFocus && !item.done && (
              <button
                onClick={() => onStartFocus(item)}
                title="Start focus session"
                style={{
                  background: 'none',
                  border: 'none',
                  color: T.accent,
                  cursor: 'pointer',
                  fontSize: 14,
                  padding: '0 4px',
                  flexShrink: 0,
                  lineHeight: 1,
                  opacity: 0.7,
                }}
              >▶</button>
            )}
            {onReturnToAvailable && !item.done && (
              <button
                onClick={() => onReturnToAvailable(item.id)}
                title="Move back to Available Tasks"
                style={{ background:'none', border:'none', color:T.muted, cursor:'pointer', fontSize:14, padding:'0 4px', flexShrink:0, lineHeight:1 }}
              >↩</button>
            )}
            {onMoveItem && (
              <div style={{ display:'flex', flexDirection:'column', gap:2, flexShrink:0 }}>
                <button
                  onClick={() => onMoveItem(item.id, -1)}
                  disabled={index === 0}
                  style={{ background:'none', border:'none', color: index === 0 ? T.border : T.muted, cursor: index === 0 ? 'default' : 'pointer', fontSize:10, padding:'0 4px', lineHeight:1 }}
                >▲</button>
                <button
                  onClick={() => onMoveItem(item.id, 1)}
                  disabled={index === todayItems.length - 1}
                  style={{ background:'none', border:'none', color: index === todayItems.length - 1 ? T.border : T.muted, cursor: index === todayItems.length - 1 ? 'default' : 'pointer', fontSize:10, padding:'0 4px', lineHeight:1 }}
                >▼</button>
              </div>
            )}
            <button onClick={() => onDelete(item.id)} style={{ background:'none', border:'none', color:T.muted, cursor:'pointer', fontSize:24, padding:'0 8px', lineHeight:1 }}>×</button>
          </div>
        ))}
      </div>

      {/* ── Backlog Toggle ── */}
      {backlogItems.length > 0 && (
        <div style={{ borderTop:`1px solid ${T.border}` }}>
          <button
            onClick={() => setShowBacklog(!showBacklog)}
            style={{
              width:'100%', padding:'10px 18px',
              background: showBacklog ? `${T.muted}10` : 'transparent',
              border:'none', color: T.muted,
              fontFamily:"'IBM Plex Mono',monospace",
              fontSize: 9, cursor: 'pointer',
              display:'flex', alignItems:'center', gap: 8,
              letterSpacing: '0.05em',
            }}
          >
            <span style={{ flex:1, textAlign:'left' }}>BACKLOG ({backlogItems.length})</span>
            <span>{showBacklog ? '▲' : '▼'}</span>
          </button>
          {showBacklog && (
            <div style={{ maxHeight: 200, overflowY:'auto', padding:'0 18px 12px' }}>
              {backlogItems.map(item => (
                <div key={item.id} style={{
                  display:'flex', alignItems:'center', gap: 8,
                  padding:'6px 8px', marginBottom: 3,
                  background: T.card, border:`1px solid ${T.border}`,
                  borderRadius: 4, opacity: 0.6,
                }}>
                  <span style={{ flex:1, fontSize: 10, color: T.text }}>{item.title}</span>
                  {onRestoreFromBacklog && (
                    <button
                      onClick={() => onRestoreFromBacklog(item.id)}
                      title="Restore to schedule"
                      style={{
                        background:'none', border:'none',
                        color: T.accent, cursor:'pointer',
                        fontSize: 10, padding: '0 4px',
                      }}
                    >↩</button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
