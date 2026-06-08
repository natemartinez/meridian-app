const { app, BrowserWindow, ipcMain, safeStorage, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs   = require('fs');
const Database = require('better-sqlite3');

let mainWin = null;
let tray    = null;
let db      = null;

// ---------- window ----------

function createWindow() {
  mainWin = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'Meridian',
    backgroundColor: '#07090f',
    icon: path.join(__dirname, 'src/assets/meridian_icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    titleBarStyle: 'hiddenInset',
    show: false,
  });

  if (process.env.ELECTRON_DEV === '1') {
    mainWin.loadURL('http://localhost:5173');
  } else {
    mainWin.loadFile(path.join(__dirname, 'dist/index.html'));
  }

  mainWin.once('ready-to-show', () => mainWin.show());

  // Close → hide to tray instead of quitting
  mainWin.on('close', (e) => {
    e.preventDefault();
    mainWin.hide();
  });
}

// ---------- tray ----------

function buildTrayIcon() {
  const size = 16;
  const buf  = Buffer.alloc(size * size * 4);
  const r2   = (size / 2 - 1.5) ** 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = (x - size / 2 + 0.5) ** 2 + (y - size / 2 + 0.5) ** 2;
      const i = (y * size + x) * 4;
      if (d <= r2) { buf[i] = 240; buf[i+1] = 180; buf[i+2] = 41; buf[i+3] = 255; }
    }
  }
  return nativeImage.createFromBuffer(buf, { width: size, height: size });
}

function createTray() {
  tray = new Tray(buildTrayIcon());
  tray.setToolTip('Meridian');
  tray.on('click', () => {
    if (mainWin.isVisible()) mainWin.hide();
    else { mainWin.show(); mainWin.focus(); }
  });
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Show Meridian', click: () => { mainWin.show(); mainWin.focus(); } },
    { type: 'separator' },
    { label: 'Quit', click: () => { mainWin.removeAllListeners('close'); app.quit(); } },
  ]));
}

// ---------- paths ----------

const DB_PATH             = () => path.join(app.getPath('userData'), 'nova-memory.db');
const STATE_PATH          = () => path.join(app.getPath('userData'), 'meridian-state.json');
const POMODORO_STATE_PATH = () => path.join(app.getPath('home'), '.config', 'meridian-pomodoro', 'state.json');
const API_KEY_PATH  = () => path.join(app.getPath('userData'), 'api-key.bin');
const SETTINGS_PATH = () => path.join(app.getPath('userData'), 'settings.json');

const readSettings  = () => { try { return JSON.parse(fs.readFileSync(SETTINGS_PATH(), 'utf8')); } catch { return {}; } };
const writeSettings = (s) => fs.writeFileSync(SETTINGS_PATH(), JSON.stringify(s), 'utf8');

const DEFAULT_MODEL = 'meta-llama/llama-3.1-8b-instruct:free';

// ---------- pomodoro state poller ----------

function startPomodoroPoller() {
  setInterval(async () => {
    if (!mainWin || mainWin.isDestroyed()) return;
    try {
      const raw = await mainWin.webContents.executeJavaScript(
        `localStorage.getItem('meridian_pomodoro')`
      );
      if (!raw) return;
      const state = JSON.parse(raw);
      const p = POMODORO_STATE_PATH();
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, JSON.stringify(state), 'utf8');
    } catch (err) {
      console.error('[PomodoroPoller] Error:', err.message);
    }
  }, 1000);
}

// ---------- morning prompt timer ----------

let lastPromptDate = null;

function startMorningTimer() {
  setInterval(() => {
    const { morningTime } = readSettings();
    if (!morningTime || !mainWin) return;
    const now   = new Date();
    const hhmm  = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const today = now.toDateString();
    if (hhmm === morningTime && lastPromptDate !== today) {
      lastPromptDate = today;
      mainWin.show();
      mainWin.focus();
      mainWin.webContents.send('morning-prompt');
    }
  }, 30_000); // check every 30 s
}

function registerIpc() {
  ipcMain.handle('save-state', (_e, state) => {
    fs.writeFileSync(STATE_PATH(), JSON.stringify(state), 'utf8');
  });

  ipcMain.handle('load-state', () => {
    try { return JSON.parse(fs.readFileSync(STATE_PATH(), 'utf8')); }
    catch { return null; }
  });

  ipcMain.handle('get-api-key', () => {
    try { return safeStorage.decryptString(fs.readFileSync(API_KEY_PATH())); }
    catch {}
    return readSettings().apiKey ?? null;
  });

  ipcMain.handle('set-api-key', (_e, key) => {
    try {
      fs.writeFileSync(API_KEY_PATH(), safeStorage.encryptString(key));
    } catch {
      const s = readSettings();
      s.apiKey = key;
      writeSettings(s);
    }
  });

  ipcMain.handle('ai-query', async (_e, { systemPrompt, userMsg }) => {
    let apiKey;
    try { apiKey = safeStorage.decryptString(fs.readFileSync(API_KEY_PATH())); }
    catch { apiKey = readSettings().apiKey ?? null; }
    if (!apiKey) return 'No API key found. Please add your OpenRouter key in Settings.';
    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), 30_000);
    try {
      const r = await fetch(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://meridian.app',
            'X-Title': 'Meridian',
          },
          signal: controller.signal,
          body: JSON.stringify({
            model: readSettings().model || DEFAULT_MODEL,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user',   content: userMsg },
            ],
            max_tokens: 1000,
          }),
        }
      );
      const d = await r.json();
      return d.choices?.[0]?.message?.content || d.error?.message || '';
    } catch (e) {
      if (e.name === 'AbortError') return 'Error: Request timed out after 30 seconds.';
      throw e;
    } finally {
      clearTimeout(timeoutId);
    }
  });

  ipcMain.handle('ai-chat', async (_e, { messages }) => {
    let apiKey;
    try { apiKey = safeStorage.decryptString(fs.readFileSync(API_KEY_PATH())); }
    catch { apiKey = readSettings().apiKey ?? null; }
    if (!apiKey) return 'No API key found. Please add your OpenRouter key in Settings.';
    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), 45_000);
    try {
      const r = await fetch(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://meridian.app',
            'X-Title': 'Meridian',
          },
          signal: controller.signal,
          body: JSON.stringify({
            model: readSettings().model || DEFAULT_MODEL,
            messages,
            max_tokens: 1200,
          }),
        }
      );
      const d = await r.json();
      return d.choices?.[0]?.message?.content || d.error?.message || '';
    } catch (e) {
      if (e.name === 'AbortError') return 'Error: Request timed out after 45 seconds.';
      throw e;
    } finally {
      clearTimeout(timeoutId);
    }
  });

  ipcMain.handle('write-pomodoro-state', (_e, state) => {
    const p = POMODORO_STATE_PATH();
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify(state), 'utf8');
    console.log('[IPC write-pomodoro-state] Wrote to state.json:', JSON.stringify({ running: state.running, isRunning: state.isRunning, secondsLeft: state.secondsLeft, endTime: state.endTime }));
  });

  ipcMain.handle('get-model', () => readSettings().model || DEFAULT_MODEL);

  ipcMain.handle('set-model', (_e, model) => {
    const s = readSettings(); s.model = model; writeSettings(s);
  });

  ipcMain.handle('get-morning-time', () => readSettings().morningTime ?? null);

  ipcMain.handle('set-morning-time', (_e, time) => {
    const s = readSettings();
    s.morningTime = time;
    writeSettings(s);
  });

  // ---- nova:session ----
  ipcMain.handle('nova:session:save', (_e, session) => {
    db.prepare(`INSERT OR REPLACE INTO nova_sessions (id,program,date,started_at,ended_at,raw_messages,summary,energy_level,tags) VALUES (?,?,?,?,?,?,?,?,?)`).run(
      session.id, session.program, session.date, session.started_at, session.ended_at ?? null,
      session.raw_messages ? JSON.stringify(session.raw_messages) : null,
      session.summary ?? null, session.energy_level ?? null,
      session.tags ? JSON.stringify(session.tags) : null
    );
  });
  ipcMain.handle('nova:session:get-range', (_e, { from, to }) =>
    db.prepare('SELECT * FROM nova_sessions WHERE date BETWEEN ? AND ? ORDER BY started_at DESC').all(from, to)
  );
  ipcMain.handle('nova:session:get-recent', (_e, limit = 20) =>
    db.prepare('SELECT * FROM nova_sessions ORDER BY started_at DESC LIMIT ?').all(limit)
  );

  // ---- nova:insight ----
  ipcMain.handle('nova:insight:save', (_e, insight) => {
    db.prepare(`INSERT OR REPLACE INTO nova_insights (id,session_id,type,content,confidence,source,created_at,is_active) VALUES (?,?,?,?,?,?,?,?)`).run(
      insight.id, insight.session_id ?? null, insight.type, insight.content,
      insight.confidence ?? 0.8, insight.source, insight.created_at, insight.is_active ?? 1
    );
  });
  ipcMain.handle('nova:insight:get-active', () =>
    db.prepare('SELECT * FROM nova_insights WHERE is_active = 1 ORDER BY created_at DESC').all()
  );
  ipcMain.handle('nova:insight:deactivate', (_e, id) =>
    db.prepare('UPDATE nova_insights SET is_active = 0 WHERE id = ?').run(id)
  );

  // ---- nova:checkin ----
  ipcMain.handle('nova:checkin:save', (_e, checkin) => {
    db.prepare(`INSERT INTO nova_checkins (id,asked_at,query,response,context_snapshot) VALUES (?,?,?,?,?)`).run(
      checkin.id, checkin.asked_at, checkin.query, checkin.response,
      checkin.context_snapshot ? JSON.stringify(checkin.context_snapshot) : null
    );
  });
  ipcMain.handle('nova:checkin:get-recent', (_e, limit = 20) =>
    db.prepare('SELECT * FROM nova_checkins ORDER BY asked_at DESC LIMIT ?').all(limit ?? 20)
  );

  // ---- nova:behavioral ----
  ipcMain.handle('nova:behavioral:log', (_e, snapshot) => {
    db.prepare(`INSERT OR REPLACE INTO nova_behavioral (date,tasks_generated,tasks_accepted,tasks_rejected,tasks_completed,sync_score_start,sync_score_end,briefing_done,regroup_done) VALUES (?,?,?,?,?,?,?,?,?)`).run(
      snapshot.date, snapshot.tasks_generated ?? 0, snapshot.tasks_accepted ?? 0,
      snapshot.tasks_rejected ?? 0, snapshot.tasks_completed ?? 0,
      snapshot.sync_score_start ?? null, snapshot.sync_score_end ?? null,
      snapshot.briefing_done ?? 0, snapshot.regroup_done ?? 0
    );
  });
  ipcMain.handle('nova:behavioral:get-range', (_e, { from, to }) =>
    db.prepare('SELECT * FROM nova_behavioral WHERE date BETWEEN ? AND ? ORDER BY date ASC').all(from, to)
  );
  ipcMain.handle('nova:behavioral:get-today', () => {
    const today = new Date().toISOString().slice(0, 10);
    return db.prepare('SELECT * FROM nova_behavioral WHERE date = ?').get(today) ?? null;
  });

  // ---- nova:knowledge ----
  ipcMain.handle('nova:knowledge:upsert', (_e, entry) => {
    db.prepare(`INSERT OR REPLACE INTO knowledge_pool (id,category,text,source,confidence,created_at,updated_at,insight_id) VALUES (?,?,?,?,?,?,?,?)`).run(
      entry.id, entry.category, entry.text, entry.source,
      entry.confidence ?? 1.0, entry.created_at, entry.updated_at,
      entry.insight_id ?? null
    );
  });
  ipcMain.handle('nova:knowledge:delete', (_e, id) =>
    db.prepare('DELETE FROM knowledge_pool WHERE id = ?').run(id)
  );
  ipcMain.handle('nova:knowledge:get-all', () =>
    db.prepare('SELECT * FROM knowledge_pool ORDER BY updated_at DESC').all()
  );
}

// ---------- lifecycle ----------

app.whenReady().then(() => {
  db = new Database(DB_PATH());
  db.exec(require('./src/db/schema.js'));
  registerIpc();
  createWindow();
  createTray();
  startMorningTimer();
  startPomodoroPoller();
});

app.on('window-all-closed', () => { /* stay alive in tray */ });

app.on('activate', () => {
  if (mainWin) { mainWin.show(); mainWin.focus(); }
  else createWindow();
});
