import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import fs from 'fs';

const isDev = !app.isPackaged && process.env.NODE_ENV !== 'production';
let mainWindow: BrowserWindow | null = null;

// Ensure persistent application data folder
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

// Configure backend to use persistent application directory in packaged mode
if (!process.env.SUTAWANE_DATA_DIR) {
  process.env.SUTAWANE_DATA_DIR = persistentDataDir;
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    title: 'Sutawane Classes Management System',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  if (isDev) {
    const devServerUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
    mainWindow.loadURL(devServerUrl);
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load the built React/Vite index.html
    const indexPath = path.join(__dirname, '../../frontend/dist/index.html');
    mainWindow.loadFile(indexPath);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC Handlers
ipcMain.handle('app:version', () => app.getVersion());
ipcMain.handle('app:data-path', () => persistentDataDir);

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
