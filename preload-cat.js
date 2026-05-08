const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('catApi', {
  onWorkArea:    (cb) => ipcRenderer.on('work-area', (_e, data) => cb(data)),
  onMood:        (cb) => ipcRenderer.on('mood', (_e, mood) => cb(mood)),
  onCelebrate:   (cb) => ipcRenderer.on('celebrate', () => cb()),
  onPanelBounds: (cb) => ipcRenderer.on('panel-bounds', (_e, b) => cb(b)),
  onCatSize:     (cb) => ipcRenderer.on('cat-size', (_e, s) => cb(s)),
  setBounds:     (b) => ipcRenderer.send('cat-bounds', b),
});
