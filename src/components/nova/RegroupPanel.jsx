import React, { useState, useMemo } from 'react';
import { T } from '../../utils/theme.js';
import { uid, buildDailySummary } from '../../utils/helpers.js';
import RetryFeedback from './RetryFeedback.jsx';

export default function RegroupPanel({
  sessions = [],
  brainDumpEntries = [],
  onwardItems = [],
  projects = [],
  journalEntries = [],
  onJournalEntry,
  onBreakdownSuggestion,
  novaRetry,
}) {
  const [wentWell, setWentWell] = useState('');
  const [friction, setFriction] = useState('');
  const [adjustment, setAdjustment] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [saved, setSaved] = useState(false);

  const summary = useMemo(() =>
    buildDailySummary(sessions, brainDumpEntries, onwardItems, projects),
    [sessions, brainDumpEntries, onwardItems, projects]
  );

  // Find tasks that consistently overrun estimates
  const overrunTasks = useMemo(() => {
    const taskDurations = {};
    for (const s of sessions) {
      if (!s.label) continue;
      if (!taskDurations[s.label]) taskDurations[s.label] = [];
      taskDurations[s.label].push(s.duration || 25);
    }
    const result = [];
    for (const [label, durations] of Object.entries(taskDurations)) {
      if (durations.length >= 2) {
        const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
        // Find the onward item estimate
        const onwardItem = onwardItems.find(it => it.title === label);
        const estimated = onwardItem?.duration || 25;
        if (avg > estimated * 1.2) {
          result.push({ label, sessions: durations.length, avgDuration: Math.round(avg), estimated });
        }
      }
    }
    return result;
  }, [sessions, onwardItems]);

  const totalMinutes = summary.totalMinutes || 1;
  const corePct = Math.round((summary.coreMinutes / totalMinutes) * 100);
  const maintPct = Math.round((summary.maintenanceMinutes / totalMinutes) * 100);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div style={{
      flex: 1, overflowY: 'auto',
      padding: '16px 18px',
      display: 'flex', flexDirection: 'column',
      gap: 20,
    }}>
      {/* ── Daily Summary Graph ── */}
      <div>
        <div style={{
          fontFamily:"'IBM Plex Mono',monospace",
          fontSize: 9, color: T.muted,
          letterSpacing: '0.1em', marginBottom: 12,
        }}>TODAY'S BREAKDOWN</div>
        <div style={{
          display: 'flex', gap: 10, height: 80,
          alignItems: 'flex-end',
          marginBottom: 10,
        }}>
          {/* Core Building */}
          <div style={{ flex: 1, display:'flex', flexDirection:'column', alignItems:'center', gap: 4 }}>
            <div style={{
              width: '100%',
              height: `${Math.max(corePct, 4)}%`,
              background: T.green,
              borderRadius: '4px 4px 0 0',
              transition: 'height 0.5s',
              minHeight: 8,
            }} />
            <div style={{
              fontFamily:"'IBM Plex Mono',monospace",
              fontSize: 8, color: T.green,
              textAlign: 'center',
            }}>{summary.coreMinutes}m</div>
            <div style={{
              fontFamily:"'IBM Plex Mono',monospace",
              fontSize: 7, color: T.muted,
              textAlign: 'center',
            }}>Core</div>
          </div>
          {/* Maintenance */}
          <div style={{ flex: 1, display:'flex', flexDirection:'column', alignItems:'center', gap: 4 }}>
            <div style={{
              width: '100%',
              height: `${Math.max(maintPct, 4)}%`,
              background: T.accent,
              borderRadius: '4px 4px 0 0',
              transition: 'height 0.5s',
              minHeight: 8,
            }} />
            <div style={{
              fontFamily:"'IBM Plex Mono',monospace",
              fontSize: 8, color: T.accent,
              textAlign: 'center',
            }}>{summary.maintenanceMinutes}m</div>
            <div style={{
              fontFamily:"'IBM Plex Mono',monospace",
              fontSize: 7, color: T.muted,
              textAlign: 'center',
            }}>Maint.</div>
          </div>
          {/* Distractions Intercepted */}
          <div style={{ flex: 1, display:'flex', flexDirection:'column', alignItems:'center', gap: 4 }}>
            <div style={{
              width: '100%',
              height: `${Math.min(summary.distractionsCount * 10, 100)}%`,
              background: T.rose,
              borderRadius: '4px 4px 0 0',
              transition: 'height 0.5s',
              minHeight: 8,
            }} />
            <div style={{
              fontFamily:"'IBM Plex Mono',monospace",
              fontSize: 8, color: T.rose,
              textAlign: 'center',
            }}>{summary.distractionsCount}</div>
            <div style={{
              fontFamily:"'IBM Plex Mono',monospace",
              fontSize: 7, color: T.muted,
              textAlign: 'center',
            }}>Distr.</div>
          </div>
        </div>
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          fontFamily:"'IBM Plex Mono',monospace",
          fontSize: 8, color: T.muted,
          padding: '6px 4px 0',
          borderTop: `1px solid ${T.border}`,
        }}>
          <span>{summary.sessionCount} sessions</span>
          <span>{summary.totalMinutes} min total</span>
        </div>
      </div>

      {/* ── Friction Audit ── */}
      <div>
        <div style={{
          fontFamily:"'IBM Plex Mono',monospace",
          fontSize: 9, color: T.muted,
          letterSpacing: '0.1em', marginBottom: 12,
        }}>FRICTION AUDIT</div>

        <div style={{ marginBottom: 14 }}>
          <div style={{
            fontFamily:"'IBM Plex Mono',monospace",
            fontSize: 10, color: T.green,
            marginBottom: 6,
          }}>✦ What went well?</div>
          <textarea
            value={wentWell}
            onChange={e => setWentWell(e.target.value)}
            placeholder="What went well today?"
            rows={2}
            style={{
              width: '100%', boxSizing: 'border-box',
              background: T.card, border: `1px solid ${T.border}`,
              borderRadius: 6, padding: '8px 10px',
              color: T.text, fontFamily:"'IBM Plex Mono',monospace",
              fontSize: 10, outline: 'none', resize: 'vertical',
            }}
          />
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={{
            fontFamily:"'IBM Plex Mono',monospace",
            fontSize: 10, color: T.rose,
            marginBottom: 6,
          }}>⚠ What was friction?</div>
          <textarea
            value={friction}
            onChange={e => setFriction(e.target.value)}
            placeholder="What caused friction today?"
            rows={2}
            style={{
              width: '100%', boxSizing: 'border-box',
              background: T.card, border: `1px solid ${T.border}`,
              borderRadius: 6, padding: '8px 10px',
              color: T.text, fontFamily:"'IBM Plex Mono',monospace",
              fontSize: 10, outline: 'none', resize: 'vertical',
            }}
          />
          {/* Auto-suggest friction from brain dump */}
          {brainDumpEntries.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{
                fontFamily:"'IBM Plex Mono',monospace",
                fontSize: 8, color: T.muted, marginBottom: 4,
              }}>From today's brain dump:</div>
              {brainDumpEntries.map(e => (
                <div
                  key={e.id}
                  onClick={() => setFriction(prev => prev + (prev ? '\n' : '') + e.text)}
                  style={{
                    fontFamily:"'IBM Plex Mono',monospace",
                    fontSize: 9, color: T.muted,
                    padding: '3px 6px', cursor: 'pointer',
                    borderRadius: 3,
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = `${T.border}40`}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >· {e.text}</div>
              ))}
            </div>
          )}
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={{
            fontFamily:"'IBM Plex Mono',monospace",
            fontSize: 10, color: T.blue,
            marginBottom: 6,
          }}>→ What to adjust tomorrow?</div>
          <textarea
            value={adjustment}
            onChange={e => setAdjustment(e.target.value)}
            placeholder="What will you do differently tomorrow?"
            rows={2}
            style={{
              width: '100%', boxSizing: 'border-box',
              background: T.card, border: `1px solid ${T.border}`,
              borderRadius: 6, padding: '8px 10px',
              color: T.text, fontFamily:"'IBM Plex Mono',monospace",
              fontSize: 10, outline: 'none', resize: 'vertical',
            }}
          />
        </div>

        <button
          onClick={handleSave}
          style={{
            width: '100%',
            padding: '8px',
            borderRadius: 6,
            background: saved ? `${T.green}20` : `${T.accent}18`,
            border: `1px solid ${saved ? T.green : T.accent}40`,
            color: saved ? T.green : T.accent,
            fontFamily:"'Syne',sans-serif",
            fontSize: 11, fontWeight: 700,
            cursor: 'pointer',
            letterSpacing: '0.05em',
          }}
        >{saved ? '✓ Saved' : 'Save Reflection'}</button>
      </div>

      {/* ── Overrun Tasks & Suggestions ── */}
      {overrunTasks.length > 0 && (
        <div>
          <div style={{
            fontFamily:"'IBM Plex Mono',monospace",
            fontSize: 9, color: T.muted,
            letterSpacing: '0.1em', marginBottom: 10,
          }}>TASKS OVERRUNNING ESTIMATES</div>
          {overrunTasks.map(t => (
            <div key={t.label} style={{
              padding: '10px 12px',
              marginBottom: 8,
              background: T.card,
              border: `1px solid ${T.border}`,
              borderLeft: `3px solid ${T.rose}`,
              borderRadius: 6,
            }}>
              <div style={{
                fontFamily:"'IBM Plex Mono',monospace",
                fontSize: 10, color: T.text,
                marginBottom: 4,
              }}>{t.label}</div>
              <div style={{
                fontFamily:"'IBM Plex Mono',monospace",
                fontSize: 8, color: T.muted,
                marginBottom: 6,
              }}>
                Estimated {t.estimated}m · Actual avg {t.avgDuration}m · {t.sessions} sessions
              </div>
              <button
                onClick={() => onBreakdownSuggestion && onBreakdownSuggestion(t.label)}
                style={{
                  background: `${T.accent}15`,
                  border: `1px solid ${T.accent}40`,
                  borderRadius: 4,
                  padding: '4px 10px',
                  color: T.accent,
                  fontFamily:"'IBM Plex Mono',monospace",
                  fontSize: 8, cursor: 'pointer',
                }}
              >Suggest Breakdown</button>
            </div>
          ))}
        </div>
      )}

      {/* ── Recent Journal Entries ── */}
      {journalEntries.length > 0 && (
        <div>
          <div style={{
            fontFamily:"'IBM Plex Mono',monospace",
            fontSize: 9, color: T.muted,
            letterSpacing: '0.1em', marginBottom: 10,
          }}>RECENT JOURNAL</div>
          {journalEntries.slice(-3).reverse().map(e => (
            <div key={e.id} style={{
              padding: '8px 10px',
              marginBottom: 6,
              background: T.card,
              border: `1px solid ${T.border}`,
              borderRadius: 6,
            }}>
              <div style={{
                fontFamily:"'IBM Plex Mono',monospace",
                fontSize: 8, color: T.muted,
                marginBottom: 4,
              }}>{new Date(e.date).toLocaleDateString()}</div>
              <div style={{
                fontFamily:"'IBM Plex Mono',monospace",
                fontSize: 9, color: T.text,
                lineHeight: 1.5,
              }}>{e.response}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Retry Feedback ── */}
      {(novaRetry?.loading || novaRetry?.error || novaRetry?.cooldownActive) && (
        <div style={{ padding:'4px 0' }}>
          <RetryFeedback
            loading={novaRetry.loading}
            error={novaRetry.error}
            attempt={novaRetry.attempt}
            maxRetries={novaRetry.maxRetries}
            cached={novaRetry.cached}
            cooldownActive={novaRetry.cooldownActive}
            cooldownRemaining={novaRetry.cooldownRemaining}
            onRefresh={() => {
              // Re-group doesn't have a direct API call to retry;
              // the onBreakdownSuggestion callback handles API calls.
              // This provides visual feedback for any novaRetry state changes.
            }}
            size="sm"
          />
        </div>
      )}
    </div>
  );
}
