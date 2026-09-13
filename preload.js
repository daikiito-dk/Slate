const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('slateDesktop', {
  openWorkbook: () => ipcRenderer.invoke('slate:open-workbook'),
  saveWorkbook: payload => ipcRenderer.invoke('slate:save-workbook', payload)
});
