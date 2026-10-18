/**
 * electronPrint.ts
 * Unified Printing and PDF Preview Utility for Desktop (Electron) and Web environments.
 * Ensures A4 portrait calibration, solves Windows 11 "This app doesn't support print preview" issue,
 * and provides 1-click vector PDF preview and export.
 */

export interface PrintOptions {
  html: string
  title?: string
  landscape?: boolean
  pageSize?: 'A4' | 'A5' | 'Letter' | 'Legal'
  fallbackElementId?: string
  fallbackBodyClass?: string
}

interface ElectronAPI {
  isDesktop?: boolean
  printDocument?: (params: { html: string; landscape?: boolean; pageSize?: string }) => Promise<{ success: boolean; failureReason?: string; error?: string }>
  previewPDF?: (params: { html: string; title?: string; landscape?: boolean; pageSize?: string }) => Promise<{ success: boolean; filePath?: string; error?: string }>
  savePDF?: (params: { html: string; defaultFilename?: string; landscape?: boolean; pageSize?: string }) => Promise<{ success: boolean; filePath?: string; canceled?: boolean; error?: string }>
  openExternal?: (url: string) => Promise<boolean>
}

function getElectronAPI(): ElectronAPI | null {
  if (typeof window !== 'undefined' && (window as any).electronAPI) {
    return (window as any).electronAPI as ElectronAPI
  }
  return null
}

export function isDesktopApp(): boolean {
  return Boolean(getElectronAPI()?.isDesktop)
}

/**
 * Executes direct printing with orientation and paper sizing.
 * In Electron desktop: Prints via dedicated isolated window with exact A4 portrait dimensions.
 * In Web Browser: Prints via popup or styled main-window print media.
 */
export async function executePrintDocument(options: PrintOptions): Promise<{ success: boolean; error?: string }> {
  const { html, landscape = false, pageSize = 'A4', fallbackBodyClass } = options
  const api = getElectronAPI()

  if (api && typeof api.printDocument === 'function') {
    try {
      const res = await api.printDocument({ html, landscape, pageSize })
      if (!res.success && res.failureReason && res.failureReason !== 'cancelled' && res.failureReason !== 'user_cancelled') {
        console.warn('[Print] Native print failure reason:', res.failureReason)
      }
      return { success: res.success, error: res.failureReason || res.error }
    } catch (err: any) {
      console.warn('[Print] electronAPI.printDocument failed, using browser fallback:', err)
    }
  }

  // Web Browser Fallback: Open clean print tab/window
  try {
    const printWin = window.open('', '_blank', 'width=840,height=900')
    if (printWin && printWin.document) {
      printWin.document.open()
      printWin.document.write(html)
      printWin.document.close()
      printWin.focus()
      setTimeout(() => {
        try {
          printWin.print()
        } catch {}
      }, 350)
      return { success: true }
    }
  } catch {}

  // Fallback 2: Main window print with isolated class
  if (fallbackBodyClass) {
    document.body.classList.add(fallbackBodyClass)
  }
  window.print()
  if (fallbackBodyClass) {
    setTimeout(() => {
      document.body.classList.remove(fallbackBodyClass)
    }, 1500)
  }
  return { success: true }
}

/**
 * Generates an exact A4 PDF and opens it in the default system viewer (e.g., Microsoft Edge on Windows 11).
 * In Microsoft Edge, the user gets:
 * - 100% razor-sharp vector preview
 * - Zoom controls (100%, 200%, 400%)
 * - Full native Edge print preview with zero black boxes or driver incompatibilities
 */
export async function executePreviewPDF(options: PrintOptions): Promise<{ success: boolean; filePath?: string; error?: string }> {
  const { html, title = 'document', landscape = false, pageSize = 'A4' } = options
  const api = getElectronAPI()

  if (api && typeof api.previewPDF === 'function') {
    try {
      return await api.previewPDF({ html, title, landscape, pageSize })
    } catch (err: any) {
      console.error('[PreviewPDF] Failed to launch PDF preview via Electron:', err)
      return { success: false, error: err?.message || String(err) }
    }
  }

  // Web Browser Fallback: Open in dedicated preview window
  try {
    const previewWin = window.open('', '_blank')
    if (previewWin && previewWin.document) {
      previewWin.document.open()
      previewWin.document.write(html)
      previewWin.document.close()
      previewWin.focus()
      return { success: true }
    }
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) }
  }

  return { success: false, error: 'PDF preview not available in this environment' }
}

/**
 * Prompts the user to save the document as a clean, high-DPI A4 PDF file.
 */
export async function executeSavePDF(options: PrintOptions & { defaultFilename?: string }): Promise<{ success: boolean; filePath?: string; canceled?: boolean; error?: string }> {
  const { html, defaultFilename = 'receipt.pdf', landscape = false, pageSize = 'A4' } = options
  const api = getElectronAPI()

  if (api && typeof api.savePDF === 'function') {
    try {
      return await api.savePDF({ html, defaultFilename, landscape, pageSize })
    } catch (err: any) {
      console.error('[SavePDF] Failed to save PDF via Electron:', err)
      return { success: false, error: err?.message || String(err) }
    }
  }

  // Web Browser Fallback: Open print dialog where user can select "Save as PDF"
  return await executePrintDocument(options)
}
