const { contextBridge, ipcRenderer, webUtils } = require('electron');

const subscribe = (channel, callback) => {
  const listener = (_event, value) => callback(value);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
};
contextBridge.exposeInMainWorld(
  'jamDesktop',
  Object.freeze({
    getAnalyzerState: () => ipcRenderer.invoke('jam:analyzer-state'),
    startYouTube: url => ipcRenderer.invoke('jam:analyzer-youtube', url),
    chooseAudio: () => ipcRenderer.invoke('jam:analyzer-choose-audio'),
    analyzeDroppedFile: file =>
      ipcRenderer.invoke('jam:analyzer-local', webUtils.getPathForFile(file)),
    chooseDestination: () => ipcRenderer.invoke('jam:analyzer-destination'),
    cancelAnalysis: () => ipcRenderer.invoke('jam:analyzer-cancel'),
    revealAudio: () => ipcRenderer.invoke('jam:analyzer-reveal'),
    onAnalyzerState: callback => subscribe('jam:analyzer-changed', callback),
    onOpenAnalyzer: callback => subscribe('jam:show-analyzer', callback),
  }),
);
