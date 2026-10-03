const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('api', {
  getConfig: () => ipcRenderer.invoke('cfg:get'),
  saveConfig: (patch) => ipcRenderer.invoke('cfg:save', patch),
  complete: (req) => ipcRenderer.invoke('llm:complete', req),
  saveFile: (name, text) => ipcRenderer.invoke('file:save', name, text),
});
