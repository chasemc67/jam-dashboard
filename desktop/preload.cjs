const { contextBridge, ipcRenderer, webUtils } = require('electron');

const subscribe = (channel, callback) => {
  const listener = (_event, value) => callback(value);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
};
contextBridge.exposeInMainWorld(
  'jamAgent',
  Object.freeze({
    copyConfiguration: () => ipcRenderer.invoke('jam:agent-copy-config'),
    getConnection: () => ipcRenderer.invoke('jam:agent-connection'),
    connect: state => ipcRenderer.invoke('jam:agent-connect', state),
    disconnect: id => ipcRenderer.invoke('jam:agent-disconnect', id),
    publish: (id, state) => ipcRenderer.invoke('jam:agent-state', id, state),
    reply: (id, reply) => ipcRenderer.invoke('jam:agent-reply', id, reply),
    onCommand: callback => subscribe('jam:agent-command', callback),
  }),
);
// Write-only: the renderer can save or clear the Gateway key but never read it back.
contextBridge.exposeInMainWorld(
  'jamGatewayKey',
  Object.freeze({
    getStatus: () => ipcRenderer.invoke('jam:gateway-key-status'),
    save: key => ipcRenderer.invoke('jam:gateway-key-save', key),
    clear: () => ipcRenderer.invoke('jam:gateway-key-clear'),
  }),
);
contextBridge.exposeInMainWorld(
  'jamDesktop',
  Object.freeze({
    getAnalyzerState: () => ipcRenderer.invoke('jam:analyzer-state'),
    startYouTube: input => ipcRenderer.invoke('jam:analyzer-youtube', input),
    chooseAudio: () => ipcRenderer.invoke('jam:analyzer-choose-audio'),
    analyzeDroppedFile: file =>
      ipcRenderer.invoke('jam:analyzer-local', webUtils.getPathForFile(file)),
    chooseDestination: () => ipcRenderer.invoke('jam:analyzer-destination'),
    cancelAnalysis: () => ipcRenderer.invoke('jam:analyzer-cancel'),
    revealAudio: () => ipcRenderer.invoke('jam:analyzer-reveal'),
    onAnalyzerState: callback => subscribe('jam:analyzer-changed', callback),
    onAnalyzerOpen: callback => subscribe('jam:analyzer-open', callback),
  }),
);
contextBridge.exposeInMainWorld(
  'jamFretTracker',
  Object.freeze({
    track: frame => ipcRenderer.invoke('jam:tracker-frame', frame),
    stop: () => ipcRenderer.invoke('jam:tracker-stop'),
  }),
);

contextBridge.exposeInMainWorld(
  'jamRecording',
  Object.freeze({
    start: metadata => ipcRenderer.invoke('jam:recording-start', metadata),
    append: (id, stream, data) =>
      ipcRenderer.invoke('jam:recording-append', id, stream, data),
    stop: (id, note, error) =>
      ipcRenderer.invoke('jam:recording-stop', id, note, error),
    note: (id, note) => ipcRenderer.invoke('jam:recording-note', id, note),
    show: id => ipcRenderer.invoke('jam:recording-show', id),
  }),
);
