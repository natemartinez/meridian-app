import React, { useState, useEffect, useRef, useCallback } from 'react';
import { T } from '../../utils/theme.js';
import { uid } from '../../utils/helpers.js';

const POMODORO_KEY = 'meridian_pomodoro';

function loadPomodoroState() {
  try {
    const raw = localStorage.getItem(POMODORO_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* empty */ }
  return null;
}

export default function FocusScreen({
  taskTitle,
  taskId,
  goalId,
  onExit,
  onSessionComplete,
  onBrainDump,
  brainDumpEntries = [],
  projects = [],
}) {
  const WORK_DURATION = 25; // minutes
  const TOTAL_SECONDS = WORK_DURATION * 60;

  const [timeLeft, setTimeLeft] = useState(TOTAL_SECONDS);
  const [isRunning, setIsRunning] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [focusRating, setFocusRating] = useState(null);
  const [dumpInput, setDumpInput] = useState('');
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const intervalRef = useRef(null);
  const startTimeRef = useRef(null);

  // Load existing pomodoro state on mount
  useEffect(() => {
    const saved = loadPomodoroState();
    if (saved && saved.isRunning && saved.endTime) {
      const remaining = Math.max(0, Math.round((saved.endTime - Date.now()) / 1000));
      if (remaining > 0) {
        setTimeLeft(remaining);
        setIsRunning(true);
        startTimeRef.current = saved.startTime;
        setSessionId(saved.sessionId || uid());
      }
    } else {
      setSessionId(uid());
    }
  }, []);

  // Timer tick
  useEffect(() => {
    if (!isRunning) return;
    intervalRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
          setIsRunning(false);
          setIsComplete(true);
          // Save completed session
          const elapsed = WORK_DURATION * 60;
          const session = {
            id: sessionId,
            label: taskTitle || 'Focus session',
            goalId: goalId || null,
            duration: WORK_DURATION,
            startTime: startTimeRef.current || Date.now() - elapsed * 1000,
            ts: Date.now(),
          };
          onSessionComplete && onSessionComplete(session);
          // Clear pomodoro state
          localStorage.removeItem(POMODORO_KEY);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, [isRunning, sessionId, taskTitle, goalId, onSessionComplete]);

  // Persist state to localStorage
  useEffect(() => {
    if (!isRunning) return;
    const endTime = Date.now() + timeLeft * 1000;
    localStorage.setItem(POMODORO_KEY, JSON.stringify({
      isRunning: true,
      endTime,
      startTime: startTimeRef.current,
      sessionId,
      label: taskTitle,
      goalId,
    }));
  }, [isRunning, timeLeft, sessionId, taskTitle, goalId]);

  const startTimer = useCallback(() => {
    startTimeRef.current = Date.now();
    setIsRunning(true);
  }, []);

  const pauseTimer = useCallback(() => {
    setIsRunning(false);
  }, []);

  const handleDumpSubmit = useCallback((e) => {
    if (e.key === 'Enter' && dumpInput.trim()) {
      onBrainDump && onBrainDump({
        id: uid(),
        text: dumpInput.trim(),
        timestamp: Date.now(),
        sessionId,
      });
      setDumpInput('');
    }
  }, [dumpInput, sessionId, onBrainDump]);

  const handleExit = useCallback(() => {
    if (isRunning) {
      setShowExitConfirm(true);
    } else {
      onExit && onExit();
    }
  }, [isRunning, onExit]);

  const confirmExit = useCallback(() => {
    if (isRunning) {
      pauseTimer();
      localStorage.removeItem(POMODORO_KEY);
    }
    onExit && onExit();
  }, [isRunning, pauseTimer, onExit]);

  // Format time as MM:SS
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const timeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  // Progress percentage
  const progress = ((TOTAL_SECONDS - timeLeft) / TOTAL_SECONDS) * 100;

  // Find linked goal color
  const linkedGoal = goalId ? projects.find(p => p.id === goalId) : null;
  const accentColor = linkedGoal?.color || T.accent;

  // Session complete view
  if (isComplete) {
    return (
      <div style={{
        position:'fixed', inset:0, zIndex:500,
        background: '#07090f',
        display:'flex', flexDirection:'column',
        alignItems:'center', justifyContent:'center',
        color: T.text,
      }}>
        <div style={{
          fontFamily:"'Syne',sans-serif",
          fontSize: 32,
          fontWeight: 800,
          color: T.green,
          marginBottom: 12,
        }}>Session Complete ✦</div>
        <div style={{
          fontFamily:"'IBM Plex Mono',monospace",
          fontSize: 14,
          color: T.muted,
          marginBottom: 32,
        }}>{taskTitle || 'Focus session'}</div>

        {/* Focus rating */}
        <div style={{
          fontFamily:"'IBM Plex Mono',monospace",
          fontSize: 11,
          color: T.muted,
          marginBottom: 16,
          letterSpacing: '0.05em',
        }}>How was your focus?</div>
        <div style={{ display:'flex', gap: 12, marginBottom: 40 }}>
          {[1,2,3,4,5].map(n => (
            <button
              key={n}
              onClick={() => setFocusRating(n)}
              style={{
                width: 44, height: 44, borderRadius: '50%',
                border: `2px solid ${focusRating === n ? accentColor : T.border}`,
                background: focusRating === n ? `${accentColor}20` : 'transparent',
                color: focusRating === n ? accentColor : T.muted,
                fontFamily:"'Syne',sans-serif",
                fontSize: 16, fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >{n}</button>
          ))}
        </div>

        {/* Brain dump entries review */}
        {brainDumpEntries.filter(e => e.sessionId === sessionId).length > 0 && (
          <div style={{
            maxWidth: 400, width: '80%',
            marginBottom: 32,
            background: `${T.card}80`,
            borderRadius: 8,
            padding: '14px 18px',
            border: `1px solid ${T.border}`,
          }}>
            <div style={{
              fontFamily:"'IBM Plex Mono',monospace",
              fontSize: 9, color: T.muted,
              marginBottom: 10,
              letterSpacing: '0.1em',
            }}>BRAIN DUMP — DISTRACTIONS INTERCEPTED</div>
            {brainDumpEntries.filter(e => e.sessionId === sessionId).map(e => (
              <div key={e.id} style={{
                fontFamily:"'IBM Plex Mono',monospace",
                fontSize: 11, color: T.text,
                padding: '6px 0',
                borderBottom: `1px solid ${T.border}`,
              }}>{e.text}</div>
            ))}
          </div>
        )}

        <button
          onClick={() => {
            onExit && onExit();
          }}
          style={{
            padding: '12px 32px',
            borderRadius: 8,
            background: `${accentColor}20`,
            border: `1px solid ${accentColor}50`,
            color: accentColor,
            fontFamily:"'Syne',sans-serif",
            fontSize: 14, fontWeight: 700,
            cursor: 'pointer',
            letterSpacing: '0.06em',
          }}
        >Continue</button>
      </div>
    );
  }

  return (
    <div style={{
      position:'fixed', inset:0, zIndex:500,
      background: '#07090f',
      display:'flex', flexDirection:'column',
      alignItems:'center', justifyContent:'center',
      color: T.text,
      userSelect:'none',
    }}>
      {/* Exit button */}
      <button
        onClick={handleExit}
        style={{
          position:'absolute', top: 24, right: 24,
          background: 'none', border: 'none',
          color: T.muted, fontSize: 24,
          cursor: 'pointer', padding: '8px 12px',
          fontFamily:"'IBM Plex Mono',monospace",
          opacity: 0.6,
        }}
      >Esc ×</button>

      {/* Task title */}
      <div style={{
        fontFamily:"'Syne',sans-serif",
        fontSize: 18,
        fontWeight: 600,
        color: accentColor,
        marginBottom: 48,
        maxWidth: '70%',
        textAlign: 'center',
        lineHeight: 1.4,
      }}>{taskTitle || 'Focus Session'}</div>

      {/* Timer */}
      <div style={{
        fontFamily:"'IBM Plex Mono',monospace",
        fontSize: 96,
        fontWeight: 300,
        color: T.text,
        letterSpacing: '0.05em',
        marginBottom: 8,
        lineHeight: 1,
      }}>{timeStr}</div>

      {/* Progress bar */}
      <div style={{
        width: 240,
        height: 3,
        borderRadius: 2,
        background: T.border,
        overflow: 'hidden',
        marginBottom: 48,
      }}>
        <div style={{
          height: '100%',
          width: `${progress}%`,
          background: accentColor,
          borderRadius: 2,
          transition: 'width 1s linear',
        }} />
      </div>

      {/* Start/Pause button */}
      <button
        onClick={isRunning ? pauseTimer : startTimer}
        style={{
          padding: '14px 48px',
          borderRadius: 10,
          background: isRunning ? `${T.rose}20` : `${accentColor}20`,
          border: `1px solid ${isRunning ? T.rose : accentColor}50`,
          color: isRunning ? T.rose : accentColor,
          fontFamily:"'Syne',sans-serif",
          fontSize: 16, fontWeight: 700,
          cursor: 'pointer',
          letterSpacing: '0.08em',
          marginBottom: 48,
          transition: 'all 0.15s',
        }}
      >{isRunning ? '⏸ PAUSE' : '▶ START'}</button>

      {/* Brain Dump */}
      <div style={{
        position:'absolute', bottom: 40,
        width: '60%', maxWidth: 500,
      }}>
        <div style={{
          fontFamily:"'IBM Plex Mono',monospace",
          fontSize: 9, color: T.muted,
          marginBottom: 8,
          textAlign: 'center',
          letterSpacing: '0.08em',
          opacity: 0.6,
        }}>BRAIN DUMP — capture distractions here</div>
        <input
          value={dumpInput}
          onChange={e => setDumpInput(e.target.value)}
          onKeyDown={handleDumpSubmit}
          placeholder="Type a thought and press Enter..."
          autoFocus
          style={{
            width: '100%',
            boxSizing: 'border-box',
            background: `${T.card}60`,
            border: `1px solid ${T.border}`,
            borderRadius: 8,
            padding: '10px 14px',
            color: T.text,
            fontFamily:"'IBM Plex Mono',monospace",
            fontSize: 12,
            outline: 'none',
            textAlign: 'center',
          }}
        />
        {brainDumpEntries.filter(e => e.sessionId === sessionId).length > 0 && (
          <div style={{
            marginTop: 8,
            maxHeight: 100,
            overflowY: 'auto',
          }}>
            {brainDumpEntries.filter(e => e.sessionId === sessionId).map(e => (
              <div key={e.id} style={{
                fontFamily:"'IBM Plex Mono',monospace",
                fontSize: 10, color: T.muted,
                padding: '4px 0',
                textAlign: 'center',
                opacity: 0.7,
              }}>· {e.text}</div>
            ))}
          </div>
        )}
      </div>

      {/* Exit confirmation modal */}
      {showExitConfirm && (
        <div style={{
          position:'fixed', inset:0, zIndex:510,
          background: 'rgba(0,0,0,0.7)',
          display:'flex', alignItems:'center', justifyContent:'center',
        }} onClick={() => setShowExitConfirm(false)}>
          <div style={{
            background: T.card,
            border: `1px solid ${T.border}`,
            borderRadius: 12,
            padding: '24px 28px',
            maxWidth: 320,
          }} onClick={e => e.stopPropagation()}>
            <div style={{
              fontFamily:"'Syne',sans-serif",
              fontSize: 16, fontWeight: 700,
              color: T.text, marginBottom: 12,
            }}>End session early?</div>
            <div style={{
              fontFamily:"'IBM Plex Mono',monospace",
              fontSize: 11, color: T.muted,
              marginBottom: 20, lineHeight: 1.6,
            }}>Your progress so far will be saved, but this session won't count as complete.</div>
            <div style={{ display:'flex', gap: 10 }}>
              <button
                onClick={() => setShowExitConfirm(false)}
                style={{
                  flex: 1, padding: '10px',
                  borderRadius: 6,
                  background: 'transparent',
                  border: `1px solid ${T.border}`,
                  color: T.muted,
                  fontFamily:"'Syne',sans-serif",
                  fontSize: 12, cursor: 'pointer',
                }}
              >Cancel</button>
              <button
                onClick={confirmExit}
                style={{
                  flex: 1, padding: '10px',
                  borderRadius: 6,
                  background: `${T.rose}20`,
                  border: `1px solid ${T.rose}50`,
                  color: T.rose,
                  fontFamily:"'Syne',sans-serif",
                  fontSize: 12, fontWeight: 700, cursor: 'pointer',
                }}
              >End Session</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
