const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  saveState:       (state) => ipcRenderer.invoke('save-state', state),
  loadState:       ()      => ipcRenderer.invoke('load-state'),
  getApiKey:       ()      => ipcRenderer.invoke('get-api-key'),
  setApiKey:       (key)   => ipcRenderer.invoke('set-api-key', key),
  getModel:        ()      => ipcRenderer.invoke('get-model'),
  setModel:        (m)     => ipcRenderer.invoke('set-model', m),
  getMorningTime:  ()      => ipcRenderer.invoke('get-morning-time'),
  setMorningTime:  (time)  => ipcRenderer.invoke('set-morning-time', time),
  onMorningPrompt: (cb)    => ipcRenderer.on('morning-prompt', cb),
  queryAI:             (params) => ipcRenderer.invoke('ai-query', params),
  chatNOVA:            (params) => ipcRenderer.invoke('ai-chat', params),
  writePomodoroState:  (state) => ipcRenderer.invoke('write-pomodoro-state', state),
})

contextBridge.exposeInMainWorld('nova', {
  session: {
    save:      (s)         => ipcRenderer.invoke('nova:session:save', s),
    getRange:  (from, to)  => ipcRenderer.invoke('nova:session:get-range', { from, to }),
    getRecent: (n)         => ipcRenderer.invoke('nova:session:get-recent', n),
  },
  insight: {
    save:       (i)  => ipcRenderer.invoke('nova:insight:save', i),
    getActive:  ()   => ipcRenderer.invoke('nova:insight:get-active'),
    deactivate: (id) => ipcRenderer.invoke('nova:insight:deactivate', id),
  },
  checkin: {
    save:      (c) => ipcRenderer.invoke('nova:checkin:save', c),
    getRecent: (n) => ipcRenderer.invoke('nova:checkin:get-recent', n),
  },
  behavioral: {
    log:      (s)         => ipcRenderer.invoke('nova:behavioral:log', s),
    getRange: (from, to)  => ipcRenderer.invoke('nova:behavioral:get-range', { from, to }),
    getToday: ()          => ipcRenderer.invoke('nova:behavioral:get-today'),
  },
  knowledge: {
    upsert: (e)  => ipcRenderer.invoke('nova:knowledge:upsert', e),
    delete: (id) => ipcRenderer.invoke('nova:knowledge:delete', id),
    getAll: ()   => ipcRenderer.invoke('nova:knowledge:get-all'),
  },
})
