const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'Olive Pizza — Owner Dashboard',
    backgroundColor: '#0B0F17',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const isDev = process.env.NODE_ENV !== 'production' && !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://localhost:5174');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../frontend/dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC: Print receipt silently
ipcMain.handle('print-receipt', async (event, { htmlContent, printerName }) => {
  if (!mainWindow) return { success: false, error: 'Window not initialized' };
  const printWin = new BrowserWindow({ show: false, webPreferences: { nodeIntegration: false } });
  await printWin.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(htmlContent));
  return new Promise((resolve) => {
    printWin.webContents.print(
      { silent: true, printBackground: true, deviceName: printerName || '' },
      (success, failureReason) => {
        printWin.close();
        resolve(success ? { success: true } : { success: false, error: failureReason });
      }
    );
  });
});

app.whenReady().then(createWindow);
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
