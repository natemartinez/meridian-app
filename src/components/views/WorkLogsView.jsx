import { useState, useEffect, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

const T = {
  bg:     '#07090f',
  card:   '#0d1017',
  border: '#1b2336',
  text:   '#d6e2f5',
  muted:  '#56687f',
  accent: '#f0b429',
  rose:   '#f77171',
};

function Toolbar({ editor }) {
  if (!editor) return null;
  const btn = (active) => ({
    background: active ? `${T.accent}18` : 'transparent',
    border: `1px solid ${active ? T.accent : T.border}`,
    borderRadius: 4, color: active ? T.accent : T.text,
    padding: '3px 8px', fontFamily: 'IBM Plex Mono',
    fontSize: 11, cursor: 'pointer', minWidth: 28,
  });
  const sep = <div style={{ width: 1, height: 16, background: T.border, margin: '0 4px' }} />;
  return (
    <div style={{ padding: '8px 20px', borderBottom: `1px solid ${T.border}`, display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap', flexShrink: 0 }}>
      <button onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleBold().run(); }} style={btn(editor.isActive('bold'))}><b>B</b></button>
      <button onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleItalic().run(); }} style={btn(editor.isActive('italic'))}><i>I</i></button>
      <button onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleStrike().run(); }} style={btn(editor.isActive('strike'))}><s>S</s></button>
      {sep}
      <button onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleHeading({ level: 1 }).run(); }} style={btn(editor.isActive('heading', { level: 1 }))}>H1</button>
      <button onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleHeading({ level: 2 }).run(); }} style={btn(editor.isActive('heading', { level: 2 }))}>H2</button>
      {sep}
      <button onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleBulletList().run(); }} style={btn(editor.isActive('bulletList'))}>• List</button>
      <button onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleOrderedList().run(); }} style={btn(editor.isActive('orderedList'))}>1. List</button>
      <button onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleCode().run(); }} style={btn(editor.isActive('code'))}>{'`'}</button>
      {sep}
      <button onMouseDown={e => { e.preventDefault(); editor.chain().focus().unsetAllMarks().clearNodes().run(); }} style={btn(false)}>Tx</button>
    </div>
  );
}

function LogEditor({ log, folderId, folderName, onSave, onBack }) {
  const [title, setTitle] = useState(log.title);
  const editor = useEditor({
    extensions: [StarterKit],
    content: log.content,
    onUpdate: ({ editor }) => { onSave(folderId, log.id, editor.getHTML()); },
  });

  useEffect(() => {
    if (editor && log.content !== editor.getHTML()) editor.commands.setContent(log.content);
    setTitle(log.title);
  }, [log.id]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '12px 20px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <button onClick={() => onBack('folders')} style={{ background: 'none', border: 'none', color: T.muted, cursor: 'pointer', fontFamily: 'IBM Plex Mono', fontSize: 10, padding: 0 }}>
          WORK LOGS
        </button>
        <span style={{ color: T.border }}>›</span>
        <button onClick={() => onBack('logList')} style={{ background: 'none', border: 'none', color: T.muted, cursor: 'pointer', fontFamily: 'IBM Plex Mono', fontSize: 10, padding: 0 }}>
          {folderName}
        </button>
        <span style={{ color: T.border }}>›</span>
        <input
          value={title}
          onChange={e => { setTitle(e.target.value); onSave(folderId, log.id, editor?.getHTML() || '', e.target.value); }}
          style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontFamily: 'Syne', fontSize: 13, color: T.text }}
        />
        <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: T.muted, whiteSpace: 'nowrap' }}>
          {new Date(log.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
      <Toolbar editor={editor} />
      <EditorContent editor={editor} style={{ flex: 1, overflowY: 'auto', padding: '24px 40px' }} />
    </div>
  );
}

export default function WorkLogsView() {
  const [folders, setFolders] = useState(() => {
    try { return JSON.parse(localStorage.getItem('meridian_wl_folders') || 'null') || []; }
    catch { return []; }
  });
  const [logs, setLogs] = useState(() => {
    try { return JSON.parse(localStorage.getItem('meridian_wl_logs') || '{}'); }
    catch { return {}; }
  });

  const [screen,         setScreen]         = useState('folders');
  const [activeFolderId, setActiveFolderId] = useState(null);
  const [activeLogId,    setActiveLogId]    = useState(null);
  const [renamingId,     setRenamingId]     = useState(null);
  const [renameValue,    setRenameValue]    = useState('');
  const [newFolderName,  setNewFolderName]  = useState('');
  const [showNewFolder,  setShowNewFolder]  = useState(false);
  const [hoveredFolder,  setHoveredFolder]  = useState(null);
  const [movingLogId,    setMovingLogId]    = useState(null);

  useEffect(() => { localStorage.setItem('meridian_wl_folders', JSON.stringify(folders)); }, [folders]);
  useEffect(() => { localStorage.setItem('meridian_wl_logs',    JSON.stringify(logs));    }, [logs]);

  const activeFolder = folders.find(f => f.id === activeFolderId);
  const folderLogs   = logs[activeFolderId] || [];
  const activeLog    = folderLogs.find(l => l.id === activeLogId);

  function addFolder() {
    if (!newFolderName.trim()) return;
    setFolders(prev => [...prev, { id: Date.now(), name: newFolderName.trim() }]);
    setNewFolderName('');
    setShowNewFolder(false);
  }

  function deleteFolder(id) {
    setFolders(prev => prev.filter(f => f.id !== id));
    setLogs(prev => { const next = { ...prev }; delete next[id]; return next; });
  }

  function moveFolderUp(id) {
    setFolders(prev => {
      const idx = prev.findIndex(f => f.id === id);
      if (idx <= 0) return prev;
      const arr = [...prev];
      [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
      return arr;
    });
  }

  function moveFolderDown(id) {
    setFolders(prev => {
      const idx = prev.findIndex(f => f.id === id);
      if (idx >= prev.length - 1) return prev;
      const arr = [...prev];
      [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
      return arr;
    });
  }

  function createLog(folderId) {
    const log = { id: Date.now(), title: 'Untitled Log', content: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    setLogs(prev => ({ ...prev, [folderId]: [log, ...(prev[folderId] || [])] }));
    setActiveLogId(log.id);
    setScreen('editor');
  }

  const saveLog = useCallback((folderId, logId, content, title) => {
    setLogs(prev => ({
      ...prev,
      [folderId]: (prev[folderId] || []).map(l =>
        l.id === logId ? { ...l, content, ...(title !== undefined ? { title } : {}), updatedAt: new Date().toISOString() } : l
      ),
    }));
  }, []);

  function deleteLog(folderId, logId) {
    setLogs(prev => ({ ...prev, [folderId]: (prev[folderId] || []).filter(l => l.id !== logId) }));
    setScreen('logList');
  }

  function moveLog(logId, toFolderId) {
    const log = (logs[activeFolderId] || []).find(l => l.id === logId);
    if (!log || toFolderId === activeFolderId) return;
    setLogs(prev => ({
      ...prev,
      [activeFolderId]: (prev[activeFolderId] || []).filter(l => l.id !== logId),
      [toFolderId]: [log, ...(prev[toFolderId] || [])],
    }));
    setMovingLogId(null);
  }

  const cardBase = { background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, padding: '14px 16px', cursor: 'pointer', position: 'relative' };
  const iconBtn  = { background: 'none', border: 'none', cursor: 'pointer', padding: '2px 5px', fontFamily: 'IBM Plex Mono', fontSize: 11, lineHeight: 1 };

  // ── Folders screen ──────────────────────────────────────────────────────────
  if (screen === 'folders') return (
    <div style={{ padding: 20, height: '100%', overflowY: 'auto', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <div style={{ fontFamily: 'Syne', color: T.accent, fontSize: 16, fontWeight: 700, letterSpacing: '.06em' }}>WORK LOGS</div>
        <button onClick={() => setShowNewFolder(s => !s)}
                style={{ ...iconBtn, color: T.muted, border: `1px solid ${T.border}`, borderRadius: 6, padding: '5px 12px' }}>
          + Folder
        </button>
      </div>

      {showNewFolder && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <input
            value={newFolderName}
            onChange={e => setNewFolderName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addFolder(); if (e.key === 'Escape') { setShowNewFolder(false); setNewFolderName(''); } }}
            placeholder="Folder name..."
            autoFocus
            style={{ flex: 1, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 6, padding: '7px 11px', color: T.text, fontFamily: 'IBM Plex Mono', fontSize: 12, outline: 'none' }}
          />
          <button onClick={addFolder}
                  style={{ background: T.accent, border: 'none', borderRadius: 6, color: '#07090f', padding: '7px 14px', fontFamily: 'IBM Plex Mono', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
            Create
          </button>
        </div>
      )}

      {folders.length === 0 && !showNewFolder && (
        <div style={{ textAlign: 'center', marginTop: 60, color: T.muted, fontFamily: 'IBM Plex Mono', fontSize: 11, lineHeight: 1.8 }}>
          No folders yet.<br />Click + Folder to create one.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {folders.map((folder, idx) => {
          const count   = (logs[folder.id] || []).length;
          const hovered = hoveredFolder === folder.id;

          return renamingId === folder.id ? (
            <input key={folder.id} autoFocus value={renameValue}
                   onChange={e => setRenameValue(e.target.value)}
                   onBlur={() => { setFolders(prev => prev.map(f => f.id === folder.id ? { ...f, name: renameValue } : f)); setRenamingId(null); }}
                   onKeyDown={e => {
                     if (e.key === 'Enter') { setFolders(prev => prev.map(f => f.id === folder.id ? { ...f, name: renameValue } : f)); setRenamingId(null); }
                     if (e.key === 'Escape') setRenamingId(null);
                   }}
                   style={{ background: T.bg, border: `1px solid ${T.accent}`, borderRadius: 8, padding: '14px 16px', color: T.text, fontFamily: 'Syne', fontSize: 13, outline: 'none' }} />
          ) : (
            <div key={folder.id}
                 style={{ ...cardBase, border: `1px solid ${hovered ? '#2a3a52' : T.border}`, display: 'flex', alignItems: 'center', gap: 10 }}
                 onMouseEnter={() => setHoveredFolder(folder.id)}
                 onMouseLeave={() => setHoveredFolder(null)}
                 onClick={() => { setActiveFolderId(folder.id); setScreen('logList'); }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'Syne', fontSize: 13, color: T.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{folder.name}</div>
                <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, color: T.muted, marginTop: 3 }}>{count} {count === 1 ? 'log' : 'logs'}</div>
              </div>
              {hovered && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 2 }} onClick={e => e.stopPropagation()}>
                  <button title="Rename" onClick={() => { setRenamingId(folder.id); setRenameValue(folder.name); }}
                          style={{ ...iconBtn, color: T.muted }}>✎</button>
                  <button title="Move up" onClick={() => moveFolderUp(folder.id)}
                          style={{ ...iconBtn, color: idx === 0 ? '#1b2336' : T.muted }}>↑</button>
                  <button title="Move down" onClick={() => moveFolderDown(folder.id)}
                          style={{ ...iconBtn, color: idx === folders.length - 1 ? '#1b2336' : T.muted }}>↓</button>
                  <button title="Delete folder" onClick={() => deleteFolder(folder.id)}
                          style={{ ...iconBtn, color: T.rose }}>×</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  // ── Log list screen ─────────────────────────────────────────────────────────
  if (screen === 'logList') return (
    <div style={{ padding: 20, height: '100%', overflowY: 'auto', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button onClick={() => setScreen('folders')} style={{ ...iconBtn, color: T.muted, padding: 0 }}>WORK LOGS</button>
          <span style={{ color: T.border, fontFamily: 'IBM Plex Mono', fontSize: 11 }}>›</span>
          <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color: T.accent }}>{activeFolder?.name}</span>
        </div>
        <button onClick={() => createLog(activeFolderId)}
                style={{ ...iconBtn, color: T.accent, border: `1px solid ${T.accent}40`, borderRadius: 6, padding: '5px 12px' }}>
          + New Log
        </button>
      </div>

      {folderLogs.length === 0 && (
        <div style={{ textAlign: 'center', marginTop: 60, color: T.muted, fontFamily: 'IBM Plex Mono', fontSize: 11 }}>
          No logs here yet.
        </div>
      )}

      {folderLogs.map(log => (
        <div key={log.id}
             style={{ ...cardBase, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10 }}
             onClick={() => { setActiveLogId(log.id); setScreen('editor'); }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'Syne', fontSize: 13, color: T.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{log.title}</div>
            <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, color: T.muted, marginTop: 3 }}>
              {new Date(log.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }} onClick={e => e.stopPropagation()}>
            {movingLogId === log.id ? (
              <select
                autoFocus
                defaultValue=""
                onBlur={() => setMovingLogId(null)}
                onChange={e => moveLog(log.id, parseInt(e.target.value))}
                style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 4, color: T.text, fontFamily: 'IBM Plex Mono', fontSize: 11, padding: '3px 6px', cursor: 'pointer' }}
              >
                <option value="" disabled>Move to…</option>
                {folders.filter(f => f.id !== activeFolderId).map(f => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            ) : (
              <button title="Move to folder" onClick={() => setMovingLogId(log.id)}
                      style={{ ...iconBtn, color: T.muted, fontSize: 13 }}>⇄</button>
            )}
            <button title="Delete log" onClick={() => deleteLog(activeFolderId, log.id)}
                    style={{ ...iconBtn, color: T.rose, fontSize: 13 }}>×</button>
          </div>
        </div>
      ))}
    </div>
  );

  // ── Editor screen ────────────────────────────────────────────────────────────
  if (screen === 'editor' && activeLog) return (
    <LogEditor
      log={activeLog}
      folderId={activeFolderId}
      folderName={activeFolder?.name}
      onSave={saveLog}
      onBack={(dest) => setScreen(dest)}
    />
  );

  return null;
}
