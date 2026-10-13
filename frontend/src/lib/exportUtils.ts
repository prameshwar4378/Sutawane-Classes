import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import { formatCurrency, formatDate } from './utils'

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

export interface ExportOptions {
  branchName?: string
  sessionName?: string
  instituteName?: string
}

/**
 * Export students master register to Excel (.xlsx) with styled columns and summary totals
 */
export function exportStudentsToExcel(students: StudentExportItem[], options: ExportOptions = {}) {
  const sessionLabel = options.sessionName || 'All Sessions'
  const branchLabel = options.branchName || 'All Branches'
  const dateStr = new Date().toISOString().split('T')[0]

  // Prepare data rows
  const dataRows = students.map((s, index) => {
    const feeStatus =
      !s.isActive
        ? 'Archived'
        : s.pendingFees === 0
        ? 'Fully Settled'
        : s.paidFees > 0
        ? 'Partial'
        : 'Unpaid'

    return {
      'Sr. No': index + 1,
      'Roll No.': s.rollNumber,
      'Student Code': s.studentCode || '',
      'Student Name': s.fullName,
      'Class / Standard': s.standard,
      'Branch': s.branchName,
      'Academic Session': s.sessionName,
      'Parent Mobile': s.parentPhone,
      'Student Mobile': s.studentPhone || '',
      'Session Total Fees (INR)': s.totalFees,
      'Session Paid Fees (INR)': s.paidFees,
      'Session Pending Fees (INR)': s.pendingFees,
      'Prior Dues (INR)': s.previousDuesPending || 0,
      'Overall Pending Amount (INR)': s.overallPendingAmount !== undefined ? s.overallPendingAmount : s.pendingFees,
      'Fee Status': feeStatus,
      'Active Status': s.isActive ? 'Active' : 'Archived',
      'Admission Date': formatDate(s.admissionDate),
    }
  })

  // Calculate totals
  const totalFeesSum = students.reduce((sum, s) => sum + (s.totalFees || 0), 0)
  const totalPaidSum = students.reduce((sum, s) => sum + (s.paidFees || 0), 0)
  const totalPendingSum = students.reduce((sum, s) => sum + (s.pendingFees || 0), 0)
  const totalPriorDuesSum = students.reduce((sum, s) => sum + (s.previousDuesPending || 0), 0)
  const totalOverallPendingSum = students.reduce(
    (sum, s) => sum + (s.overallPendingAmount !== undefined ? s.overallPendingAmount : s.pendingFees),
    0
  )

  // Append summary row
  const summaryRow = {
    'Sr. No': '' as any,
    'Roll No.': '',
    'Student Code': '',
    'Student Name': `TOTALS (${students.length} Students)`,
    'Class / Standard': '',
    'Branch': '',
    'Academic Session': '',
    'Parent Mobile': '',
    'Student Mobile': '',
    'Session Total Fees (INR)': totalFeesSum,
    'Session Paid Fees (INR)': totalPaidSum,
    'Session Pending Fees (INR)': totalPendingSum,
    'Prior Dues (INR)': totalPriorDuesSum,
    'Overall Pending Amount (INR)': totalOverallPendingSum,
    'Fee Status': '',
    'Active Status': '',
    'Admission Date': '',
  }

  const worksheet = XLSX.utils.json_to_sheet([...dataRows, summaryRow])

  // Column width formatting
  worksheet['!cols'] = [
    { wch: 7 },  // Sr
    { wch: 14 }, // Roll
    { wch: 14 }, // Code
    { wch: 24 }, // Name
    { wch: 18 }, // Standard
    { wch: 20 }, // Branch
    { wch: 14 }, // Session
    { wch: 14 }, // Parent Phone
    { wch: 14 }, // Student Phone
    { wch: 18 }, // Total Fees
    { wch: 18 }, // Paid Fees
    { wch: 18 }, // Pending Fees
    { wch: 16 }, // Prior Dues
    { wch: 22 }, // Overall Pending
    { wch: 14 }, // Fee Status
    { wch: 12 }, // Active
    { wch: 14 }, // Date
  ]

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Students Register')

  const fileName = `Sutawane_Classes_Students_${branchLabel.replace(/\s+/g, '_')}_${sessionLabel.replace(/\s+/g, '_')}_${dateStr}.xlsx`
  XLSX.writeFile(workbook, fileName)
}

/**
 * Export students master register to PDF in Landscape A4 layout
 */
export function exportStudentsToPDF(students: StudentExportItem[], options: ExportOptions = {}) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  })

  const instituteTitle = options.instituteName || 'SUTAWANE CLASSES'
  const sessionLabel = options.sessionName || 'All Sessions'
  const branchLabel = options.branchName || 'All Branches Consolidated'
  const todayFormatted = new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  // Calculate totals
  const totalFeesSum = students.reduce((sum, s) => sum + (s.totalFees || 0), 0)
  const totalPaidSum = students.reduce((sum, s) => sum + (s.paidFees || 0), 0)
  const totalPendingSum = students.reduce((sum, s) => sum + (s.pendingFees || 0), 0)
  const totalOverallPendingSum = students.reduce(
    (sum, s) => sum + (s.overallPendingAmount !== undefined ? s.overallPendingAmount : s.pendingFees),
    0
  )

  // Header banner background
  doc.setFillColor(30, 41, 59) // Slate-800
  doc.rect(0, 0, 297, 24, 'F')

  // Institute Title
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text(instituteTitle.toUpperCase(), 14, 11)

  // Document Subtitle
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(203, 213, 225)
  doc.text('STUDENT MASTER REGISTER & COMPREHENSIVE FEE LEDGER', 14, 18)

  // Report Metadata on Right
  doc.setFontSize(8)
  doc.text(`Branch: ${branchLabel}`, 283, 9, { align: 'right' })
  doc.text(`Session: ${sessionLabel} | Date: ${todayFormatted}`, 283, 14, { align: 'right' })
  doc.text(`Total Records: ${students.length} Students`, 283, 19, { align: 'right' })

  // Summary Metrics Bar
  doc.setFillColor(248, 250, 252)
  doc.rect(14, 27, 269, 13, 'F')
  doc.setDrawColor(226, 232, 240)
  doc.rect(14, 27, 269, 13, 'S')

  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(71, 85, 105)
  doc.text(`TOTAL COMMITTED: ${formatCurrency(totalFeesSum)}`, 20, 35)

  doc.setTextColor(16, 149, 115) // Green
  doc.text(`TOTAL COLLECTED: ${formatCurrency(totalPaidSum)}`, 85, 35)

  doc.setTextColor(225, 29, 72) // Rose
  doc.text(`SESSION PENDING: ${formatCurrency(totalPendingSum)}`, 155, 35)

  doc.setTextColor(180, 83, 9) // Amber
  doc.text(`OVERALL OUTSTANDING DUES: ${formatCurrency(totalOverallPendingSum)}`, 220, 35)

  // Table Body Rows
  const tableData = students.map((s, idx) => {
    const feeStatus =
      !s.isActive
        ? 'Archived'
        : s.pendingFees === 0
        ? 'Settled'
        : s.paidFees > 0
        ? 'Partial'
        : 'Unpaid'

    const overallDue = s.overallPendingAmount !== undefined ? s.overallPendingAmount : s.pendingFees

    return [
      idx + 1,
      s.rollNumber,
      s.fullName,
      s.standard,
      s.branchName,
      s.parentPhone,
      formatCurrency(s.totalFees),
      formatCurrency(s.paidFees),
      formatCurrency(s.pendingFees),
      formatCurrency(overallDue),
      feeStatus,
    ]
  })

  // Totals Row for PDF
  const totalsRow = [
    '',
    '',
    `TOTALS (${students.length})`,
    '',
    '',
    '',
    formatCurrency(totalFeesSum),
    formatCurrency(totalPaidSum),
    formatCurrency(totalPendingSum),
    formatCurrency(totalOverallPendingSum),
    '',
  ]

  autoTable(doc, {
    startY: 44,
    head: [
      [
        '#',
        'Roll No.',
        'Student Name',
        'Class',
        'Branch',
        'Parent Phone',
        'Total Fees',
        'Paid Fees',
        'Pending Fees',
        'Overall Due',
        'Status',
      ],
    ],
    body: [...tableData, totalsRow],
    theme: 'grid',
    styles: {
      fontSize: 7.5,
      cellPadding: 2,
      textColor: [30, 41, 59],
    },
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'left',
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 20 },
      2: { cellWidth: 38, fontStyle: 'bold' },
      3: { cellWidth: 24 },
      4: { cellWidth: 26 },
      5: { cellWidth: 22 },
      6: { cellWidth: 22, halign: 'right' },
      7: { cellWidth: 22, halign: 'right', textColor: [16, 149, 115] },
      8: { cellWidth: 24, halign: 'right', textColor: [225, 29, 72] },
      9: { cellWidth: 26, halign: 'right', fontStyle: 'bold', textColor: [180, 83, 9] },
      10: { cellWidth: 16, halign: 'center' },
    },
    didParseCell: (data) => {
      // Highlight totals row at the bottom
      if (data.row.index === tableData.length) {
        data.cell.styles.fontStyle = 'bold'
        data.cell.styles.fillColor = [241, 245, 249]
        data.cell.styles.textColor = [15, 23, 42]
      }
    },
    margin: { left: 14, right: 14 },
  })

  const dateStr = new Date().toISOString().split('T')[0]
  const fileName = `Sutawane_Classes_Students_${sessionLabel.replace(/\s+/g, '_')}_${dateStr}.pdf`
  doc.save(fileName)
}
