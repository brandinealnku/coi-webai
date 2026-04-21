const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('worktrailDesktop', {
  version: '0.5.0',
  startTracking: () => ipcRenderer.invoke('tracker:start'),
  stopTracking: () => ipcRenderer.invoke('tracker:stop'),
  getState: () => ipcRenderer.invoke('tracker:state'),
  clearSessions: () => ipcRenderer.invoke('tracker:clear'),
  exportSessions: () => ipcRenderer.invoke('tracker:export'),
  getSettings: () => ipcRenderer.invoke('tracker:settings:get'),
  updateSettings: payload => ipcRenderer.invoke('tracker:settings:update', payload),
  openDataFolder: () => ipcRenderer.invoke('tracker:open-data-folder'),
  onUpdate: callback => ipcRenderer.on('tracker:update', (_event, payload) => callback(payload)),
  onError: callback => ipcRenderer.on('tracker:error', (_event, message) => callback(message))
});
