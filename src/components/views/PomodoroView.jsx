import React, { useState, useEffect, useRef } from 'react';
import { T } from '../../utils/theme.js';

const STORAGE_KEY = 'meridian_pomodoro';

const DEFAULT_CONFIG = {
  workMinutes: 25,
};

function loadState() {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    return s ? JSON.parse(s) : null;
  } catch { return null; }
}

function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('[PomodoroView] localStorage write failed:', e);
  }
  try {
    window.electronAPI?.writePomodoroState?.(state);
  } catch (e) {
    console.error('[PomodoroView] IPC writePomodoroState failed:', e);
  }
}

const PHASE = { label: 'Focus', color: '#e05c5c', icon: '🍅' };

export default function PomodoroView({ projects = [], onwardItems = [], preselect = null, onClearPreselect = null }) {
  const saved = loadState();

  const [config, setConfig] = useState(saved?.config ?? DEFAULT_CONFIG);
  const [running, setRunning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(
    saved?.secondsLeft ?? (saved?.config?.workMinutes ?? DEFAULT_CONFIG.workMinutes) * 60
  );
  const [sessionsCompleted, setSessionsCompleted] = useState(saved?.sessionsCompleted ?? 0);
  const [linkedGoalId, setLinkedGoalId] = useState(saved?.linkedGoalId ?? null);
  const [linkedTaskId, setLinkedTaskId] = useState(saved?.linkedTaskId ?? null);
  const [history, setHistory] = useState(saved?.history ?? []);
  const [showSettings, setShowSettings] = useState(false);
  const [editConfig, setEditConfig] = useState(config);
  const [editingSessionId, setEditingSessionId] = useState(null);
  const [editSessionValues, setEditSessionValues] = useState({ minutes: 25, goalId: null });
  const [hoveredSessionId, setHoveredSessionId] = useState(null);

  const intervalRef = useRef(null);
  const secondsRef = useRef(secondsLeft);
  secondsRef.current = secondsLeft;

  // Keep a ref to current state so the setInterval closure can read latest values
  const stateRef = useRef({});
  stateRef.current = { config, running, secondsLeft, sessionsCompleted, linkedGoalId, linkedTaskId, history };

  // Persist state whenever values change (start/pause/reset/config/tick)
  // Includes secondsLeft so applet always sees the latest countdown
  useEffect(() => {
    saveState({
      config,
      running,
      secondsLeft,
      sessionsCompleted,
      linkedGoalId,
      linkedTaskId,
      history,
      phase: 'focus',
      // Absolute endTime so the applet can compute remaining time from timestamps
      endTime: running ? Date.now() + secondsLeft * 1000 : null,
    });
  }, [config, running, secondsLeft, sessionsCompleted, linkedGoalId, linkedTaskId, history]);

  // Apply pre-selection from parent (fired when navigating via "Start Focus" while already mounted)
  useEffect(() => {
    if (!preselect) return;
    setLinkedGoalId(preselect.goalId);
    setLinkedTaskId(preselect.taskId);
    setRunning(false);
    onClearPreselect?.();
  }, [preselect]);

  // Timer tick
  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setSecondsLeft(prev => {
          const next = prev - 1;
          if (prev <= 1) {
            clearInterval(intervalRef.current);
            setRunning(false);
            const { config: cfg, sessionsCompleted: sc, linkedGoalId: lgid, linkedTaskId: ltid, history: hist } = stateRef.current;
            const newCompleted = sc + 1;
            setSessionsCompleted(newCompleted);
            const newEntry = { id: Date.now(), date: new Date().toISOString(), goalId: lgid, minutes: cfg.workMinutes };
            setHistory(h => [...h, newEntry]);
            const resetSecs = cfg.workMinutes * 60;
            saveState({ config: cfg, running: false, secondsLeft: resetSecs, sessionsCompleted: newCompleted, linkedGoalId: lgid, linkedTaskId: ltid, history: [...hist, newEntry], phase: 'focus', endTime: null });
            return resetSecs;
          }
          // Write on every tick so applet sees live countdown
          const { config: cfg, sessionsCompleted: sc, linkedGoalId: lgid, linkedTaskId: ltid, history: hist } = stateRef.current;
          saveState({ config: cfg, running: true, secondsLeft: next, sessionsCompleted: sc, linkedGoalId: lgid, linkedTaskId: ltid, history: hist, phase: 'focus', endTime: Date.now() + next * 1000 });
          return next;
        });
      }, 1000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [running]);

  const startPause = () => setRunning(r => !r);

  const reset = () => {
    setRunning(false);
    clearInterval(intervalRef.current);
    setSecondsLeft(config.workMinutes * 60);
  };

  const saveSettings = () => {
    setConfig(editConfig);
    setRunning(false);
    setSecondsLeft(editConfig.workMinutes * 60);
    setShowSettings(false);
  };

  const deleteSession = (id) => {
    setHistory(h => h.filter(s => s.id !== id));
  };

  const startEditSession = (s) => {
    setEditingSessionId(s.id);
    setEditSessionValues({ minutes: s.minutes, goalId: s.goalId ?? null });
  };

  const updateSession = (id) => {
    setHistory(h => h.map(s =>
      s.id === id ? { ...s, minutes: editSessionValues.minutes, goalId: editSessionValues.goalId } : s
    ));
    setEditingSessionId(null);
  };

  const totalSecs = config.workMinutes * 60;
  const progress = totalSecs > 0 ? 1 - secondsLeft / totalSecs : 0;
  const mins = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const secs = String(secondsLeft % 60).padStart(2, '0');

  // Today's focus sessions
  const todayStr = new Date().toISOString().slice(0, 10);
  const todaySessions = history.filter(h => h.date.startsWith(todayStr));
  const todayMinutes = todaySessions.reduce((acc, s) => acc + s.minutes, 0);

  const linkedGoal = projects.find(p => p.id === linkedGoalId);
  const linkedTask = onwardItems.find(t => t.id === linkedTaskId);
  const todayDateStr = new Date().toDateString();
  const availableTasks = onwardItems.filter(t =>
    !t.done &&
    (!t.date || t.date === todayDateStr) &&
    (linkedGoalId ? t.goalId === linkedGoalId : true)
  );

  // Ring SVG
  const R = 88;
  const circumference = 2 * Math.PI * R;
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <div style={{ padding: '24px 28px', maxWidth: 560, margin: '0 auto', color: T.text, fontFamily: "'IBM Plex Mono', monospace" }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 18, fontWeight: 700, color: T.text, letterSpacing: '.04em' }}>
            POMODORO
          </div>
          <div style={{ fontSize: 10, color: T.muted, marginTop: 2 }}>
            {todaySessions.length} session{todaySessions.length !== 1 ? 's' : ''} · {todayMinutes}m focused today
          </div>
        </div>
        <button
          onClick={() => { setEditConfig(config); setShowSettings(s => !s); }}
          style={{ background: showSettings ? `${T.accent}15` : 'transparent', border: `1px solid ${showSettings ? T.accent + '40' : T.border}`, borderRadius: 6, padding: '5px 10px', color: showSettings ? T.accent : T.muted, cursor: 'pointer', fontSize: 10, fontFamily: "'IBM Plex Mono', monospace" }}
        >⚙ CONFIG</button>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: '16px 20px', marginBottom: 20 }}>
          <div style={{ fontSize: 10, color: T.muted, marginBottom: 12, letterSpacing: '.08em' }}>TIMER SETTINGS</div>
          {[
            { key: 'workMinutes', label: 'Focus duration (min)' },
          ].map(({ key, label }) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 11, color: T.text }}>{label}</span>
              <input
                type="number"
                min={1}
                max={99}
                value={editConfig[key]}
                onChange={e => setEditConfig(c => ({ ...c, [key]: Math.max(1, parseInt(e.target.value) || 1) }))}
                style={{ width: 56, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 5, padding: '4px 8px', color: T.text, fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, textAlign: 'center', outline: 'none' }}
              />
            </div>
          ))}
          <button
            onClick={saveSettings}
            style={{ width: '100%', marginTop: 4, background: `${T.accent}18`, border: `1px solid ${T.accent}40`, borderRadius: 6, padding: '7px', color: T.accent, fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, fontWeight: 700, cursor: 'pointer', letterSpacing: '.06em' }}
          >APPLY & RESET</button>
        </div>
      )}

      {/* Timer ring */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 28 }}>
        <div style={{ position: 'relative', width: 210, height: 210, marginBottom: 16 }}>
          <svg width="210" height="210" style={{ position: 'absolute', top: 0, left: 0, transform: 'rotate(-90deg)' }}>
            {/* Track */}
            <circle cx="105" cy="105" r={R} fill="none" stroke={T.border} strokeWidth="8" />
            {/* Progress */}
            <circle
              cx="105" cy="105" r={R}
              fill="none"
              stroke={PHASE.color}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              style={{ transition: running ? 'stroke-dashoffset 1s linear' : 'none' }}
            />
          </svg>
          {/* Center content */}
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ fontSize: 11, color: PHASE.color, fontWeight: 700, letterSpacing: '.1em', marginBottom: 2 }}>
              {PHASE.icon} {PHASE.label.toUpperCase()}
            </div>
            <div style={{ fontSize: 44, fontWeight: 700, color: T.text, lineHeight: 1, letterSpacing: '-.01em', fontFamily: "'Syne', sans-serif" }}>
              {mins}:{secs}
            </div>
            {running && (
              <div style={{ fontSize: 8, color: T.muted, marginTop: 4, letterSpacing: '.12em' }}>RUNNING</div>
            )}
          </div>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            onClick={startPause}
            style={{
              background: running ? `${T.rose}18` : `${PHASE.color}20`,
              border: `1px solid ${running ? T.rose + '50' : PHASE.color + '60'}`,
              borderRadius: 8, padding: '10px 28px',
              color: running ? T.rose : PHASE.color,
              fontFamily: "'Syne', sans-serif", fontSize: 13, fontWeight: 700,
              cursor: 'pointer', letterSpacing: '.06em', transition: 'all .14s',
            }}
          >{running ? '⏸ PAUSE' : '▶ START'}</button>
          <button
            onClick={reset}
            style={{ background: 'transparent', border: `1px solid ${T.border}`, borderRadius: 8, padding: '10px 16px', color: T.muted, cursor: 'pointer', fontSize: 11, fontFamily: "'IBM Plex Mono', monospace" }}
          >RESET</button>
        </div>
      </div>

      {/* Focus session context: goal + task */}
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: '14px 18px', marginBottom: 16 }}>

        {/* ── Goal row ── */}
        <div style={{ fontSize: 10, color: T.muted, letterSpacing: '.08em', marginBottom: 8 }}>GOAL</div>
        {linkedGoal ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: linkedGoal.color, flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: T.text }}>{linkedGoal.title}</span>
            </div>
            <button
              onClick={() => { setLinkedGoalId(null); setLinkedTaskId(null); }}
              style={{ background: 'none', border: 'none', color: T.muted, cursor: 'pointer', fontSize: 13 }}
            >×</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 120, overflowY: 'auto', marginBottom: 4 }}>
            {projects.filter(p => !p.completedAt).map(p => (
              <button
                key={p.id}
                onClick={() => setLinkedGoalId(p.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'transparent', border: `1px solid ${T.border}`, borderRadius: 6, padding: '6px 10px', cursor: 'pointer', textAlign: 'left', color: T.text, fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, transition: 'border-color .14s' }}
              >
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
                {p.title}
              </button>
            ))}
            {projects.filter(p => !p.completedAt).length === 0 && (
              <div style={{ fontSize: 10, color: T.dim }}>No active goals</div>
            )}
          </div>
        )}

        {/* ── Divider ── */}
        <div style={{ height: 1, background: T.border, margin: '12px 0' }} />

        {/* ── Task row ── */}
        <div style={{ fontSize: 10, color: T.muted, letterSpacing: '.08em', marginBottom: 8 }}>TASK</div>
        {linkedTask ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 7, height: 7, borderRadius: 2, border: `1.5px solid ${PHASE.color}`, flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: T.text }}>{linkedTask.title}</span>
            </div>
            <button
              onClick={() => setLinkedTaskId(null)}
              style={{ background: 'none', border: 'none', color: T.muted, cursor: 'pointer', fontSize: 13 }}
            >×</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 120, overflowY: 'auto' }}>
            {availableTasks.map(t => (
              <button
                key={t.id}
                onClick={() => setLinkedTaskId(t.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'transparent', border: `1px solid ${T.border}`, borderRadius: 6, padding: '6px 10px', cursor: 'pointer', textAlign: 'left', color: T.text, fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, transition: 'border-color .14s' }}
              >
                <div style={{ width: 6, height: 6, borderRadius: 1, border: `1.5px solid ${T.muted}`, flexShrink: 0 }} />
                {t.title}
              </button>
            ))}
            {availableTasks.length === 0 && (
              <div style={{ fontSize: 10, color: T.dim }}>
                {linkedGoalId ? 'No tasks for this goal today' : 'No tasks for today'}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Focus Sessions history */}
      {history.length > 0 && (
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: '14px 18px', marginTop: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontSize: 10, color: T.muted, letterSpacing: '.08em' }}>FOCUS SESSIONS</div>
            <div style={{ fontSize: 10, color: T.muted }}>{history.length} total · {todayMinutes}m today</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 320, overflowY: 'auto' }}>
            {[...history].reverse().map(s => {
              const g = projects.find(p => p.id === s.goalId);
              const dateLabel = new Date(s.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
              const timeLabel = new Date(s.date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

              if (editingSessionId === s.id) {
                return (
                  <div key={s.id} style={{ background: T.bg, border: `1px solid ${T.accent}40`, borderRadius: 6, padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontSize: 10, color: T.muted }}>min</span>
                      <input
                        type="number" min={1} max={480}
                        value={editSessionValues.minutes}
                        onChange={e => setEditSessionValues(v => ({ ...v, minutes: Math.max(1, parseInt(e.target.value) || 1) }))}
                        style={{ width: 52, background: T.card, border: `1px solid ${T.border}`, borderRadius: 4, padding: '3px 6px', color: T.text, fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, outline: 'none', textAlign: 'center' }}
                      />
                      <span style={{ fontSize: 10, color: T.muted }}>goal</span>
                      <select
                        value={editSessionValues.goalId ?? ''}
                        onChange={e => setEditSessionValues(v => ({ ...v, goalId: e.target.value || null }))}
                        style={{ flex: 1, background: T.card, border: `1px solid ${T.border}`, borderRadius: 4, padding: '3px 6px', color: T.text, fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, outline: 'none' }}
                      >
                        <option value="">— none —</option>
                        {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                      </select>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => updateSession(s.id)} style={{ flex: 1, background: `${T.accent}18`, border: `1px solid ${T.accent}40`, borderRadius: 4, padding: '4px', color: T.accent, fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, cursor: 'pointer' }}>SAVE</button>
                      <button onClick={() => setEditingSessionId(null)} style={{ flex: 1, background: 'transparent', border: `1px solid ${T.border}`, borderRadius: 4, padding: '4px', color: T.muted, fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, cursor: 'pointer' }}>CANCEL</button>
                    </div>
                  </div>
                );
              }

              return (
                <div key={s.id}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, padding: '4px 6px', borderRadius: 4, transition: 'background .1s', background: hoveredSessionId === s.id ? T.bg : 'transparent' }}
                  onMouseEnter={() => setHoveredSessionId(s.id)}
                  onMouseLeave={() => setHoveredSessionId(null)}
                >
                  <span style={{ color: T.dim ?? T.muted, fontSize: 9, flexShrink: 0, minWidth: 60 }}>{dateLabel}</span>
                  <span style={{ color: T.muted, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{timeLabel}</span>
                  <span style={{ color: '#e05c5c', flexShrink: 0 }}>🍅</span>
                  <span style={{ color: T.text, flexShrink: 0 }}>{s.minutes}m</span>
                  {g ? (
                    <>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: g.color, flexShrink: 0 }} />
                      <span style={{ color: T.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{g.title}</span>
                    </>
                  ) : <span style={{ flex: 1 }} />}
                  <button
                    onClick={() => startEditSession(s)}
                    style={{ background: 'none', border: 'none', color: T.muted, cursor: 'pointer', fontSize: 11, padding: '0 3px', flexShrink: 0, lineHeight: 1 }}
                  >✎</button>
                  <button
                    onClick={() => deleteSession(s.id)}
                    style={{ background: 'none', border: 'none', color: T.muted, cursor: 'pointer', fontSize: 14, padding: '0 3px', flexShrink: 0, lineHeight: 1 }}
                  >×</button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
