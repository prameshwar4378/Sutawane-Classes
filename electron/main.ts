import { app, BrowserWindow, ipcMain, shell, dialog } from 'electron';
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';

// Ensure Windows 11 uses the robust standard Print Dialog without the broken preview banner
if (process.platform === 'win32') {
  try {
    exec('reg add "HKCU\\Software\\Microsoft\\Print\\UnifiedPrintDialog" /v PreferLegacyPrintDialog /t REG_DWORD /d 1 /f', (err) => {
      if (err) {
        console.warn('[Electron] Could not configure PreferLegacyPrintDialog registry key:', err);
      }
    });
  } catch {}
}

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

// Helper: Render HTML in an isolated off-screen window for clean A4 printing and PDF generation
async function renderHtmlToBufferOrPrint(
  html: string,
  options: {
    action: 'print' | 'pdf';
    landscape?: boolean;
    pageSize?: string;
  }
): Promise<{ success: boolean; pdfBuffer?: Buffer; failureReason?: string; error?: string }> {
  const { action, landscape = false, pageSize = 'A4' } = options;
  const tempDir = app.getPath('temp');
  const tempHtmlPath = path.join(
    tempDir,
    `print_temp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.html`
  );

  try {
    fs.writeFileSync(tempHtmlPath, html, 'utf-8');
  } catch (err: any) {
    return { success: false, error: `Failed to write print temp file: ${err?.message || err}` };
  }

  let printWin: BrowserWindow | null = new BrowserWindow({
    show: false,
    width: landscape ? 1123 : 794,
    height: landscape ? 794 : 1123,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });

  const cleanup = () => {
    if (printWin && !printWin.isDestroyed()) {
      printWin.destroy();
      printWin = null;
    }
    try {
      if (fs.existsSync(tempHtmlPath)) {
        fs.unlinkSync(tempHtmlPath);
      }
    } catch {}
  };

  return new Promise((resolve) => {
    printWin!.webContents.once('did-finish-load', async () => {
      try {
        // Wait slightly for fonts and styles to fully render
        await new Promise((r) => setTimeout(r, 300));
        if (!printWin || printWin.isDestroyed()) {
          cleanup();
          resolve({ success: false, error: 'Print window closed unexpectedly' });
          return;
        }

        if (action === 'print') {
          printWin.webContents.print(
            {
              silent: false,
              printBackground: true,
              landscape: !!landscape,
              pageSize: (pageSize as any) || 'A4'
            },
            (success, failureReason) => {
              cleanup();
              resolve({ success, failureReason });
            }
          );
        } else {
          const pdfBuffer = await printWin.webContents.printToPDF({
            pageSize: (pageSize as any) || 'A4',
            landscape: !!landscape,
            printBackground: true,
            preferCSSPageSize: true
          });
          cleanup();
          resolve({ success: true, pdfBuffer });
        }
      } catch (err: any) {
        cleanup();
        resolve({ success: false, error: err?.message || String(err) });
      }
    });

    printWin!.webContents.once('did-fail-load', (_e, errorCode, errorDescription) => {
      cleanup();
      resolve({
        success: false,
        error: `Failed to load HTML for print: ${errorCode} - ${errorDescription}`
      });
    });

    printWin!.loadFile(tempHtmlPath);
  });
}

// 1. Direct Document Printing Handler
ipcMain.handle(
  'app:print-document',
  async (_event, params: { html: string; landscape?: boolean; pageSize?: string }) => {
    const { html, landscape = false, pageSize = 'A4' } = params || {};
    return await renderHtmlToBufferOrPrint(html, { action: 'print', landscape, pageSize });
  }
);

// 2. High-DPI Vector PDF Generation & Instant OS Preview Handler
ipcMain.handle(
  'app:preview-pdf',
  async (
    _event,
    params: { html: string; title?: string; landscape?: boolean; pageSize?: string }
  ) => {
    const { html, title = 'receipt', landscape = false, pageSize = 'A4' } = params || {};
    const res = await renderHtmlToBufferOrPrint(html, { action: 'pdf', landscape, pageSize });
    if (!res.success || !res.pdfBuffer) {
      return { success: false, error: res.error || 'Failed to render PDF' };
    }

    try {
      const tempDir = app.getPath('temp');
      const safeTitle = (title || 'document').replace(/[^a-zA-Z0-9_-]/g, '_');
      const tempPdfPath = path.join(tempDir, `${safeTitle}_${Date.now()}.pdf`);
      fs.writeFileSync(tempPdfPath, res.pdfBuffer);

      // Launch PDF in default system viewer (Microsoft Edge / Adobe Acrobat) with interactive print preview
      await shell.openPath(tempPdfPath);
      return { success: true, filePath: tempPdfPath };
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) };
    }
  }
);

// 3. User-Selected File Save PDF Handler
ipcMain.handle(
  'app:save-pdf',
  async (
    _event,
    params: { html: string; defaultFilename?: string; landscape?: boolean; pageSize?: string }
  ) => {
    const {
      html,
      defaultFilename = 'receipt.pdf',
      landscape = false,
      pageSize = 'A4'
    } = params || {};
    try {
      const win = mainWindow && !mainWindow.isDestroyed() ? mainWindow : undefined;
      const { canceled, filePath } = await dialog.showSaveDialog(win!, {
        defaultPath: defaultFilename,
        filters: [{ name: 'PDF Documents (*.pdf)', extensions: ['pdf'] }]
      });

      if (canceled || !filePath) {
        return { success: false, canceled: true };
      }

      const res = await renderHtmlToBufferOrPrint(html, { action: 'pdf', landscape, pageSize });
      if (!res.success || !res.pdfBuffer) {
        return { success: false, error: res.error || 'Failed to render PDF' };
      }

      fs.writeFileSync(filePath, res.pdfBuffer);
      return { success: true, filePath };
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) };
    }
  }
);

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
