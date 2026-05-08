const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('studyCat', {
  quit: () => ipcRenderer.send('quit'),
  hide: () => ipcRenderer.send('hide'),
  minimize: () => ipcRenderer.send('minimize'),
  toggleClickThrough: () => ipcRenderer.send('toggle-click-through'),
  toggleCat: () => ipcRenderer.send('toggle-cat'),
  setAlwaysOnTop: (value) => ipcRenderer.send('set-always-on-top', value),
  setMood: (mood) => ipcRenderer.send('cat-mood', mood),
  celebrate: () => ipcRenderer.send('cat-celebrate'),
  setHotZone: (active) => ipcRenderer.send('hot-zone', active),
  notify: (title, body) => ipcRenderer.send('notify', { title, body }),
  getSettings: () => ipcRenderer.invoke('settings-get'),
  setSetting: (key, value) => ipcRenderer.send('settings-set', key, value),
  onClickThroughChanged: (cb) =>
    ipcRenderer.on('click-through-changed', (_e, value) => cb(value)),
});
