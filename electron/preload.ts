import { contextBridge, ipcRenderer } from 'electron';

// Expose safe, isolated API to renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  isDesktop: true,
  getAppVersion: () => ipcRenderer.invoke('app:version'),
  getPlatform: () => process.platform,
  getAppDataPath: () => ipcRenderer.invoke('app:data-path'),
  openExternal: (url: string) => ipcRenderer.invoke('app:open-external', url)
});
