import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'path';
import fs from 'fs';

const isDev = !app.isPackaged && process.env.NODE_ENV !== 'production';
let mainWindow: BrowserWindow | null = null;
let serverInstance: any = null;

// Ensure persistent application data folder in user profile (AppData/Roaming/SutawaneClasses)
const userDataPath = app.getPath('userData');
const persistentDataDir = path.join(userDataPath, 'data');
[
  persistentDataDir,
  path.join(persistentDataDir, 'database'),
  path.join(persistentDataDir, 'photos'),
  path.join(persistentDataDir, 'attachments'),
  path.join(persistentDataDir, 'backups')
].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Configure backend environment
process.env.SUTAWANE_DATA_DIR = persistentDataDir;
process.env.IS_ELECTRON_MAIN = 'true';
process.env.PORT = process.env.PORT || '5000';
process.env.NODE_ENV = isDev ? 'development' : 'production';

// Resolve application icon across dev and packaged distributions
function getAppIcon(): string | undefined {
  const candidates = [
    path.join(__dirname, '../../build/icon.ico'),
    path.join(__dirname, '../build/icon.ico'),
    path.join(process.resourcesPath || '', 'build/icon.ico'),
    path.join(process.resourcesPath || '', 'icon.ico'),
    path.join(__dirname, 'icon.ico')
  ];
  return candidates.find((p) => fs.existsSync(p));
}

// Start backend Express server inside Electron in packaged production
async function startBackendServer(): Promise<void> {
  const candidateBackendPaths = [
    path.join(__dirname, '../../backend/dist/index.js'),
    path.join(__dirname, '../../../backend/dist/index.js'),
    path.join(process.resourcesPath || '', 'backend/dist/index.js'),
    path.join(process.resourcesPath || '', 'app.asar/backend/dist/index.js')
  ];

  const backendPath = candidateBackendPaths.find((p) => fs.existsSync(p));
  if (!backendPath) {
    console.warn('[Electron] Could not locate compiled backend at candidate paths:', candidateBackendPaths);
    return;
  }

  try {
    const backendModule = require(backendPath);
    if (typeof backendModule.startServer === 'function') {
      serverInstance = await backendModule.startServer(5000);
      console.log(`[Electron] In-process backend server started successfully from: ${backendPath}`);
    }
  } catch (err) {
    console.error('[Electron] Error starting backend server:', err);
  }
}

function createWindow(): void {
  const iconPath = getAppIcon();

  mainWindow = new BrowserWindow({
    width: 1366,
    height: 850,
    minWidth: 1024,
    minHeight: 700,
    title: 'Sutawane Classes Management Software - Ultoxy Technologies',
    icon: iconPath,
    autoHideMenuBar: true,
    show: false, // Show once ready-to-show for seamless instant visual pop
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.once('ready-to-show', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  // Intercept external URLs (like WhatsApp, mailto, web links) and launch in default OS browser/app
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (
      url.startsWith('https://') ||
      url.startsWith('http://') ||
      url.startsWith('mailto:') ||
      url.startsWith('tel:') ||
      url.startsWith('whatsapp:')
    ) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  if (isDev) {
    const devServerUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
    mainWindow.loadURL(devServerUrl);
  } else {
    // In production, load via local HTTP to ensure 100% full compatibility with BrowserRouter and /api
    mainWindow.loadURL('http://localhost:5000');
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC Handlers
ipcMain.handle('app:version', () => app.getVersion());
ipcMain.handle('app:data-path', () => persistentDataDir);
ipcMain.handle('app:company', () => 'Ultoxy Technologies');
ipcMain.handle('app:open-external', async (_event, url: string) => {
  try {
    if (
      typeof url === 'string' &&
      (url.startsWith('http://') ||
        url.startsWith('https://') ||
        url.startsWith('mailto:') ||
        url.startsWith('tel:') ||
        url.startsWith('whatsapp:'))
    ) {
      await shell.openExternal(url);
      return true;
    }
  } catch (err) {
    console.error('[Electron] Failed to open external URL:', url, err);
  }
  return false;
});

app.whenReady().then(async () => {
  if (!isDev) {
    await startBackendServer();
  }

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('before-quit', () => {
  if (serverInstance && typeof serverInstance.close === 'function') {
    try {
      serverInstance.close();
    } catch {}
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
