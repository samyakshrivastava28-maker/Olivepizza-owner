const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

const BACKEND_URL = 'https://olivepizza-owner.onrender.com';
const PLATFORM_ORIGIN = 'https://owner.olivepizza.in';

app.commandLine.appendSwitch('disable-gpu-sandbox');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'Olive Pizza — Owner Dashboard',
    backgroundColor: '#0B0F17',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false, // Required for cross-origin APIs and Firebase on file:// protocol
      sandbox: false,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Strip Electron identifier from User-Agent to comply with Google OAuth security policies
  const currentUserAgent = mainWindow.webContents.getUserAgent();
  mainWindow.webContents.setUserAgent(currentUserAgent.replace(/Electron\/[0-9\.]+\s/g, ''));

  // Configure network interceptors for robust backend communication
  const sess = mainWindow.webContents.session;

  sess.webRequest.onBeforeRequest((details, callback) => {
    const url = details.url;
    if (url.startsWith('file:///api/') || url === 'file:///api') {
      return callback({ redirectURL: url.replace('file:///api', `${BACKEND_URL}/api`) });
    }
    if (url.startsWith('file:///restaurant/') || url === 'file:///restaurant') {
      return callback({ redirectURL: url.replace('file:///restaurant', `${BACKEND_URL}/restaurant`) });
    }
    if (url.startsWith('file:///health') || url === 'file:///health') {
      return callback({ redirectURL: url.replace('file:///health', `${BACKEND_URL}/health`) });
    }
    callback({});
  });

  sess.webRequest.onBeforeSendHeaders((details, callback) => {
    const requestHeaders = { ...details.requestHeaders };
    if (!requestHeaders['Origin'] || requestHeaders['Origin'] === 'null' || requestHeaders['Origin'].startsWith('file://')) {
      requestHeaders['Origin'] = PLATFORM_ORIGIN;
    }
    callback({ cancel: false, requestHeaders });
  });

  sess.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders = { ...details.responseHeaders };
    responseHeaders['access-control-allow-origin'] = ['*'];
    responseHeaders['access-control-allow-credentials'] = ['true'];
    responseHeaders['access-control-allow-methods'] = ['GET, POST, PUT, DELETE, PATCH, OPTIONS'];
    responseHeaders['access-control-allow-headers'] = ['*'];
    callback({ cancel: false, responseHeaders });
  });

  // Allow Firebase / Google OAuth popup windows
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.includes('accounts.google.com') || url.includes('firebaseapp.com')) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 520,
          height: 650,
          autoHideMenuBar: true,
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: false,
            sandbox: false,
          }
        }
      };
    }
    return { action: 'deny' };
  });

  // DevTools inspection
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12' || (input.control && input.shift && input.key.toLowerCase() === 'i')) {
      mainWindow.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error(`[Owner Desktop] Failed to load (${errorCode}: ${errorDescription}) at ${validatedURL}`);
  });

  const isDev = process.env.NODE_ENV !== 'production' && !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://localhost:5174');
  } else {
    const fs = require('fs');
    const p1 = path.join(__dirname, '../dist/index.html');
    const p2 = path.join(__dirname, '../frontend/dist/index.html');
    mainWindow.loadFile(fs.existsSync(p1) ? p1 : p2);
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
