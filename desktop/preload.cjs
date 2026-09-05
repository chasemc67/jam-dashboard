const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld(
  'jamDesktop',
  Object.freeze({
    openAnalyzer: () => ipcRenderer.invoke('jam:open-analyzer'),
  }),
);
