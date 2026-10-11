const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('mint', {
  command: (action, value) => ipcRenderer.send('browser:command', action, value),
  onState: callback => ipcRenderer.on('browser:state', (_event, state) => callback(state)),
  onNotice: callback => ipcRenderer.on('browser:notice', (_event, message) => callback(message)),
  onFocus: callback => ipcRenderer.on('browser:focus-address', () => callback())
});
