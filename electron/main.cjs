const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const http = require('http');

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
    const candidates = [
      path.join(__dirname, '../dist/index.html'),
      path.join(__dirname, '../frontend/dist/index.html'),
      path.join(app.getAppPath(), 'dist/index.html'),
      path.join(app.getAppPath(), 'frontend/dist/index.html'),
      path.join(__dirname, 'index.html'),
    ];
    let loaded = false;
    for (const p of candidates) {
      if (fs.existsSync(p)) {
        mainWindow.loadFile(p);
        loaded = true;
        break;
      }
    }
    if (!loaded) {
      mainWindow.loadFile(candidates[0]);
    }
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

// System Browser Authentication Loopback Bridge
let authLoopbackServer = null;

ipcMain.handle('start-browser-auth', async (event, { authUrl }) => {
  if (authLoopbackServer) {
    try { authLoopbackServer.close(); } catch (_) {}
    authLoopbackServer = null;
  }

  return new Promise((resolve) => {
    let resolved = false;

    authLoopbackServer = http.createServer((req, res) => {
      try {
        const reqUrl = new URL(req.url, 'http://127.0.0.1');
        if (reqUrl.pathname === '/callback' || reqUrl.pathname === '/auth-callback') {
          const customToken = reqUrl.searchParams.get('customToken') || reqUrl.searchParams.get('token');
          const idToken = reqUrl.searchParams.get('idToken');
          const email = reqUrl.searchParams.get('email');
          const error = reqUrl.searchParams.get('error');

          res.writeHead(200, {
            'Content-Type': 'text/html; charset=utf-8',
            'Access-Control-Allow-Origin': '*'
          });

          if (error) {
            res.end(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Authentication Failed</title><style>body{background:#020617;color:#f87171;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;flex-direction:column}h2{margin-bottom:8px}p{color:#94a3b8}</style></head><body><h2>Authentication Cancelled or Failed</h2><p>${error}</p><p>You can return to the desktop application.</p></body></html>`);
            if (!resolved) {
              resolved = true;
              resolve({ success: false, error });
            }
          } else {
            res.end(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Authenticated - Olive Pizza</title><style>body{background:#020617;color:#fff;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;flex-direction:column}h2{color:#22c55e;margin-bottom:8px}p{color:#94a3b8}</style></head><body><h2>✓ Successfully Authenticated</h2><p>You can close this tab and return to your Olive Pizza Owner Dashboard.</p><script>setTimeout(()=>{window.close();},2500);</script></body></html>`);
            if (!resolved) {
              resolved = true;
              resolve({ success: true, customToken, idToken, email });
            }
          }

          if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
          }

          setTimeout(() => {
            if (authLoopbackServer) {
              try { authLoopbackServer.close(); } catch (_) {}
              authLoopbackServer = null;
            }
          }, 1500);
          return;
        }

        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal Server Error');
      }
    });

    authLoopbackServer.listen(0, '127.0.0.1', () => {
      const port = authLoopbackServer.address().port;
      const callbackUrl = `http://127.0.0.1:${port}/callback`;
      
      const targetUrl = new URL(authUrl || 'https://owner.olivepizza.in/login');
      targetUrl.searchParams.set('desktop_callback', callbackUrl);
      targetUrl.searchParams.set('source', 'electron');

      shell.openExternal(targetUrl.toString());

      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          if (authLoopbackServer) {
            try { authLoopbackServer.close(); } catch (_) {}
            authLoopbackServer = null;
          }
          resolve({ success: false, error: 'Authentication timed out. Please try again.' });
        }
      }, 5 * 60 * 1000);
    });

    authLoopbackServer.on('error', (err) => {
      if (!resolved) {
        resolved = true;
        resolve({ success: false, error: err.message });
      }
    });
  });
});

ipcMain.handle('open-external-url', (event, url) => {
  if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
    shell.openExternal(url);
    return true;
  }
  return false;
});

app.whenReady().then(createWindow);
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
