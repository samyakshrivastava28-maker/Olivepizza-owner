const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  printReceipt: (htmlContent, printerName) =>
    ipcRenderer.invoke('print-receipt', { htmlContent, printerName }),
  platform: process.platform,
  isElectron: true,
});
