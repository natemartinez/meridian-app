import React, { useState, useRef, useEffect } from 'react';
import { T } from '../utils/theme.js';

const CATEGORIES = [
  { id: 'work',    name: 'WORK STYLE',        color: T.blue   },
  { id: 'goals',   name: 'GOALS & MOTIVATION', color: T.accent },
  { id: 'prefs',   name: 'PREFERENCES',        color: T.purple },
  { id: 'context', name: 'PERSONAL CONTEXT',   color: T.green  },
];

function confColor(c) {
  if (c >= 0.85) return T.green;
  if (c >= 0.6)  return T.accent;
  return T.rose;
}

function relativeTime(isoStr) {
  if (!isoStr) return 'never';
  const diff = Date.now() - new Date(isoStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function KnowledgePoolPage({ knowledgePool, onAdd, onDelete, onEdit, onUpdateCorrections, setMainPage }) {
  const { entries = [], corrections = '', lastUpdated } = knowledgePool || {};

  const [tab, setTab]             = useState('pool');
  const [collapsed, setCollapsed] = useState({});
  const [editing, setEditing]     = useState(null);
  const [editText, setEditText]   = useState('');
  const [addInputs, setAddInputs] = useState({});
  const [corrDraft, setCorrDraft] = useState(corrections);
  const [corrSaved, setCorrSaved] = useState(false);
  const [toast, setToast]         = useState('');
  const editRef = useRef(null);

  useEffect(() => {
    if (editing !== null && editRef.current) {
      editRef.current.focus();
      const len = editRef.current.value.length;
      editRef.current.setSelectionRange(len, len);
    }
  }, [editing]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 2000);
    return () => clearTimeout(t);
  }, [toast]);

  const showToast = (msg) => setToast(msg);

  const aiCount     = entries.filter(e => e.source === 'ai').length;
  const manualCount = entries.filter(e => e.source === 'manual').length;

  const toggleCat = (id) => setCollapsed(prev => ({ ...prev, [id]: !prev[id] }));

  const startEdit = (entry) => {
    setEditing(entry.id);
    setEditText(entry.text);
  };

  const cancelEdit = () => setEditing(null);

  const saveEdit = (id) => {
    if (!editText.trim()) return;
    onEdit(id, editText);
    setEditing(null);
    showToast('Entry updated — marked as manual override');
  };

  const handleDelete = (id) => {
    if (editing === id) setEditing(null);
    onDelete(id);
    showToast('Entry removed');
  };

  const handleAdd = (catId) => {
    const val = (addInputs[catId] || '').trim();
    if (!val) return;
    onAdd(catId, val);
    setAddInputs(prev => ({ ...prev, [catId]: '' }));
    showToast('Manual entry added to pool');
  };

  const handleSaveCorrections = () => {
    onUpdateCorrections(corrDraft);
    setCorrSaved(true);
    showToast('Context saved — Nova will use this on next check-in');
    setTimeout(() => setCorrSaved(false), 2000);
  };

  const mono   = "'IBM Plex Mono', monospace";
  const syne   = "'Syne', sans-serif";
  const card   = { background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: '16px 18px', marginBottom: 16 };
  const accentLo = 'rgba(240,180,41,0.12)';
  const accentBorder = 'rgba(240,180,41,0.3)';

  return (
    <div style={{ width: '100%', height: '100%', overflowY: 'auto', background: T.bg, padding: '28px 32px', boxSizing: 'border-box', fontFamily: mono, color: T.text, position: 'relative' }}>
      <div style={{ maxWidth: 600, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: 24, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontFamily: syne, fontSize: 22, fontWeight: 700, color: T.accent, letterSpacing: 2, marginBottom: 4 }}>NOVA KNOWLEDGE POOL</div>
            <div style={{ fontSize: 11, color: T.muted, letterSpacing: 0.5 }}>what nova understands about you</div>
          </div>
          <button onClick={() => setMainPage('settings')}
            style={{ background: 'none', border: `1px solid ${T.border}`, borderRadius: 6, color: T.muted, fontFamily: mono, fontSize: 10, padding: '5px 12px', cursor: 'pointer' }}>
            ← Settings
          </button>
        </div>

        {/* Summary bar */}
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: '14px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: accentLo, border: `1px solid ${accentBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: syne, fontSize: 13, fontWeight: 700, color: T.accent, flexShrink: 0 }}>N</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: syne, fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 2 }}>Nova</div>
            <div style={{ fontSize: 10, color: T.muted }}>AI Companion · Last updated {relativeTime(lastUpdated)}</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[{ label: 'entries', val: entries.length }, { label: 'inferred', val: aiCount }, { label: 'manual', val: manualCount }].map(s => (
              <div key={s.label} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 6, padding: '4px 10px', fontSize: 10, color: T.muted, textAlign: 'center' }}>
                <div style={{ fontSize: 16, fontWeight: 600, color: T.text, marginBottom: 1 }}>{s.val}</div>
                {s.label}
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: `1px solid ${T.border}` }}>
          {[{ id: 'pool', label: 'KNOWLEDGE POOL' }, { id: 'corrections', label: 'CORRECTIONS' }].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ fontFamily: mono, fontSize: 10, letterSpacing: 1, padding: '8px 14px', cursor: 'pointer', color: tab === t.id ? T.accent : T.muted, borderBottom: `2px solid ${tab === t.id ? T.accent : 'transparent'}`, marginBottom: -1, background: 'none', border: 'none', borderBottomStyle: 'solid', borderBottomWidth: 2, borderBottomColor: tab === t.id ? T.accent : 'transparent', transition: 'color 0.15s' }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* TAB 1: KNOWLEDGE POOL */}
        {tab === 'pool' && (
          <>
            {/* Legend */}
            <div style={{ display: 'flex', gap: 14, marginBottom: 14, padding: '8px 12px', background: T.card, borderRadius: 6, border: `1px solid ${T.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 9, color: T.muted }}>
                <div style={{ width: 12, height: 12, borderRadius: 3, background: 'rgba(83,170,255,0.15)', border: '1px solid rgba(83,170,255,0.3)' }} />
                AI inferred from conversation
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 9, color: T.muted }}>
                <div style={{ width: 12, height: 12, borderRadius: 3, background: accentLo, border: `1px solid ${accentBorder}` }} />
                Manually added (overrides AI)
              </div>
            </div>

            {CATEGORIES.map(cat => {
              const catEntries = entries.filter(e => e.cat === cat.id);
              const isOpen = !collapsed[cat.id];
              return (
                <div key={cat.id} style={{ marginBottom: 18 }}>
                  {/* Category header */}
                  <div onClick={() => toggleCat(cat.id)} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, cursor: 'pointer' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: cat.color, flexShrink: 0 }} />
                    <div style={{ fontSize: 10, letterSpacing: 1.5, fontWeight: 500, flex: 1, color: cat.color }}>{cat.name}</div>
                    <div style={{ fontSize: 9, color: T.muted }}>{catEntries.length}</div>
                    <div style={{ fontSize: 9, color: T.dim, transition: 'transform 0.2s', transform: isOpen ? 'rotate(180deg)' : 'none' }}>▼</div>
                  </div>

                  {isOpen && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, paddingLeft: 16 }}>
                      {catEntries.length === 0 && (
                        <div style={{ fontSize: 10, color: T.dim, padding: '6px 12px', fontStyle: 'italic' }}>No entries yet — add one below</div>
                      )}
                      {catEntries.map(entry => {
                        const isEd = editing === entry.id;
                        return (
                          <div key={entry.id} style={{
                            background: isEd ? 'rgba(240,180,41,0.04)' : T.surface,
                            border: `1px solid ${isEd ? accentBorder : T.border}`,
                            borderLeft: entry.source === 'manual' ? `2px solid ${T.accent}` : `1px solid ${isEd ? accentBorder : T.border}`,
                            borderRadius: 8,
                            padding: '9px 12px',
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 10,
                          }}>
                            {/* Source badge */}
                            <div style={{
                              width: 14, height: 14, borderRadius: 3, flexShrink: 0, marginTop: 1,
                              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8,
                              background: entry.source === 'ai' ? 'rgba(83,170,255,0.15)' : accentLo,
                              border: `1px solid ${entry.source === 'ai' ? 'rgba(83,170,255,0.3)' : accentBorder}`,
                              color: entry.source === 'ai' ? T.blue : T.accent,
                            }}>
                              {entry.source === 'ai' ? 'AI' : '✎'}
                            </div>

                            {/* Body */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              {isEd ? (
                                <textarea
                                  ref={editRef}
                                  rows={2}
                                  value={editText}
                                  onChange={e => setEditText(e.target.value)}
                                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit(entry.id); } if (e.key === 'Escape') cancelEdit(); }}
                                  style={{ width: '100%', background: T.card, border: `1px solid ${accentBorder}`, borderRadius: 5, padding: '5px 8px', color: T.text, fontFamily: mono, fontSize: 11, outline: 'none', marginBottom: 4, resize: 'none', boxSizing: 'border-box' }}
                                />
                              ) : (
                                <div style={{ fontSize: 11, color: T.text, lineHeight: 1.5, marginBottom: 3 }}>{entry.text}</div>
                              )}
                              <div style={{ fontSize: 9, color: T.muted, display: 'flex', alignItems: 'center', gap: 6 }}>
                                {entry.source === 'ai' ? (
                                  <>
                                    <div style={{ width: 40, height: 3, background: T.border, borderRadius: 2, overflow: 'hidden' }}>
                                      <div style={{ height: '100%', width: `${entry.conf * 100}%`, background: confColor(entry.conf), borderRadius: 2 }} />
                                    </div>
                                    <span style={{ color: confColor(entry.conf) }}>{Math.round(entry.conf * 100)}% confidence</span>
                                  </>
                                ) : (
                                  <span style={{ color: T.accent }}>manual override</span>
                                )}
                              </div>
                            </div>

                            {/* Actions */}
                            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                              {isEd ? (
                                <>
                                  <button onClick={() => saveEdit(entry.id)} style={{ background: 'none', border: `1px solid ${accentBorder}`, borderRadius: 4, color: T.accent, fontFamily: mono, fontSize: 9, padding: '2px 7px', cursor: 'pointer' }}>save</button>
                                  <button onClick={cancelEdit} style={{ background: 'none', border: `1px solid ${T.border}`, borderRadius: 4, color: T.muted, fontFamily: mono, fontSize: 9, padding: '2px 7px', cursor: 'pointer' }}>cancel</button>
                                </>
                              ) : (
                                <>
                                  <button onClick={() => startEdit(entry)} style={{ background: 'none', border: `1px solid ${T.border}`, borderRadius: 4, color: T.muted, fontFamily: mono, fontSize: 9, padding: '2px 7px', cursor: 'pointer' }}>edit</button>
                                  <button onClick={() => handleDelete(entry.id)} style={{ background: 'none', border: `1px solid ${T.border}`, borderRadius: 4, color: T.muted, fontFamily: mono, fontSize: 9, padding: '2px 7px', cursor: 'pointer' }}>✕</button>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {/* Add row */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 0' }}>
                        <input
                          value={addInputs[cat.id] || ''}
                          onChange={e => setAddInputs(prev => ({ ...prev, [cat.id]: e.target.value }))}
                          onKeyDown={e => e.key === 'Enter' && handleAdd(cat.id)}
                          placeholder="Add a correction or context..."
                          style={{ flex: 1, background: T.card, border: `1px solid ${T.border}`, borderRadius: 6, padding: '6px 10px', color: T.text, fontFamily: mono, fontSize: 11, outline: 'none' }}
                        />
                        <button onClick={() => handleAdd(cat.id)} style={{ background: 'none', border: `1px solid ${accentBorder}`, borderRadius: 6, color: T.accent, fontFamily: mono, fontSize: 10, padding: '5px 12px', cursor: 'pointer', whiteSpace: 'nowrap' }}>+ Add</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}

        {/* TAB 2: CORRECTIONS */}
        {tab === 'corrections' && (
          <>
            {/* Freeform context */}
            <div style={card}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ fontSize: 10, letterSpacing: 1.5, color: T.accent }}>FREEFORM CONTEXT</div>
              </div>
              <div style={{ fontSize: 10, color: T.muted, lineHeight: 1.6, marginBottom: 14, paddingBottom: 12, borderBottom: `1px solid ${T.border}` }}>
                Write anything Nova should know or correct. This is injected directly into Nova's context window before every AI call — like a system message from you.
              </div>
              <textarea
                value={corrDraft}
                onChange={e => setCorrDraft(e.target.value)}
                placeholder="e.g. Nova tends to assume I prefer structured routines — I actually prefer flexibility..."
                rows={5}
                style={{ width: '100%', background: T.card, border: `1px solid ${T.border}`, borderRadius: 6, padding: '10px 12px', color: T.text, fontFamily: mono, fontSize: 11, outline: 'none', resize: 'vertical', lineHeight: 1.6, boxSizing: 'border-box' }}
              />
              <div style={{ fontSize: 9, color: corrDraft.length > 800 ? T.rose : T.dim, textAlign: 'right', marginTop: 4, marginBottom: 8 }}>
                {corrDraft.length}/800
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => setCorrDraft('')}
                  style={{ background: 'none', border: `1px solid ${T.border}`, borderRadius: 6, color: T.muted, fontFamily: mono, fontSize: 10, padding: '6px 14px', cursor: 'pointer' }}>
                  Clear
                </button>
                <button onClick={handleSaveCorrections}
                  style={{ background: corrSaved ? T.green : T.accent, border: 'none', borderRadius: 6, color: '#07090f', fontFamily: mono, fontSize: 10, fontWeight: 700, padding: '6px 16px', cursor: 'pointer', letterSpacing: 0.5, transition: 'background 0.2s' }}>
                  {corrSaved ? '✓ Saved' : 'Save Context'}
                </button>
              </div>
            </div>

            {/* Active manual entries */}
            <div style={card}>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 10, letterSpacing: 1.5, color: T.accent, marginBottom: 8 }}>ACTIVE MANUAL ENTRIES</div>
                <div style={{ fontSize: 10, color: T.muted }}>These entries from the Knowledge Pool take priority over AI inferences.</div>
              </div>
              {entries.filter(e => e.source === 'manual').length === 0 ? (
                <div style={{ fontSize: 11, color: T.dim, fontStyle: 'italic', padding: '8px 0' }}>No manual entries yet. Add them in the Knowledge Pool tab.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {entries.filter(e => e.source === 'manual').map(e => {
                    const cat = CATEGORIES.find(c => c.id === e.cat);
                    return (
                      <div key={e.id} style={{ background: T.surface, border: `1px solid ${T.border}`, borderLeft: `2px solid ${T.accent}`, borderRadius: 8, padding: '9px 12px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                        <div style={{ width: 14, height: 14, borderRadius: 3, flexShrink: 0, marginTop: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, background: accentLo, border: `1px solid ${accentBorder}`, color: T.accent }}>✎</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 11, color: T.text, lineHeight: 1.5, marginBottom: 3 }}>{e.text}</div>
                          <div style={{ fontSize: 9, color: cat?.color || T.muted }}>{cat?.name}</div>
                        </div>
                        <button onClick={() => handleDelete(e.id)}
                          style={{ background: 'none', border: `1px solid ${T.border}`, borderRadius: 4, color: T.muted, fontFamily: mono, fontSize: 9, padding: '2px 7px', cursor: 'pointer', flexShrink: 0 }}>✕</button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 16, right: 16, background: T.surface, border: `1px solid ${accentBorder}`, borderRadius: 8, padding: '10px 16px', fontFamily: mono, fontSize: 11, color: T.accent, zIndex: 999, pointerEvents: 'none' }}>
          {toast}
        </div>
      )}
    </div>
  );
}
