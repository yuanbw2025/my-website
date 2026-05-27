const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('promoVideo', {
  selectImages: () => ipcRenderer.invoke('images:select'),
  selectOutput: () => ipcRenderer.invoke('output:select'),
  generateVoiceover: (payload) => ipcRenderer.invoke('voice:generate', payload),
  exportVideo: (payload) => ipcRenderer.invoke('video:export', payload),
})

