import React, { useState, useEffect } from 'react';
import { T } from '../utils/theme.js';
import { askAI } from '../utils/api.js';
import PomodoroView from './views/PomodoroView.jsx';

function buildLightKnowledgeContext(pool) {
  if (!pool) return '';
  const { entries = [], corrections = '' } = pool;
  const CONF_THRESHOLD = 0.5;
  const manual = entries.filter(e => e.source === 'manual');
  const aiHigh = entries.filter(e => e.source === 'ai' && e.conf >= CONF_THRESHOLD).sort((a, b) => b.conf - a.conf);
  const top = [...manual, ...aiHigh].slice(0, 5);
  if (top.length === 0 && !corrections.trim()) return '';
  const parts = [];
  if (top.length > 0) parts.push('User context: ' + top.map(e => e.text).join('; ') + '.');
  if (corrections.trim()) parts.push('User note: ' + corrections.trim());
  return parts.join(' ');
}

export default function TrackingPage({
  projects, onwardItems, sessions, activeSession, trackingPeriod, setTrackingPeriod,
  startSession, stopSession, sessionDurationMin, getTodayStats, getSessionsForDay,
  getSessionsForWeek, getSessionsForMonth, todayStr,
  apiKey, geminiInput, setGeminiInput, geminiResponse, setGeminiResponse, geminiLoading, setGeminiLoading,
  focus, knowledgePool,
  pomodoroPreselect, onClearPomodoroPreselect,
}) {
  const [trackView, setTrackView] = useState('performance');
  const [hoveredHour, setHoveredHour] = useState(null);
  const [liveMin, setLiveMin] = useState(0);
  const [pomodoroData, setPomodoroData] = useState(() => {
    try { return JSON.parse(localStorage.getItem('meridian_pomodoro') || 'null'); } catch { return null; }
  });

  // Live timer tick for active session
  useEffect(() => {
    if (!activeSession) return;
    const id = setInterval(() => setLiveMin(sessionDurationMin(activeSession)), 5000);
    setLiveMin(sessionDurationMin(activeSession));
    return () => clearInterval(id);
  }, [activeSession]);

  // Poll Pomodoro state from localStorage for the Working Hours card
  useEffect(() => {
    const id = setInterval(() => {
      try { setPomodoroData(JSON.parse(localStorage.getItem('meridian_pomodoro') || 'null')); } catch {}
    }, 5000);
    return () => clearInterval(id);
  }, []);

  const stats = getTodayStats();
  const workWindowMin = 480; // 8 hrs
  const fmtDur = (min) => {
    const h = Math.floor(min / 60), m = min % 60;
    if (h === 0) return `${m} Min`;
    return m === 0 ? `${h} Hour${h!==1?'s':''}` : `${h} Hr${h!==1?'s':''} ${m} Min`;
  };
  const fmtTime = (iso) => {
    const d = new Date(iso);
    const h = d.getHours(), m = d.getMinutes();
    const ampm = h >= 12 ? 'PM' : 'AM';
    return `${h%12||12}:${String(m).padStart(2,'0')} ${ampm}`;
  };

  // Build per-hour session minutes for timeline
  const sessionHourBuckets = () => {
    const allSessions = trackingPeriod === 'day'
      ? [...getSessionsForDay(todayStr()), ...(activeSession ? [activeSession] : [])]
      : trackingPeriod === 'week' ? getSessionsForWeek() : getSessionsForMonth();
    const buckets = {};
    allSessions.forEach(s => {
      const start = new Date(s.startTime);
      const end   = s.endTime ? new Date(s.endTime) : new Date();
      for (let h = start.getHours(); h <= Math.min(end.getHours(), 23); h++) {
        const slotStart = Math.max(start.getTime(), new Date(start).setHours(h, 0, 0, 0));
        const slotEnd   = Math.min(end.getTime(), new Date(start).setHours(h, 59, 59, 999));
        const min = Math.max(0, Math.round((slotEnd - slotStart) / 60000));
        if (!buckets[h]) buckets[h] = { productive: 0, focused: 0 };
        if (s.goalId) buckets[h].productive += min;
        else buckets[h].focused += min;
      }
    });
    return buckets;
  };
  const buckets = sessionHourBuckets();
  const hours = Array.from({ length: 18 }, (_, i) => i + 6);
  const maxBucketMin = Math.max(...hours.map(h => (buckets[h]?.productive||0)+(buckets[h]?.focused||0)), 1);
  const fmtHour = h => { const a = h >= 12 ? 'PM' : 'AM'; return `${h%12||12}${a}`; };

  // Dot grid: 80 dots = 480 min work window (6 min/dot)
  const DOT_TOTAL = 80, DOT_SLOT = 6; // minutes per dot

  // Pomodoro-driven working hours
  const pomodoroHistory = pomodoroData?.history ?? [];
  const todayPomodoros  = pomodoroHistory.filter(h => h.date.startsWith(todayStr()) && h.phase === 'work');
  const completedPomMin = todayPomodoros.reduce((a, h) => a + h.minutes, 0);
  const inProgressMin   = (pomodoroData?.running && pomodoroData?.phase === 'work')
    ? Math.round(((pomodoroData.config?.workMinutes ?? 25) * 60 - (pomodoroData.secondsLeft ?? 0)) / 60)
    : 0;
  const totalPomMin = completedPomMin + inProgressMin;

  const pomDotGrid = Array.from({ length: DOT_TOTAL }, (_, i) => {
    const slotMin = i * DOT_SLOT;
    if (slotMin < completedPomMin) return 'productive';
    if (slotMin < totalPomMin)     return 'active';
    return 'empty';
  });

  // Break ratio
  const breakRatioNumer = Math.round(stats.minSinceBreak / 60 * 10) / 10;
  const breakRatioDenom = 1.5;

  // SVG ring helper
  const Ring = ({ value, max, color, size = 44 }) => {
    const r = (size - 6) / 2, circ = 2 * Math.PI * r;
    const pct = Math.min(value / (max||1), 1);
    return (
      <svg width={size} height={size} style={{ transform:'rotate(-90deg)', flexShrink:0 }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={T.dim} strokeWidth={5} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={5}
          strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)}
          strokeLinecap="round" style={{ transition:'stroke-dashoffset .5s ease' }} />
      </svg>
    );
  };

  const todaySessions = getSessionsForDay(todayStr()).slice().reverse();

  // Gemini check-in
  const handleGeminiCheckin = async (userMsg) => {
    if (!apiKey) { setGeminiResponse('Add your OpenRouter key in Settings first.'); return; }
    setGeminiLoading(true);
    const focusAreas = focus.filter(Boolean).join(', ') || 'none set';
    const goalList = projects.filter(p => p.inFocus).map(p => p.title).join(', ') || 'none';
    const ctx = `Today: ${fmtDur(stats.totalMin)} worked across ${todaySessions.length} session(s). Productive: ${fmtDur(stats.productiveMin)}, Focused: ${fmtDur(stats.focusedMin)}. Focus areas: ${focusAreas}. Active goals: ${goalList}. Onward tasks: ${onwardItems.filter(i=>i.done).length}/${onwardItems.length} done.`;
    const lightCtx = buildLightKnowledgeContext(knowledgePool);
    const system = (`You are a concise time-blocking coach. Give actionable advice in 2-3 sentences. Be direct and practical.${lightCtx ? ' ' + lightCtx : ''}`).trim();
    const response = await askAI(system, userMsg ? `${ctx}\n\nUser: ${userMsg}` : ctx, apiKey);
    setGeminiResponse(response);
    setGeminiLoading(false);
  };

  const dateLabel = new Date().toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' });

  return (
    <div style={{ width:'100%', height:'100%', overflowY:'auto', background:T.bg, padding:'20px 28px', boxSizing:'border-box' }}>
      <div style={{ maxWidth:900, margin:'0 auto' }}>
        {/* ── Tab bar ── */}
        <div style={{ display:'flex', gap:4, background:T.surface, border:`1px solid ${T.border}`, borderRadius:8, padding:4, marginBottom:16, alignSelf:'flex-start' }}>
          {[['performance','PERFORMANCE'],['timer','🍅 TIMER']].map(([v, label]) => (
            <button key={v} onClick={() => setTrackView(v)} style={{
              padding:'5px 14px', borderRadius:5, fontFamily:"'IBM Plex Mono',monospace",
              fontSize:9, fontWeight:700, letterSpacing:'.08em', cursor:'pointer',
              border:'none', transition:'all .15s',
              background: trackView===v ? T.accent : 'transparent',
              color: trackView===v ? T.bg : T.muted,
            }}>{label}</button>
          ))}
        </div>
      </div>

      {trackView === 'performance' && (
      <div style={{ maxWidth:900, margin:'0 auto' }}>

        {/* ── Header ── */}
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
          <div style={{ display:'flex', gap:4, marginLeft:'auto', background:T.surface, border:`1px solid ${T.border}`, borderRadius:8, padding:4 }}>
            {['day','week','month'].map(p => (
              <button key={p} onClick={() => setTrackingPeriod(p)} style={{
                padding:'5px 12px', borderRadius:5, fontFamily:"'IBM Plex Mono',monospace", fontSize:9, fontWeight:700,
                letterSpacing:'.08em', cursor:'pointer', transition:'all .15s', border:'none',
                background: trackingPeriod===p ? T.accent : 'transparent',
                color: trackingPeriod===p ? T.bg : T.muted,
              }}>{p.toUpperCase()}</button>
            ))}
          </div>
          <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:2 }}>
            <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:T.muted }}>{dateLabel}</span>
            {stats.totalMin > 0 && (
              <span style={{ fontFamily:"'Syne',sans-serif", fontSize:11, fontWeight:700, color:T.accent, background:T.accentLo, border:`1px solid ${T.accent}30`, borderRadius:5, padding:'2px 7px' }}>
                Today: {fmtDur(stats.totalMin)}
              </span>
            )}
          </div>
        </div>

        {/* ── Timeline ── */}
        <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:10, padding:'16px 18px', marginBottom:14 }}>
          <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:T.muted, letterSpacing:'.12em', marginBottom:12 }}>TIMELINE</div>
          <div style={{ display:'flex', gap:2, alignItems:'flex-end', height:90 }}>
            {hours.map(h => {
              const prod = buckets[h]?.productive || 0;
              const foc  = buckets[h]?.focused || 0;
              const total = prod + foc;
              const maxH  = 72;
              const prodH = total ? Math.max(4, (prod/maxBucketMin)*maxH) : 0;
              const focH  = total ? Math.max(4, (foc/maxBucketMin)*maxH)  : 0;
              const isNow = new Date().getHours() === h;
              const isActive = activeSession && new Date(activeSession.startTime).getHours() === h;
              return (
                <div key={h} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3, cursor:'default' }}
                  onMouseEnter={() => setHoveredHour(h)} onMouseLeave={() => setHoveredHour(null)}>
                  {hoveredHour === h && total > 0 && (
                    <div style={{ position:'absolute', background:T.card, border:`1px solid ${T.border}`, borderRadius:6, padding:'4px 8px', fontSize:9, fontFamily:"'IBM Plex Mono',monospace", color:T.text, whiteSpace:'nowrap', pointerEvents:'none', marginTop:-32 }}>
                      {prod > 0 && <div style={{ color:T.green }}>{prod}m productive</div>}
                      {foc > 0 && <div style={{ color:T.blue }}>{foc}m focused</div>}
                    </div>
                  )}
                  <div style={{ width:'100%', display:'flex', flexDirection:'column', gap:1, height:maxH, justifyContent:'flex-end' }}>
                    {foc > 0 && <div style={{ width:'100%', height:focH, borderRadius:'2px 2px 0 0', background: isActive?`${T.blue}80`:T.blue, opacity:.8 }} />}
                    {prod > 0 && <div style={{ width:'100%', height:prodH, borderRadius: foc>0?0:'2px 2px 0 0', background: isActive?`${T.green}80`:T.green }} />}
                    {total === 0 && <div style={{ width:'100%', height:4, borderRadius:2, background: isNow?T.accent:T.dim, opacity: isNow?1:.4 }} />}
                  </div>
                  <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:11, fontWeight: isNow ? 700 : 500, color: isNow?T.accent:T.muted }}>{fmtHour(h)}</div>
                </div>
              );
            })}
          </div>
          <div style={{ display:'flex', gap:12, marginTop:8 }}>
            <div style={{ display:'flex', alignItems:'center', gap:4 }}><div style={{ width:8, height:8, borderRadius:2, background:T.green }} /><span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:8, color:T.muted }}>Productive</span></div>
            <div style={{ display:'flex', alignItems:'center', gap:4 }}><div style={{ width:8, height:8, borderRadius:2, background:T.blue }} /><span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:8, color:T.muted }}>Focused</span></div>
          </div>
        </div>

        {/* ── Working Hours + Time Breakdown ── */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14 }}>

          {/* Working Hours */}
          <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:10, padding:'16px 18px' }}>
            <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:T.muted, letterSpacing:'.12em', marginBottom:12 }}>WORKING HOURS</div>
            <div style={{ fontFamily:"'Syne',sans-serif", fontSize:22, fontWeight:800, color:T.text, lineHeight:1 }}>{fmtDur(totalPomMin)}</div>
            <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:T.muted, marginTop:4, marginBottom:12 }}>Total Focus Time</div>
            {/* Dot grid */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(10,1fr)', gap:2 }}>
              {pomDotGrid.map((type, i) => (
                <div key={i} style={{
                  aspectRatio:'1', borderRadius:2,
                  background: type==='productive' ? T.green : type==='active' ? T.accent : T.dim,
                  opacity: type==='empty' ? .25 : 1,
                }} />
              ))}
            </div>
          </div>

          {/* Time Breakdown */}
          <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:10, padding:'16px 18px' }}>
            <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:T.muted, letterSpacing:'.12em', marginBottom:16 }}>TIME BREAKDOWN</div>
            {[
              { label:'Productive Hours', value: stats.productiveMin, color: T.green },
              { label:'Focused Time',     value: stats.focusedMin,    color: T.blue  },
              { label:'Unproductive',     value: Math.max(0, workWindowMin - stats.totalMin), color: T.muted },
            ].map(row => (
              <div key={row.label} style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
                <Ring value={row.value} max={workWindowMin} color={row.color} />
                <div>
                  <div style={{ fontFamily:"'Syne',sans-serif", fontSize:14, fontWeight:700, color:T.text, lineHeight:1 }}>{fmtDur(row.value)}</div>
                  <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:T.muted, marginTop:3 }}>{row.label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Sessions + Break Timer ── */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14 }}>

          {/* Sessions */}
          <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:10, padding:'16px 18px' }}>
            <div style={{ display:'flex', alignItems:'center', marginBottom:12 }}>
              <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:T.muted, letterSpacing:'.12em', flex:1 }}>SESSIONS</span>
              <button onClick={() => startSession()} style={{ background:T.accentLo, border:`1px solid ${T.accent}40`, borderRadius:5, color:T.accent, fontFamily:"'Syne',sans-serif", fontSize:10, fontWeight:700, cursor:'pointer', padding:'3px 8px' }}>+ New</button>
            </div>
            {activeSession && (
              <div style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 0', borderBottom:`1px solid ${T.border}`, marginBottom:4 }}>
                <div style={{ width:7, height:7, borderRadius:'50%', background:T.accent, flexShrink:0, animation:'pulse 1.5s ease-in-out infinite' }} />
                <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:T.muted, width:50, flexShrink:0 }}>{fmtTime(activeSession.startTime)}</span>
                <span style={{ flex:1, fontSize:11, color:T.text }}>{activeSession.label || 'Work Session'}</span>
                <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:T.accent }}>{fmtDur(liveMin)}</span>
              </div>
            )}
            <div style={{ maxHeight:160, overflowY:'auto' }}>
              {todaySessions.length === 0 && !activeSession ? (
                <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:T.muted, textAlign:'center', padding:'16px 0' }}>No sessions yet — start tracking</div>
              ) : todaySessions.map(s => (
                <div key={s.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 0', borderBottom:`1px solid ${T.border}` }}>
                  <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:T.muted, width:50, flexShrink:0 }}>{fmtTime(s.startTime)}</span>
                  <span style={{ flex:1, fontSize:11, color:T.text }}>{s.label || 'Work Session'}</span>
                  <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:s.goalId?T.green:T.muted }}>{fmtDur(sessionDurationMin(s))}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Break Timer */}
          <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:10, padding:'16px 18px' }}>
            <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:T.muted, letterSpacing:'.12em', marginBottom:16 }}>BREAK TIMER</div>
            <div style={{ fontFamily:"'Syne',sans-serif", fontSize:28, fontWeight:800, color: breakRatioNumer > breakRatioDenom ? T.rose : T.text, lineHeight:1, marginBottom:4 }}>
              {breakRatioNumer} / {breakRatioDenom}
            </div>
            <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:T.muted, marginBottom:16 }}>Time Since Last Break (hrs) / Recommended</div>
            <div style={{ marginBottom:14 }}>
              {[
                { label:'Work Time', value: stats.totalMin, color: T.blue },
                { label:'Break Time', value: Math.max(0, workWindowMin - stats.totalMin - stats.minSinceBreak), color: T.green },
              ].map(row => (
                <div key={row.label} style={{ marginBottom:8 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                    <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:8, color:T.muted }}>{row.label}</span>
                    <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:8, color:row.color }}>{fmtDur(row.value)}</span>
                  </div>
                  <div style={{ height:4, background:T.dim, borderRadius:2, overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${Math.min(100,(row.value/workWindowMin)*100)}%`, background:row.color, borderRadius:2 }} />
                  </div>
                </div>
              ))}
            </div>
            <button onClick={stopSession} style={{ width:'100%', padding:'8px 0', borderRadius:7, fontFamily:"'Syne',sans-serif", fontSize:11, fontWeight:700, cursor:'pointer', background:`${T.green}15`, border:`1px solid ${T.green}40`, color:T.green }}>
              Take a Break ↓
            </button>
          </div>
        </div>

        {/* ── AI Check-in ── */}
        <div style={{ background:T.surface, border:`1px solid ${T.accent}30`, borderRadius:10, padding:'16px 18px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
            <span style={{ fontFamily:"'Syne',sans-serif", fontSize:11, fontWeight:800, color:T.accent, letterSpacing:'.08em' }}>✦ AI CHECK-IN</span>
            <button onClick={() => handleGeminiCheckin('')} disabled={geminiLoading}
              style={{ marginLeft:'auto', padding:'4px 10px', borderRadius:5, fontFamily:"'IBM Plex Mono',monospace", fontSize:9, cursor:'pointer', background:T.accentLo, border:`1px solid ${T.accent}40`, color:T.accent, opacity: geminiLoading?0.5:1 }}>
              {geminiLoading ? 'thinking...' : 'Auto Check-in'}
            </button>
          </div>
          {geminiResponse && (
            <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:7, padding:'10px 12px', marginBottom:10, fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:T.text, lineHeight:1.7, whiteSpace:'pre-wrap' }}>
              {geminiResponse}
            </div>
          )}
          {!geminiResponse && (
            <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:T.muted, marginBottom:10 }}>Ask AI about your schedule, time blocks, or productivity...</div>
          )}
          <div style={{ display:'flex', gap:8 }}>
            <input
              value={geminiInput}
              onChange={e => setGeminiInput(e.target.value)}
              onKeyDown={e => e.key==='Enter' && geminiInput.trim() && handleGeminiCheckin(geminiInput)}
              placeholder="Ask about your schedule..."
              style={{ flex:1, background:T.card, border:`1px solid ${T.border}`, borderRadius:6, padding:'7px 10px', color:T.text, fontFamily:"'IBM Plex Mono',monospace", fontSize:10, outline:'none' }}
            />
            <button onClick={() => { if (geminiInput.trim()) { handleGeminiCheckin(geminiInput); setGeminiInput(''); } }} disabled={!geminiInput.trim() || geminiLoading}
              style={{ padding:'7px 16px', borderRadius:6, fontFamily:"'Syne',sans-serif", fontSize:11, fontWeight:700, cursor:'pointer', background:T.accentLo, border:`1px solid ${T.accent}50`, color:T.accent, opacity:!geminiInput.trim()||geminiLoading?0.4:1 }}>
              Ask
            </button>
          </div>
        </div>

      </div>
      )}

      <div style={{ display: trackView === 'timer' ? 'block' : 'none' }}>
        <PomodoroView
          projects={projects}
          onwardItems={onwardItems}
          preselect={pomodoroPreselect}
          onClearPreselect={onClearPomodoroPreselect}
        />
      </div>
    </div>
  );
}
