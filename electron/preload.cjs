const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  printReceipt: (htmlContent, printerName) =>
    ipcRenderer.invoke('print-receipt', { htmlContent, printerName }),
  platform: process.platform,
  isElectron: true,
  startBrowserAuth: (authUrl) => ipcRenderer.invoke('start-browser-auth', { authUrl }),
  openExternalUrl: (url) => ipcRenderer.invoke('open-external-url', url)
});

contextBridge.exposeInMainWorld('electronAuth', {
  isDesktop: true,
  startBrowserAuth: (authUrl) => ipcRenderer.invoke('start-browser-auth', { authUrl }),
  openExternalUrl: (url) => ipcRenderer.invoke('open-external-url', url)
});
