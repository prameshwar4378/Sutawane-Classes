import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import { formatDate, getTodayDateString } from './utils'

export interface StudentExportItem {
  rollNumber: string
  fullName: string
  studentCode?: string
  standard: string
  branchName: string
  sessionName: string
  parentPhone: string
  studentPhone?: string | null
  totalFees: number
  paidFees: number
  pendingFees: number
  previousDuesPending?: number
  overallPendingAmount?: number
  isActive: boolean
  admissionDate: string
}

export interface ExportColumnDef {
  id: string
  label: string
  header: string
  defaultSelected: boolean
  halign?: 'left' | 'center' | 'right'
  minWidth: number
  getValue: (s: StudentExportItem, idx: number) => string | number
  getRawValue?: (s: StudentExportItem, idx: number) => string | number
  getTotal?: (students: StudentExportItem[]) => string | number
  getRawTotal?: (students: StudentExportItem[]) => string | number
}

/**
 * Format currency numbers for PDF export using standard ASCII characters
 * so default PDF fonts render clean Indian currency without symbol corruption.
 */
function formatAmount(amount: number | undefined | null): string {
  const val = Math.round(amount || 0)
  return val.toLocaleString('en-IN')
}

export const PDF_EXPORT_COLUMNS: ExportColumnDef[] = [
  {
    id: 'srNo',
    label: 'Serial Number (#)',
    header: '#',
    defaultSelected: true,
    halign: 'center',
    minWidth: 7,
    getValue: (_s, idx) => idx + 1,
    getRawValue: (_s, idx) => idx + 1,
  },
  {
    id: 'rollNumber',
    label: 'Roll Number',
    header: 'Roll No.',
    defaultSelected: true,
    halign: 'left',
    minWidth: 20,
    getValue: (s) => s.rollNumber || '-',
    getRawValue: (s) => s.rollNumber || '-',
  },
  {
    id: 'studentCode',
    label: 'Student Code',
    header: 'Student Code',
    defaultSelected: false,
    halign: 'left',
    minWidth: 16,
    getValue: (s) => s.studentCode || '-',
    getRawValue: (s) => s.studentCode || '-',
  },
  {
    id: 'fullName',
    label: 'Student Name',
    header: 'Student Name',
    defaultSelected: true,
    halign: 'left',
    minWidth: 28,
    getValue: (s) => s.fullName,
    getRawValue: (s) => s.fullName,
    getTotal: (students) => `TOTALS (${students.length})`,
    getRawTotal: (students) => `TOTALS (${students.length})`,
  },
  {
    id: 'standard',
    label: 'Class / Standard',
    header: 'Class',
    defaultSelected: true,
    halign: 'left',
    minWidth: 14,
    getValue: (s) => s.standard || '-',
    getRawValue: (s) => s.standard || '-',
  },
  {
    id: 'branchName',
    label: 'Branch Location',
    header: 'Branch',
    defaultSelected: true,
    halign: 'left',
    minWidth: 24,
    getValue: (s) => s.branchName || '-',
    getRawValue: (s) => s.branchName || '-',
  },
  {
    id: 'sessionName',
    label: 'Academic Session',
    header: 'Session',
    defaultSelected: false,
    halign: 'left',
    minWidth: 16,
    getValue: (s) => s.sessionName || '-',
    getRawValue: (s) => s.sessionName || '-',
  },
  {
    id: 'parentPhone',
    label: 'Parent Mobile',
    header: 'Parent Mobile',
    defaultSelected: true,
    halign: 'left',
    minWidth: 21,
    getValue: (s) => s.parentPhone || '-',
    getRawValue: (s) => s.parentPhone || '-',
  },
  {
    id: 'studentPhone',
    label: 'Student Mobile',
    header: 'Student Mobile',
    defaultSelected: false,
    halign: 'left',
    minWidth: 21,
    getValue: (s) => s.studentPhone || '-',
    getRawValue: (s) => s.studentPhone || '-',
  },
  {
    id: 'admissionDate',
    label: 'Admission Date',
    header: 'Adm. Date',
    defaultSelected: false,
    halign: 'center',
    minWidth: 17,
    getValue: (s) => (s.admissionDate ? formatDate(s.admissionDate) : '-'),
    getRawValue: (s) => (s.admissionDate ? formatDate(s.admissionDate) : '-'),
  },
  {
    id: 'totalFees',
    label: 'Session Total Fees',
    header: 'Total Fees (Rs.)',
    defaultSelected: true,
    halign: 'right',
    minWidth: 18,
    getValue: (s) => formatAmount(s.totalFees),
    getRawValue: (s) => Math.round(s.totalFees || 0),
    getTotal: (students) => formatAmount(students.reduce((sum, s) => sum + (s.totalFees || 0), 0)),
    getRawTotal: (students) => Math.round(students.reduce((sum, s) => sum + (s.totalFees || 0), 0)),
  },
  {
    id: 'paidFees',
    label: 'Session Paid Fees',
    header: 'Paid Fees (Rs.)',
    defaultSelected: true,
    halign: 'right',
    minWidth: 16,
    getValue: (s) => formatAmount(s.paidFees),
    getRawValue: (s) => Math.round(s.paidFees || 0),
    getTotal: (students) => formatAmount(students.reduce((sum, s) => sum + (s.paidFees || 0), 0)),
    getRawTotal: (students) => Math.round(students.reduce((sum, s) => sum + (s.paidFees || 0), 0)),
  },
  {
    id: 'pendingFees',
    label: 'Session Pending Fees',
    header: 'Pending (Rs.)',
    defaultSelected: true,
    halign: 'right',
    minWidth: 18,
    getValue: (s) => formatAmount(s.pendingFees),
    getRawValue: (s) => Math.round(s.pendingFees || 0),
    getTotal: (students) => formatAmount(students.reduce((sum, s) => sum + (s.pendingFees || 0), 0)),
    getRawTotal: (students) => Math.round(students.reduce((sum, s) => sum + (s.pendingFees || 0), 0)),
  },
  {
    id: 'previousDuesPending',
    label: 'Prior Session Dues',
    header: 'Prior Dues (Rs.)',
    defaultSelected: false,
    halign: 'right',
    minWidth: 18,
    getValue: (s) => formatAmount(s.previousDuesPending),
    getRawValue: (s) => Math.round(s.previousDuesPending || 0),
    getTotal: (students) => formatAmount(students.reduce((sum, s) => sum + (s.previousDuesPending || 0), 0)),
    getRawTotal: (students) => Math.round(students.reduce((sum, s) => sum + (s.previousDuesPending || 0), 0)),
  },
  {
    id: 'overallPendingAmount',
    label: 'Overall Outstanding Dues',
    header: 'Overall Due (Rs.)',
    defaultSelected: true,
    halign: 'right',
    minWidth: 20,
    getValue: (s) =>
      formatAmount(s.overallPendingAmount !== undefined ? s.overallPendingAmount : s.pendingFees),
    getRawValue: (s) =>
      Math.round(s.overallPendingAmount !== undefined ? s.overallPendingAmount : s.pendingFees || 0),
    getTotal: (students) =>
      formatAmount(
        students.reduce(
          (sum, s) => sum + (s.overallPendingAmount !== undefined ? s.overallPendingAmount : s.pendingFees || 0),
          0
        )
      ),
    getRawTotal: (students) =>
      Math.round(
        students.reduce(
          (sum, s) => sum + (s.overallPendingAmount !== undefined ? s.overallPendingAmount : s.pendingFees || 0),
          0
        )
      ),
  },
  {
    id: 'status',
    label: 'Fee Status',
    header: 'Fee Status',
    defaultSelected: true,
    halign: 'center',
    minWidth: 16,
    getValue: (s) =>
      !s.isActive
        ? 'Archived'
        : s.pendingFees === 0
        ? 'Settled'
        : s.paidFees > 0
        ? 'Partial'
        : 'Unpaid',
    getRawValue: (s) =>
      !s.isActive
        ? 'Archived'
        : s.pendingFees === 0
        ? 'Settled'
        : s.paidFees > 0
        ? 'Partial'
        : 'Unpaid',
  },
]

export interface ExportOptions {
  branchName?: string
  sessionName?: string
  instituteName?: string
  selectedColumnIds?: string[]
  logoUrl?: string | null
  tagline?: string | null
  address?: string | null
  phone?: string | null
  email?: string | null
  dateRangeLabel?: string
}

export interface ExecutivePdfHeaderConfig {
  logoBase64?: string | null
  instituteTitle: string
  reportTitle: string
  reportSubtitle?: string
  scopeText: string
  generatedDate: string
  recordCountText?: string
  accentColor?: [number, number, number] // default [40, 55, 92] (#28375C)
}

/**
 * Loads an image from a URL or relative path and returns base64 data for jsPDF
 */
export async function loadImageAsBase64(url: string | null | undefined): Promise<string | null> {
  if (!url) return null
  if (url.startsWith('data:image')) return url
  return new Promise((resolve) => {
    try {
      const img = new Image()
      img.crossOrigin = 'Anonymous'
      const timer = setTimeout(() => {
        resolve(null)
      }, 2500)

      img.onload = () => {
        clearTimeout(timer)
        try {
          const canvas = document.createElement('canvas')
          canvas.width = img.naturalWidth || img.width || 120
          canvas.height = img.naturalHeight || img.height || 120
          const ctx = canvas.getContext('2d')
          if (!ctx) {
            resolve(null)
            return
          }
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
          resolve(canvas.toDataURL('image/png'))
        } catch (err) {
          console.warn('Canvas toDataURL failed for logo:', err)
          resolve(null)
        }
      }

      img.onerror = () => {
        clearTimeout(timer)
        resolve(null)
      }

      img.src = url
    } catch {
      resolve(null)
    }
  })
}

/**
 * Renders an executive fallback vector crest badge directly using jsPDF vectors
 */
export function drawFallbackLogoBadge(
  doc: jsPDF,
  x: number,
  y: number,
  size: number = 17,
  accentColor: [number, number, number] = [40, 55, 92]
) {
  // Rounded shield box in navy
  doc.setFillColor(accentColor[0], accentColor[1], accentColor[2])
  doc.roundedRect(x, y, size, size, 2.5, 2.5, 'F')

  // Gold accent inner rim
  doc.setDrawColor(217, 119, 6) // Amber/Gold #d97706
  doc.setLineWidth(0.4)
  doc.roundedRect(x + 0.8, y + 0.8, size - 1.6, size - 1.6, 2, 2, 'S')

  // Monogram letters "SC" in pure white
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'bold')
  doc.text('SC', x + size / 2, y + size * 0.62, { align: 'center' })
}

/**
 * Draws an executive, institutional header with logo, prominent title, metadata badge, and accent line
 */
export function drawExecutivePdfHeader(doc: jsPDF, config: ExecutivePdfHeaderConfig) {
  const accent = config.accentColor || [40, 55, 92] // #28375C

  // 1. Logo container / Emblem
  const logoX = 8
  const logoY = 5.5
  const logoSize = 17

  if (config.logoBase64) {
    try {
      doc.setFillColor(255, 255, 255)
      doc.roundedRect(logoX, logoY, logoSize, logoSize, 2, 2, 'F')
      doc.setDrawColor(226, 232, 240)
      doc.setLineWidth(0.3)
      doc.roundedRect(logoX, logoY, logoSize, logoSize, 2, 2, 'S')
      doc.addImage(config.logoBase64, 'PNG', logoX + 1, logoY + 1, logoSize - 2, logoSize - 2, undefined, 'FAST')
    } catch {
      drawFallbackLogoBadge(doc, logoX, logoY, logoSize, accent)
    }
  } else {
    drawFallbackLogoBadge(doc, logoX, logoY, logoSize, accent)
  }

  // 2. Institute Name & Report Title Block (Beside Logo)
  const textX = logoX + logoSize + 4 // 29mm

  // Line 1: Institution Name in Executive Navy #28375C
  doc.setFontSize(13.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(accent[0], accent[1], accent[2])
  doc.text(config.instituteTitle.toUpperCase(), textX, logoY + 4.5)

  // Line 2: Report Title (Proper Prominent Badge/Title)
  doc.setFontSize(10.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(15, 23, 42) // Slate-900
  doc.text(config.reportTitle.toUpperCase(), textX, logoY + 10)

  // Line 3: Subtitle / Tagline
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 116, 139) // Slate-500
  doc.text(config.reportSubtitle || 'Excellence in Coaching & Board Exam Preparations', textX, logoY + 14.5)

  // 3. Metadata Info Box on the Right (Width: 86mm, from x=203 to 289)
  const metaX = 203
  const metaY = 5.5
  const metaW = 86
  const metaH = 17

  doc.setFillColor(248, 250, 252)
  doc.roundedRect(metaX, metaY, metaW, metaH, 1.5, 1.5, 'F')
  doc.setDrawColor(226, 232, 240)
  doc.setLineWidth(0.3)
  doc.roundedRect(metaX, metaY, metaW, metaH, 1.5, 1.5, 'S')

  // Metadata Row 1: Scope
  doc.setFontSize(7.0)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(100, 116, 139)
  doc.text('SCOPE:', metaX + 3.5, metaY + 4.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(accent[0], accent[1], accent[2])
  doc.text(config.scopeText, metaX + 18, metaY + 4.5)

  // Metadata Row 2: Generated Date
  doc.setFontSize(7.0)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(100, 116, 139)
  doc.text('DATE:', metaX + 3.5, metaY + 9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(30, 41, 59)
  doc.text(config.generatedDate, metaX + 18, metaY + 9)

  // Metadata Row 3: Records Count
  if (config.recordCountText) {
    doc.setFontSize(7.0)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(100, 116, 139)
    doc.text('RECORDS:', metaX + 3.5, metaY + 13.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(220, 38, 38) // Alert red accent
    doc.text(config.recordCountText, metaX + 18, metaY + 13.5)
  }

  // 4. Executive Divider Ribbon
  const lineY = logoY + logoSize + 2 // 24.5mm
  doc.setDrawColor(accent[0], accent[1], accent[2]) // #28375C
  doc.setLineWidth(0.8)
  doc.line(8, lineY, 289, lineY)

  // Gold accent segment on left
  doc.setDrawColor(217, 119, 6) // Gold #d97706
  doc.setLineWidth(0.8)
  doc.line(8, lineY, 48, lineY)
}

/**
 * Export students master register to Excel (.xlsx) with styled columns and summary totals
 */
export function exportStudentsToExcel(students: StudentExportItem[], options: ExportOptions = {}) {
  const sessionLabel = options.sessionName || 'All Sessions'
  const branchLabel = options.branchName || 'All Branches'
  const dateStr = getTodayDateString()

  // Filter columns if customized
  const activeCols = options.selectedColumnIds && options.selectedColumnIds.length > 0
    ? PDF_EXPORT_COLUMNS.filter((c) => options.selectedColumnIds!.includes(c.id))
    : PDF_EXPORT_COLUMNS

  // Prepare data rows with pure raw values for Excel
  const dataRows = students.map((s, index) => {
    const row: Record<string, any> = {}
    for (const col of activeCols) {
      row[col.label] = col.getRawValue ? col.getRawValue(s, index) : col.getValue(s, index)
    }
    return row
  })

  // Append summary row
  const summaryRow: Record<string, any> = {}
  for (const col of activeCols) {
    if (col.getRawTotal) {
      summaryRow[col.label] = col.getRawTotal(students)
    } else if (col.getTotal) {
      summaryRow[col.label] = col.getTotal(students)
    } else {
      summaryRow[col.label] = ''
    }
  }

  const worksheet = XLSX.utils.json_to_sheet([...dataRows, summaryRow])

  // Column width formatting
  worksheet['!cols'] = activeCols.map((c) => ({ wch: Math.max(12, Math.round(c.minWidth * 0.95)) }))

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Students Register')

  const fileName = `Sutawane_Classes_Students_${branchLabel.replace(/\s+/g, '_')}_${sessionLabel.replace(/\s+/g, '_')}_${dateStr}.xlsx`
  XLSX.writeFile(workbook, fileName)
}

/**
 * Export students master register to PDF in responsive Landscape A4 layout with user-selected columns
 */
export async function exportStudentsToPDF(students: StudentExportItem[], options: ExportOptions = {}) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  })

  const instituteTitle = (options.instituteName || 'SUTAWANE CLASSES').toUpperCase()
  const sessionLabel = options.sessionName || 'All Sessions'
  const branchLabel = options.branchName || 'All Branches Consolidated'
  const todayFormatted = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  // Determine active columns (user selection or defaults)
  let activeCols = PDF_EXPORT_COLUMNS.filter((c) => c.defaultSelected)
  if (options.selectedColumnIds && options.selectedColumnIds.length > 0) {
    const selected = PDF_EXPORT_COLUMNS.filter((c) => options.selectedColumnIds!.includes(c.id))
    if (selected.length > 0) {
      activeCols = selected
    }
  }

  const numCols = activeCols.length

  // Calculate totals
  const totalFeesSum = students.reduce((sum, s) => sum + (s.totalFees || 0), 0)
  const totalPaidSum = students.reduce((sum, s) => sum + (s.paidFees || 0), 0)
  const totalPendingSum = students.reduce((sum, s) => sum + (s.pendingFees || 0), 0)
  const totalOverallPendingSum = students.reduce(
    (sum, s) => sum + (s.overallPendingAmount !== undefined ? s.overallPendingAmount : s.pendingFees || 0),
    0
  )

  // Resolve logo base64
  let logoBase64: string | null = null
  if (options.logoUrl) {
    logoBase64 = await loadImageAsBase64(options.logoUrl)
  }

  // 1. Top Header Banner Background (Full Width 297mm in #28375C)
  doc.setFillColor(40, 55, 92) // #28375C
  doc.rect(0, 0, 297, 24, 'F')

  // Logo in Banner
  const logoX = 8
  const logoY = 3.5
  const logoSize = 17

  if (logoBase64) {
    try {
      doc.setFillColor(255, 255, 255)
      doc.roundedRect(logoX, logoY, logoSize, logoSize, 2, 2, 'F')
      doc.setDrawColor(226, 232, 240)
      doc.setLineWidth(0.3)
      doc.roundedRect(logoX, logoY, logoSize, logoSize, 2, 2, 'S')
      doc.addImage(logoBase64, 'PNG', logoX + 1, logoY + 1, logoSize - 2, logoSize - 2, undefined, 'FAST')
    } catch {
      drawFallbackLogoBadge(doc, logoX, logoY, logoSize, [27, 38, 64])
    }
  } else {
    drawFallbackLogoBadge(doc, logoX, logoY, logoSize, [27, 38, 64])
  }

  const textX = logoX + logoSize + 4

  // Institute Title
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text(instituteTitle.toUpperCase(), textX, 10)

  // Document Subtitle
  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(203, 213, 225)
  doc.text('STUDENT MASTER REGISTER & FINANCIAL LEDGER', textX, 16.5)

  // Report Metadata on Right
  doc.setFontSize(8)
  doc.setTextColor(241, 245, 249)
  doc.text(`Branch: ${branchLabel}`, 289, 9, { align: 'right' })
  doc.setTextColor(203, 213, 225)
  doc.text(`Session: ${sessionLabel} | Date: ${todayFormatted}`, 289, 14, { align: 'right' })
  doc.text(`Total Records: ${students.length} Students`, 289, 19, { align: 'right' })

  // 2. Summary Metrics Bar (Card Style across 281mm: from x=8 to x=289)
  const barX = 8
  const barY = 27
  const barWidth = 281
  const barHeight = 14
  const cardWidth = barWidth / 4 // ~70.25mm each

  doc.setFillColor(248, 250, 252)
  doc.rect(barX, barY, barWidth, barHeight, 'F')
  doc.setDrawColor(226, 232, 240)
  doc.rect(barX, barY, barWidth, barHeight, 'S')

  // Vertical card separators
  for (let i = 1; i < 4; i++) {
    doc.setDrawColor(226, 232, 240)
    doc.line(barX + i * cardWidth, barY + 2, barX + i * cardWidth, barY + barHeight - 2)
  }

  // Card 1: Committed
  doc.setFontSize(6.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(100, 116, 139)
  doc.text('TOTAL COMMITTED', barX + 4, barY + 5)
  doc.setFontSize(9)
  doc.setTextColor(30, 41, 59)
  doc.text(`Rs. ${totalFeesSum.toLocaleString('en-IN')}`, barX + 4, barY + 11)

  // Card 2: Collected
  doc.setFontSize(6.5)
  doc.setTextColor(100, 116, 139)
  doc.text('TOTAL COLLECTED', barX + cardWidth + 4, barY + 5)
  doc.setFontSize(9)
  doc.setTextColor(16, 128, 67) // Emerald Green
  doc.text(`Rs. ${totalPaidSum.toLocaleString('en-IN')}`, barX + cardWidth + 4, barY + 11)

  // Card 3: Pending
  doc.setFontSize(6.5)
  doc.setTextColor(100, 116, 139)
  doc.text('CURRENT SESSION PENDING', barX + 2 * cardWidth + 4, barY + 5)
  doc.setFontSize(9)
  doc.setTextColor(220, 38, 38) // Crimson Red
  doc.text(`Rs. ${totalPendingSum.toLocaleString('en-IN')}`, barX + 2 * cardWidth + 4, barY + 11)

  // Card 4: Overall Outstanding
  doc.setFontSize(6.5)
  doc.setTextColor(100, 116, 139)
  doc.text('OVERALL OUTSTANDING DUES', barX + 3 * cardWidth + 4, barY + 5)
  doc.setFontSize(9)
  doc.setTextColor(180, 83, 9) // Amber
  doc.text(`Rs. ${totalOverallPendingSum.toLocaleString('en-IN')}`, barX + 3 * cardWidth + 4, barY + 11)

  // 3. Build Table Headers with matched halign and Body Rows
  const headRow = activeCols.map((c) => ({
    content: c.header,
    styles: {
      halign: c.halign || 'left',
    },
  }))
  const bodyRows = students.map((s, idx) => activeCols.map((c) => c.getValue(s, idx)))

  // Totals Row
  let hasLabel = false
  const totalsRow = activeCols.map((c) => {
    if (c.getTotal) {
      return c.getTotal(students)
    }
    if (!hasLabel && c.id !== 'srNo') {
      hasLabel = true
      return `TOTALS (${students.length})`
    }
    return ''
  })

  // Responsive typography based on number of columns selected
  let fontSize = 8.2
  let cellPadding = 1.8
  let headerFontSize = 8.0

  if (numCols > 13) {
    fontSize = 6.2
    cellPadding = 1.1
    headerFontSize = 6.5
  } else if (numCols > 10) {
    fontSize = 6.8
    cellPadding = 1.4
    headerFontSize = 7.0
  } else if (numCols > 7) {
    fontSize = 7.4
    cellPadding = 1.6
    headerFontSize = 7.6
  }

  // Column styles mapping with smart constraints
  const columnStylesConfig: Record<number, any> = {}
  activeCols.forEach((col, idx) => {
    columnStylesConfig[idx] = {
      halign: col.halign || 'left',
      minCellWidth: col.minWidth,
    }

    if (col.id === 'srNo') {
      columnStylesConfig[idx].cellWidth = 7
      columnStylesConfig[idx].halign = 'center'
    } else if (col.id === 'fullName') {
      columnStylesConfig[idx].fontStyle = 'bold'
    } else if (col.id === 'paidFees') {
      columnStylesConfig[idx].textColor = [16, 128, 67]
      columnStylesConfig[idx].fontStyle = 'bold'
    } else if (col.id === 'pendingFees') {
      columnStylesConfig[idx].textColor = [220, 38, 38]
      columnStylesConfig[idx].fontStyle = 'bold'
    } else if (col.id === 'overallPendingAmount') {
      columnStylesConfig[idx].fontStyle = 'bold'
      columnStylesConfig[idx].textColor = [220, 38, 38]
    }
  })

  autoTable(doc, {
    startY: 44,
    head: [headRow as any],
    body: [...bodyRows, totalsRow],
    theme: 'grid',
    styles: {
      fontSize,
      cellPadding,
      textColor: [30, 41, 59],
      valign: 'middle',
      lineColor: [226, 232, 240],
      lineWidth: 0.15,
    },
    headStyles: {
      fillColor: [40, 55, 92], // #28375C
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: headerFontSize,
      valign: 'middle',
    },
    alternateRowStyles: {
      fillColor: [250, 252, 255],
    },
    columnStyles: columnStylesConfig,
    didParseCell: (data) => {
      const colDef = activeCols[data.column.index]

      // Highlight totals row at the bottom
      if (data.row.index === bodyRows.length) {
        data.cell.styles.fontStyle = 'bold'
        data.cell.styles.fillColor = [241, 245, 249]
        if (colDef) {
          if (colDef.id === 'paidFees') {
            data.cell.styles.textColor = [16, 128, 67]
          } else if (colDef.id === 'pendingFees' || colDef.id === 'overallPendingAmount') {
            data.cell.styles.textColor = [220, 38, 38]
          } else if (colDef.id === 'totalFees') {
            data.cell.styles.textColor = [30, 41, 59]
          } else {
            data.cell.styles.textColor = [15, 23, 42]
          }
        }
        return
      }

      // Meaningful colors in body rows
      if (data.section === 'body' && colDef) {
        if (colDef.id === 'paidFees') {
          const val = Number(String(data.cell.raw || '').replace(/[^0-9.-]+/g, ''))
          if (val > 0) {
            data.cell.styles.textColor = [16, 128, 67]
            data.cell.styles.fontStyle = 'bold'
          } else {
            data.cell.styles.textColor = [148, 163, 184]
          }
        } else if (colDef.id === 'pendingFees' || colDef.id === 'overallPendingAmount') {
          const val = Number(String(data.cell.raw || '').replace(/[^0-9.-]+/g, ''))
          if (val > 0) {
            data.cell.styles.textColor = [220, 38, 38]
            data.cell.styles.fontStyle = 'bold'
          } else {
            data.cell.styles.textColor = [16, 128, 67]
            data.cell.styles.fontStyle = 'bold'
          }
        }
      }
    },
    didDrawPage: (data) => {
      // Running header on page 2 and beyond
      if (data.pageNumber > 1) {
        doc.setFillColor(40, 55, 92) // #28375C
        doc.rect(0, 0, 297, 12, 'F')
        doc.setFontSize(8)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(255, 255, 255)
        doc.text(`${instituteTitle.toUpperCase()} — STUDENT REGISTER (CONT.)`, 8, 8)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7.5)
        doc.setTextColor(203, 213, 225)
        doc.text(`Branch: ${branchLabel} | Session: ${sessionLabel}`, 289, 8, { align: 'right' })
      }
    },
    margin: { left: 8, right: 8, top: 16, bottom: 12 },
  })

  // Footers with Page Numbers on all pages
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setDrawColor(226, 232, 240)
    doc.line(8, 202, 289, 202)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(148, 163, 184)
    doc.text(
      'Confidential — Generated by Sutawane Classes Management System',
      8,
      206
    )
    doc.text(
      `Page ${i} of ${totalPages}`,
      289,
      206,
      { align: 'right' }
    )
  }

  const dateStr = getTodayDateString()
  const fileName = `Sutawane_Classes_Students_${sessionLabel.replace(/\s+/g, '_')}_${dateStr}.pdf`
  doc.save(fileName)
}

export interface PaymentExportItem {
  id: string
  receiptNumber: string
  paymentDate: string
  totalAmount: number
  paymentMode: string
  referenceNumber?: string | null
  notes?: string | null
  isReversed: boolean
  reversalReason?: string | null
  student?: {
    id?: string
    fullName?: string
    studentCode?: string
    parentPhone?: string
    studentPhone?: string | null
  } | null
  admission?: {
    rollNumber?: string
    standard?: string
  } | null
  branch?: {
    name?: string
    code?: string
  } | null
  session?: {
    name?: string
  } | null
}

/**
 * Export payment transactions register to Excel (.xlsx)
 */
export function exportPaymentsToExcel(
  payments: PaymentExportItem[],
  options: {
    branchName?: string
    sessionName?: string
  } = {}
) {
  const branchLabel = options.branchName || 'All Branches'
  const sessionLabel = options.sessionName || 'All Sessions'
  const dateStr = getTodayDateString()

  let totalConfirmed = 0
  let totalReversed = 0

  const dataRows = payments.map((p, idx) => {
    if (!p.isReversed) {
      totalConfirmed += Number(p.totalAmount || 0)
    } else {
      totalReversed += Number(p.totalAmount || 0)
    }

    return {
      '#': idx + 1,
      'Receipt No': p.receiptNumber,
      'Date': formatDate(p.paymentDate),
      'Student Name': p.student?.fullName || '—',
      'Student Code': p.student?.studentCode || '—',
      'Roll Number': p.admission?.rollNumber || '—',
      'Class / Standard': p.admission?.standard || '—',
      'Branch': p.branch?.name || '—',
      'Session': p.session?.name || '—',
      'Mode': p.paymentMode,
      'Ref / Notes': p.referenceNumber || p.notes || '—',
      'Amount (₹)': Number(p.totalAmount || 0),
      'Status': p.isReversed ? 'Reversed / Void' : 'Confirmed',
      'Reversal Reason': p.reversalReason || '—',
    }
  })

  // Summary row at the bottom
  const summaryRow = {
    '#': '',
    'Receipt No': '',
    'Date': '',
    'Student Name': `TOTALS (${payments.length} transactions)`,
    'Student Code': '',
    'Roll Number': '',
    'Class / Standard': '',
    'Branch': '',
    'Session': '',
    'Mode': '',
    'Ref / Notes': `Confirmed: ₹${totalConfirmed.toLocaleString('en-IN')}`,
    'Amount (₹)': totalConfirmed,
    'Status': totalReversed > 0 ? `Reversed: ₹${totalReversed.toLocaleString('en-IN')}` : '',
    'Reversal Reason': '',
  }

  const worksheet = XLSX.utils.json_to_sheet([...dataRows, summaryRow])
  worksheet['!cols'] = [
    { wch: 6 },
    { wch: 26 },
    { wch: 14 },
    { wch: 26 },
    { wch: 18 },
    { wch: 14 },
    { wch: 16 },
    { wch: 22 },
    { wch: 12 },
    { wch: 12 },
    { wch: 24 },
    { wch: 16 },
    { wch: 16 },
    { wch: 24 },
  ]

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Fee Collections Register')

  const fileName = `Fee_Collections_${branchLabel.replace(/\s+/g, '_')}_${sessionLabel.replace(/\s+/g, '_')}_${dateStr}.xlsx`
  XLSX.writeFile(workbook, fileName)
}

/**
 * Export payment transactions register to PDF in Landscape A4 layout
 */
export async function exportPaymentsToPDF(
  payments: PaymentExportItem[],
  options: ExportOptions = {}
) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  })

  const instituteTitle = (options.instituteName || 'SUTAWANE CLASSES').toUpperCase()
  const branchLabel = options.branchName || 'All Branches Consolidated'
  const sessionLabel = options.sessionName || 'All Sessions'
  const todayFormatted = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  let totalConfirmed = 0
  let totalReversed = 0

  const bodyRows = payments.map((p, idx) => {
    if (!p.isReversed) {
      totalConfirmed += Number(p.totalAmount || 0)
    } else {
      totalReversed += Number(p.totalAmount || 0)
    }

    return [
      idx + 1,
      p.receiptNumber,
      formatDate(p.paymentDate),
      p.student?.fullName || '—',
      p.admission?.rollNumber || '—',
      p.admission?.standard || '—',
      p.branch?.name || '—',
      p.paymentMode,
      p.referenceNumber || p.notes || '—',
      formatAmount(p.totalAmount),
      p.isReversed ? 'Void' : 'Confirmed',
    ]
  })

  // Summary row
  const summaryRow = [
    '',
    '',
    '',
    `TOTALS (${payments.length})`,
    '',
    '',
    '',
    '',
    `Net Collections:`,
    formatAmount(totalConfirmed),
    '',
  ]

  // Resolve logo base64
  let logoBase64: string | null = null
  if (options.logoUrl) {
    logoBase64 = await loadImageAsBase64(options.logoUrl)
  }

  // Draw Executive Report Header
  drawExecutivePdfHeader(doc, {
    logoBase64,
    instituteTitle,
    reportTitle: 'OFFICIAL FEE COLLECTIONS & TRANSACTIONS REGISTER',
    reportSubtitle: options.tagline || 'Audit Trail of Realized Fee Receipts & Payment Modes',
    scopeText: `${branchLabel} • ${sessionLabel}`,
    generatedDate: todayFormatted,
    recordCountText: `${payments.length} Collection Entries`,
    accentColor: [40, 55, 92], // #28375C
  })

  autoTable(doc, {
    startY: 27,
    head: [[
      '#',
      'Receipt No.',
      'Date',
      'Student Name',
      'Roll No.',
      'Class',
      'Branch',
      'Mode',
      'Ref / Notes',
      'Amount (INR)',
      'Status',
    ]],
    body: [...bodyRows, summaryRow],
    theme: 'grid',
    headStyles: {
      fillColor: [40, 55, 92], // #28375C
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
      halign: 'left',
    },
    alternateRowStyles: {
      fillColor: [250, 252, 255],
    },
    styles: {
      fontSize: 7.5,
      cellPadding: 2,
      overflow: 'linebreak',
      lineColor: [226, 232, 240],
      lineWidth: 0.15,
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8 },
      1: { cellWidth: 32 },
      2: { cellWidth: 20, halign: 'center' },
      3: { cellWidth: 44, fontStyle: 'bold' },
      4: { cellWidth: 20, halign: 'center' },
      5: { cellWidth: 20 },
      6: { cellWidth: 32 },
      7: { cellWidth: 18, halign: 'center' },
      8: { cellWidth: 34 },
      9: { cellWidth: 28, halign: 'right', fontStyle: 'bold' },
      10: { cellWidth: 22, halign: 'center' },
    },
    didParseCell: (data) => {
      if (data.row.index === bodyRows.length) {
        data.cell.styles.fontStyle = 'bold'
        data.cell.styles.fillColor = [241, 245, 249]
        if (data.column.index === 9) {
          data.cell.styles.textColor = [16, 128, 67] // Emerald green
        } else {
          data.cell.styles.textColor = [15, 23, 42]
        }
        return
      }

      if (data.section === 'body') {
        const p = payments[data.row.index]
        if (data.column.index === 9) {
          if (p?.isReversed) {
            data.cell.styles.textColor = [220, 38, 38] // Void red
          } else {
            data.cell.styles.textColor = [16, 128, 67] // Emerald green
          }
          data.cell.styles.fontStyle = 'bold'
        } else if (data.column.index === 10) {
          if (p?.isReversed) {
            data.cell.styles.textColor = [220, 38, 38]
          } else {
            data.cell.styles.textColor = [16, 128, 67]
          }
          data.cell.styles.fontStyle = 'bold'
        }
      }
    },
    margin: { left: 8, right: 8, top: 14, bottom: 12 },
  })

  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setDrawColor(226, 232, 240)
    doc.setLineWidth(0.4)
    doc.line(8, 202, 289, 202)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(148, 163, 184)
    doc.text('Confidential — Generated by Sutawane Classes Management System', 8, 206)
    doc.text(`Page ${i} of ${totalPages}`, 289, 206, { align: 'right' })
  }

  const dateStr = getTodayDateString()
  const fileName = `Fee_Collections_${branchLabel.replace(/\s+/g, '_')}_${dateStr}.pdf`
  doc.save(fileName)
}

export interface DueExportItem {
  id: string
  installmentNo?: number
  label?: string
  dueDate: string
  amountDue: number
  amountPaid: number
  balanceRemaining: number
  status: string
  student: {
    id: string
    admissionId?: string
    fullName: string
    studentCode?: string
    rollNumber: string
    standard: string
    parentPhone?: string
    branchName?: string
    sessionName?: string
  }
}

/**
 * Export student fee dues register to Excel (.xlsx)
 */
export function exportDuesToExcel(
  dues: DueExportItem[],
  options: {
    branchName?: string
    sessionName?: string
  } = {}
) {
  const branchLabel = options.branchName || 'All Branches'
  const sessionLabel = options.sessionName || 'All Sessions'
  const dateStr = getTodayDateString()

  let totalFee = 0
  let totalPaid = 0
  let totalBalance = 0

  const dataRows = dues.map((d, idx) => {
    totalFee += Number(d.amountDue || 0)
    totalPaid += Number(d.amountPaid || 0)
    totalBalance += Number(d.balanceRemaining || 0)

    return {
      '#': idx + 1,
      'Student Name': d.student?.fullName || '—',
      'Roll Number': d.student?.rollNumber || '—',
      'Student Code': d.student?.studentCode || '—',
      'Class / Standard': d.student?.standard || '—',
      'Branch': d.student?.branchName || branchLabel,
      'Session': d.student?.sessionName || sessionLabel,
      'Due Date': formatDate(d.dueDate),
      'Parent Phone': d.student?.parentPhone || '—',
      'Session Fee (₹)': Number(d.amountDue || 0),
      'Amount Paid (₹)': Number(d.amountPaid || 0),
      'Remaining Balance (₹)': Number(d.balanceRemaining || 0),
      'Status': d.status || 'PENDING',
    }
  })

  // Summary row
  const summaryRow = {
    '#': '',
    'Student Name': `TOTALS (${dues.length} accounts)`,
    'Roll Number': '',
    'Student Code': '',
    'Class / Standard': '',
    'Branch': '',
    'Session': '',
    'Due Date': '',
    'Parent Phone': '',
    'Session Fee (₹)': totalFee,
    'Amount Paid (₹)': totalPaid,
    'Remaining Balance (₹)': totalBalance,
    'Status': '',
  }

  const worksheet = XLSX.utils.json_to_sheet([...dataRows, summaryRow])
  worksheet['!cols'] = [
    { wch: 6 },
    { wch: 25 },
    { wch: 16 },
    { wch: 16 },
    { wch: 16 },
    { wch: 20 },
    { wch: 16 },
    { wch: 14 },
    { wch: 15 },
    { wch: 16 },
    { wch: 16 },
    { wch: 20 },
    { wch: 14 },
  ]

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Student Dues Register')

  const fileName = `Fee_Dues_${branchLabel.replace(/\s+/g, '_')}_${sessionLabel.replace(/\s+/g, '_')}_${dateStr}.xlsx`
  XLSX.writeFile(workbook, fileName)
}

/**
 * Export student fee dues register to PDF in Landscape A4 layout
 */
export async function exportDuesToPDF(
  dues: DueExportItem[],
  options: ExportOptions = {}
) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  })

  const instituteTitle = (options.instituteName || 'SUTAWANE CLASSES').toUpperCase()
  const branchLabel = options.branchName || 'All Branches'
  const sessionLabel = options.sessionName || 'All Sessions'
  const todayFormatted = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  let totalFee = 0
  let totalPaid = 0
  let totalBalance = 0

  const bodyRows = dues.map((d, idx) => {
    totalFee += Number(d.amountDue || 0)
    totalPaid += Number(d.amountPaid || 0)
    totalBalance += Number(d.balanceRemaining || 0)

    return [
      idx + 1,
      d.student?.fullName || '—',
      d.student?.rollNumber || '—',
      d.student?.standard || '—',
      d.student?.branchName || branchLabel,
      d.student?.parentPhone || '—',
      formatDate(d.dueDate),
      formatAmount(d.amountDue),
      formatAmount(d.amountPaid),
      formatAmount(d.balanceRemaining),
      d.status || 'PENDING',
    ]
  })

  const summaryRow = [
    '',
    `TOTALS (${dues.length} accounts)`,
    '',
    '',
    '',
    '',
    '',
    formatAmount(totalFee),
    formatAmount(totalPaid),
    formatAmount(totalBalance),
    '',
  ]

  // Resolve logo base64
  let logoBase64: string | null = null
  if (options.logoUrl) {
    logoBase64 = await loadImageAsBase64(options.logoUrl)
  }

  // Draw Executive Report Header with Logo, Prominent Title, Metadata Card, and Accent Ribbon
  drawExecutivePdfHeader(doc, {
    logoBase64,
    instituteTitle,
    reportTitle: 'STUDENT FEE DUES & OUTSTANDING BALANCES REPORT',
    reportSubtitle: options.tagline || 'Official Fee Accounts Receivable & Recovery Register',
    scopeText: `${branchLabel} • ${sessionLabel}`,
    generatedDate: todayFormatted,
    recordCountText: `${dues.length} Students Pending`,
    accentColor: [40, 55, 92], // #28375C
  })

  autoTable(doc, {
    startY: 27,
    head: [[
      '#',
      'Student Name',
      'Roll No.',
      'Class',
      'Branch',
      'Phone',
      'Due Date',
      'Session Fee',
      'Amount Paid',
      'Balance Due (INR)',
      'Status',
    ]],
    body: [...bodyRows, summaryRow],
    theme: 'grid',
    headStyles: {
      fillColor: [40, 55, 92], // #28375C
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
      halign: 'left',
    },
    alternateRowStyles: {
      fillColor: [250, 252, 255],
    },
    styles: {
      fontSize: 7.5,
      cellPadding: 2,
      overflow: 'linebreak',
      lineColor: [226, 232, 240],
      lineWidth: 0.15,
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8 },
      1: { cellWidth: 44, fontStyle: 'bold' },
      2: { cellWidth: 22, halign: 'center' },
      3: { cellWidth: 20 },
      4: { cellWidth: 32 },
      5: { cellWidth: 24, halign: 'center' },
      6: { cellWidth: 22, halign: 'center' },
      7: { cellWidth: 24, halign: 'right' },
      8: { cellWidth: 24, halign: 'right' },
      9: { cellWidth: 30, halign: 'right', fontStyle: 'bold' },
      10: { cellWidth: 23, halign: 'center' },
    },
    didParseCell: (data) => {
      // Summary / Totals row
      if (data.row.index === bodyRows.length) {
        data.cell.styles.fontStyle = 'bold'
        data.cell.styles.fillColor = [241, 245, 249]
        if (data.column.index === 7) {
          data.cell.styles.textColor = [30, 41, 59] // Slate-800
        } else if (data.column.index === 8) {
          data.cell.styles.textColor = [16, 128, 67] // Emerald Green
        } else if (data.column.index === 9) {
          data.cell.styles.textColor = [220, 38, 38] // Crimson Red
        } else {
          data.cell.styles.textColor = [15, 23, 42]
        }
        return
      }

      // Body rows - Column specific meaningful colors
      if (data.section === 'body') {
        const d = dues[data.row.index]
        if (!d) return

        // 7: Session Fee (Neutral dark slate)
        if (data.column.index === 7) {
          data.cell.styles.textColor = [30, 41, 59]
        }
        // 8: Amount Paid (Emerald green if paid, muted slate if zero)
        else if (data.column.index === 8) {
          const paid = Number(d.amountPaid || 0)
          if (paid > 0) {
            data.cell.styles.textColor = [16, 128, 67] // #108043 Emerald
            data.cell.styles.fontStyle = 'bold'
          } else {
            data.cell.styles.textColor = [148, 163, 184] // Muted slate-400
          }
        }
        // 9: Balance Due (Crimson Red if due, Emerald if cleared)
        else if (data.column.index === 9) {
          const balance = Number(d.balanceRemaining || 0)
          if (balance > 0) {
            data.cell.styles.textColor = [220, 38, 38] // #dc2626 Crimson Red
            data.cell.styles.fontStyle = 'bold'
          } else {
            data.cell.styles.textColor = [16, 128, 67] // Cleared Emerald
            data.cell.styles.fontStyle = 'bold'
          }
        }
        // 10: Status (Color badge)
        else if (data.column.index === 10) {
          const statusStr = String(data.cell.raw || d.status || '').toUpperCase()
          if (statusStr.includes('OVERDUE')) {
            data.cell.styles.textColor = [220, 38, 38] // Rose Red
            data.cell.styles.fontStyle = 'bold'
          } else if (statusStr.includes('PARTIAL')) {
            data.cell.styles.textColor = [217, 119, 6] // Amber / Orange
            data.cell.styles.fontStyle = 'bold'
          } else if (statusStr.includes('PAID') || statusStr.includes('CLEARED')) {
            data.cell.styles.textColor = [22, 163, 74] // Green
            data.cell.styles.fontStyle = 'bold'
          } else {
            data.cell.styles.textColor = [100, 116, 139] // Slate
            data.cell.styles.fontStyle = 'bold'
          }
        }
      }
    },
    margin: { left: 8, right: 8, top: 14, bottom: 12 },
  })

  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setDrawColor(226, 232, 240)
    doc.setLineWidth(0.4)
    doc.line(8, 202, 289, 202)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(148, 163, 184)
    doc.text('Confidential — Generated by Sutawane Classes Management System', 8, 206)
    doc.text(`Page ${i} of ${totalPages}`, 289, 206, { align: 'right' })
  }

  const dateStr = getTodayDateString()
  const fileName = `Fee_Dues_${branchLabel.replace(/\s+/g, '_')}_${dateStr}.pdf`
  doc.save(fileName)
}

export interface ExpenseExportItem {
  id: string
  expenseDate: string
  amount: number
  description: string
  paymentMode: string
  vendor?: string | null
  referenceNumber?: string | null
  categoryId?: string
  branchId?: string
  category?: {
    id: string
    name: string
  }
  branch?: {
    id: string
    name: string
    code?: string
  }
  attachments?: Array<{
    id: string
    fileName: string
    filePath: string
    mimeType?: string
  }>
}

/**
 * Export expense vouchers list to Excel (.xlsx)
 */
export function exportExpensesToExcel(
  expenses: ExpenseExportItem[],
  options: {
    branchName?: string
    dateRangeLabel?: string
  } = {}
) {
  const branchLabel = options.branchName || 'All Branches'
  const dateStr = getTodayDateString()

  let totalAmount = 0

  const dataRows = expenses.map((exp, idx) => {
    totalAmount += Number(exp.amount || 0)
    return {
      '#': idx + 1,
      'Date': formatDate(exp.expenseDate),
      'Category': exp.category?.name || 'General',
      'Description': exp.description,
      'Branch Location': exp.branch?.name || branchLabel,
      'Vendor / Payee': exp.vendor || '—',
      'Payment Mode': exp.paymentMode,
      'Reference / Bill No': exp.referenceNumber || '—',
      'Amount (₹)': Number(exp.amount || 0),
    }
  })

  const summaryRow = {
    '#': '',
    'Date': `TOTALS (${expenses.length} vouchers)`,
    'Category': '',
    'Description': '',
    'Branch Location': '',
    'Vendor / Payee': '',
    'Payment Mode': '',
    'Reference / Bill No': '',
    'Amount (₹)': totalAmount,
  }

  const worksheet = XLSX.utils.json_to_sheet([...dataRows, summaryRow])
  worksheet['!cols'] = [
    { wch: 6 },
    { wch: 14 },
    { wch: 18 },
    { wch: 32 },
    { wch: 22 },
    { wch: 22 },
    { wch: 16 },
    { wch: 22 },
    { wch: 18 },
  ]

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Expense Vouchers')

  const fileName = `Expense_Vouchers_${branchLabel.replace(/\s+/g, '_')}_${dateStr}.xlsx`
  XLSX.writeFile(workbook, fileName)
}

/**
 * Export expense vouchers to PDF in Landscape A4 layout
 */
export async function exportExpensesToPDF(
  expenses: ExpenseExportItem[],
  options: ExportOptions = {}
) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  })

  const instituteTitle = (options.instituteName || 'SUTAWANE CLASSES').toUpperCase()
  const branchLabel = options.branchName || 'All Branches'
  const todayFormatted = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  let totalAmount = 0
  const bodyRows = expenses.map((exp, idx) => {
    totalAmount += Number(exp.amount || 0)
    return [
      idx + 1,
      formatDate(exp.expenseDate),
      exp.category?.name || 'General',
      exp.description || '—',
      exp.branch?.name || branchLabel,
      exp.vendor || '—',
      exp.paymentMode || '—',
      exp.referenceNumber || '—',
      formatAmount(exp.amount),
    ]
  })

  const summaryRow = [
    '',
    `TOTAL (${expenses.length} vouchers)`,
    '',
    '',
    '',
    '',
    '',
    '',
    formatAmount(totalAmount),
  ]

  // Resolve logo base64
  let logoBase64: string | null = null
  if (options.logoUrl) {
    logoBase64 = await loadImageAsBase64(options.logoUrl)
  }

  // Draw Executive Report Header
  drawExecutivePdfHeader(doc, {
    logoBase64,
    instituteTitle,
    reportTitle: 'BRANCH EXPENSE & OVERHEADS VOUCHERS LEDGER',
    reportSubtitle: options.tagline || 'Official Operating Expenditure & Audit Register',
    scopeText: `${branchLabel} ${options.dateRangeLabel ? `• ${options.dateRangeLabel}` : ''}`,
    generatedDate: todayFormatted,
    recordCountText: `${expenses.length} Expense Vouchers`,
    accentColor: [40, 55, 92], // #28375C
  })

  autoTable(doc, {
    startY: 27,
    head: [[
      '#',
      'Date',
      'Category',
      'Description',
      'Branch',
      'Vendor / Payee',
      'Mode',
      'Ref / Bill No',
      'Amount (INR)',
    ]],
    body: [...bodyRows, summaryRow],
    theme: 'grid',
    headStyles: {
      fillColor: [40, 55, 92], // #28375C
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
      halign: 'left',
    },
    alternateRowStyles: {
      fillColor: [250, 252, 255],
    },
    styles: {
      fontSize: 8,
      cellPadding: 2.2,
      overflow: 'linebreak',
      lineColor: [226, 232, 240],
      lineWidth: 0.15,
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8 },
      1: { cellWidth: 20, halign: 'center' },
      2: { cellWidth: 26 },
      3: { cellWidth: 70, fontStyle: 'bold' },
      4: { cellWidth: 32 },
      5: { cellWidth: 36 },
      6: { cellWidth: 22, halign: 'center' },
      7: { cellWidth: 34 },
      8: { cellWidth: 31, halign: 'right', fontStyle: 'bold' },
    },
    didParseCell: (data) => {
      if (data.row.index === bodyRows.length) {
        data.cell.styles.fontStyle = 'bold'
        data.cell.styles.fillColor = [241, 245, 249]
        if (data.column.index === 8) {
          data.cell.styles.textColor = [225, 29, 72] // Rose red for expense
        } else {
          data.cell.styles.textColor = [15, 23, 42]
        }
        return
      }

      if (data.section === 'body') {
        if (data.column.index === 8) {
          data.cell.styles.textColor = [225, 29, 72] // Rose red for expense amount
          data.cell.styles.fontStyle = 'bold'
        }
      }
    },
    margin: { left: 8, right: 8, top: 14, bottom: 12 },
  })

  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setDrawColor(226, 232, 240)
    doc.setLineWidth(0.4)
    doc.line(8, 202, 289, 202)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(148, 163, 184)
    doc.text('Confidential — Generated by Sutawane Classes Management System', 8, 206)
    doc.text(`Page ${i} of ${totalPages}`, 289, 206, { align: 'right' })
  }

  const dateStr = getTodayDateString()
  const fileName = `Expense_Vouchers_${branchLabel.replace(/\s+/g, '_')}_${dateStr}.pdf`
  doc.save(fileName)
}
