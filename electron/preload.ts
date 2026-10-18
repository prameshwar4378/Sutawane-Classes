import { contextBridge, ipcRenderer } from 'electron';

// Expose safe, isolated API to renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  isDesktop: true,
  getAppVersion: () => ipcRenderer.invoke('app:version'),
  getPlatform: () => process.platform,
  getAppDataPath: () => ipcRenderer.invoke('app:data-path'),
  openExternal: (url: string) => ipcRenderer.invoke('app:open-external', url),
  printDocument: (params: { html: string; landscape?: boolean; pageSize?: string }) =>
    ipcRenderer.invoke('app:print-document', params),
  previewPDF: (params: { html: string; title?: string; landscape?: boolean; pageSize?: string }) =>
    ipcRenderer.invoke('app:preview-pdf', params),
  savePDF: (params: { html: string; defaultFilename?: string; landscape?: boolean; pageSize?: string }) =>
    ipcRenderer.invoke('app:save-pdf', params)
});
