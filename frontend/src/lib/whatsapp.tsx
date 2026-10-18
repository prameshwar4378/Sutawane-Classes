import React from 'react'
import { formatDateLong } from './utils'

/**
 * Standardize phone numbers to international WhatsApp format.
 * Defaults to India (+91) if 10 or 11 digits provided.
 */
export function formatWhatsAppNumber(rawPhone: string): string {
  if (!rawPhone) return ''
  const digits = rawPhone.replace(/\D/g, '')

  // 10 digits e.g. 9876543210 -> 919876543210
  if (digits.length === 10) {
    return `91${digits}`
  }

  // 11 digits starting with 0 e.g. 09876543210 -> 919876543210
  if (digits.length === 11 && digits.startsWith('0')) {
    return `91${digits.slice(1)}`
  }

  // 12 digits starting with 91 e.g. 919876543210
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits
  }

  return digits
}

/**
 * Open WhatsApp with pre-filled message.
 * Fully compatible with Electron Desktop App (via shell.openExternal) and Web Browsers.
 */
export function openWhatsApp(phone: string, message: string): void {
  const formattedPhone = formatWhatsAppNumber(phone)
  if (!formattedPhone || formattedPhone.length < 10) {
    alert('Invalid or missing registered parent phone number.')
    return
  }

  const encodedMsg = encodeURIComponent(message)
  const url = `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodedMsg}`

  // Check if running inside Electron desktop shell
  const electronAPI = (window as any).electronAPI
  if (electronAPI && typeof electronAPI.openExternal === 'function') {
    electronAPI.openExternal(url).catch((err: any) => {
      console.warn('[WhatsApp] electronAPI.openExternal error, falling back to window.open:', err)
      window.open(url, '_blank', 'noopener,noreferrer')
    })
    return
  }

  // Standard web browser fallback
  window.open(url, '_blank', 'noopener,noreferrer')
}

export interface FeeReminderParams {
  instituteName?: string
  studentName: string
  studentCode?: string
  rollNumber?: string
  standard?: string
  currentPendingAmount?: number
  pendingAmount?: number // Backward compatibility
  previousDuesPending?: number
  overallPendingAmount?: number
  nextDueDate?: string | null
  branchName?: string
  sessionName?: string
  helpline?: string
}

/**
 * Intelligent Fee Reminder & Clearance WhatsApp Message Template
 * Correctly distinguishes between:
 * 1. Both Current Session Pending AND Prior Year Dues Pending
 * 2. Current Session Pending ONLY (Prior Year Dues are Cleared)
 * 3. Prior Year Dues Pending ONLY (Current Session is Paid in Full)
 * 4. All Fees Completely Cleared (Zero Dues Appreciation Note)
 */
export function buildFeeReminderWhatsAppMessage(params: FeeReminderParams): string {
  const institute = (params.instituteName || 'Sutawane Classes').toUpperCase()
  const branchText = params.branchName ? `📍 *Branch:* ${params.branchName}\n` : ''
  const helplineText = params.helpline ? `📞 *Helpline / Accounts:* ${params.helpline}` : ''

  const currentDue = Number(
    params.currentPendingAmount !== undefined
      ? params.currentPendingAmount
      : params.pendingAmount !== undefined
      ? params.pendingAmount
      : 0
  )
  const priorDue = Number(params.previousDuesPending || 0)
  const totalDue =
    params.overallPendingAmount !== undefined
      ? Number(params.overallPendingAmount)
      : currentDue + priorDue

  const dueDateFormatted = params.nextDueDate
    ? formatDateLong(params.nextDueDate)
    : null

  // ----------------------------------------------------
  // CASE 1: 100% CLEARED / ZERO OUTSTANDING DUES
  // ----------------------------------------------------
  if (totalDue <= 0 && currentDue <= 0 && priorDue <= 0) {
    return (
      `🏛️ *${institute}*\n` +
      branchText +
      `────────────────────────\n` +
      `🎉 *FEE CLEARED — APPRECIATION NOTE*\n\n` +
      `Dear Parent, Greetings! 🙏\n\n` +
      `We are pleased to inform you that all academic fee commitments for *${params.studentName}* are **100% CLEARED (NIL)** across all academic sessions! ✅\n\n` +
      `📋 *Student Profile:*\n` +
      `• 🎓 *Student:* *${params.studentName}*\n` +
      (params.studentCode ? `• 🆔 *Student ID:* *${params.studentCode}*\n` : '') +
      (params.rollNumber ? `• 🏷️ *Roll No:* *${params.rollNumber}*\n` : '') +
      (params.standard ? `• 📚 *Class / Course:* *${params.standard}*\n` : '') +
      (params.sessionName ? `• 📅 *Session:* *${params.sessionName}*\n` : '') +
      `\n🌟 *Current Fee Status:*\n` +
      `• 📚 Current Session Fee: *Paid in Full ✅*\n` +
      `• ⏳ Prior Year Dues: *Nil (Cleared) ✅*\n` +
      `• 🧾 *Total Outstanding: ₹0 (Nil)*\n\n` +
      `Thank you sincerely for your timely payments and valued partnership in your child's education!\n\n` +
      `Warm Regards,\n` +
      `*${institute} Management*\n` +
      helplineText
    )
  }

  // ----------------------------------------------------
  // CASE 2: BOTH CURRENT SESSION & PRIOR YEAR DUES PENDING
  // ----------------------------------------------------
  if (currentDue > 0 && priorDue > 0) {
    return (
      `🏛️ *${institute}*\n` +
      branchText +
      `────────────────────────\n` +
      `📢 *OFFICIAL FEE PAYMENT REMINDER*\n\n` +
      `Dear Parent, Greetings! 🙏\n` +
      `This is a gentle reminder regarding the outstanding academic fee for:\n\n` +
      `🎓 *Student Name:* *${params.studentName}*\n` +
      (params.studentCode ? `🆔 *Student ID:* *${params.studentCode}*\n` : '') +
      (params.rollNumber ? `📋 *Roll Number:* *${params.rollNumber}*\n` : '') +
      (params.standard ? `📚 *Class / Course:* *${params.standard}*\n` : '') +
      (params.sessionName ? `📅 *Academic Session:* *${params.sessionName}*\n` : '') +
      `\n💰 *FEE BALANCE BREAKDOWN:*\n` +
      `• 📚 Current Session Pending: *₹${currentDue.toLocaleString('en-IN')}*\n` +
      `• ⏳ Prior Session Outstanding Dues: *₹${priorDue.toLocaleString('en-IN')}*\n` +
      `────────────────────────\n` +
      `🧾 *TOTAL NET OUTSTANDING: ₹${totalDue.toLocaleString('en-IN')}*\n` +
      (dueDateFormatted ? `📅 *Upcoming Due Date: ${dueDateFormatted}*\n` : '') +
      `────────────────────────\n\n` +
      `💳 *Payment Methods:*\n` +
      `1. Center Office (Cash / Cheque / Card)\n` +
      `2. Online UPI Payment (Contact center office for official QR code)\n\n` +
      `Kindly arrange to clear the outstanding balance at your earliest convenience. If payment has already been remitted, please disregard this automated notification.\n\n` +
      `Warm Regards,\n` +
      `*${institute} Accounts*\n` +
      helplineText
    )
  }

  // ----------------------------------------------------
  // CASE 3: CURRENT SESSION PENDING ONLY (PRIOR DUES NIL)
  // ----------------------------------------------------
  if (currentDue > 0 && priorDue <= 0) {
    return (
      `🏛️ *${institute}*\n` +
      branchText +
      `────────────────────────\n` +
      `📢 *OFFICIAL FEE PAYMENT REMINDER*\n\n` +
      `Dear Parent, Greetings! 🙏\n` +
      `This is a gentle reminder regarding the installment fee for:\n\n` +
      `🎓 *Student Name:* *${params.studentName}*\n` +
      (params.studentCode ? `🆔 *Student ID:* *${params.studentCode}*\n` : '') +
      (params.rollNumber ? `📋 *Roll Number:* *${params.rollNumber}*\n` : '') +
      (params.standard ? `📚 *Class / Course:* *${params.standard}*\n` : '') +
      (params.sessionName ? `📅 *Academic Session:* *${params.sessionName}*\n` : '') +
      `\n💰 *FEE BALANCE SUMMARY:*\n` +
      `• 📚 Current Session Pending: *₹${currentDue.toLocaleString('en-IN')}*\n` +
      `• ⏳ Prior Session Dues: *Nil (Fully Cleared) ✅*\n` +
      `────────────────────────\n` +
      `🧾 *NET DUE AMOUNT: ₹${currentDue.toLocaleString('en-IN')}*\n` +
      (dueDateFormatted ? `📅 *Due Date: ${dueDateFormatted}*\n` : '') +
      `────────────────────────\n\n` +
      `💳 *Payment Options:*\n` +
      `1. Center Office (Cash / Cheque / Card)\n` +
      `2. Online UPI Transfer (Contact center office for official QR code)\n\n` +
      `Kindly clear the due installment at your earliest convenience. Thank you for your continued cooperation!\n\n` +
      `Warm Regards,\n` +
      `*${institute} Accounts*\n` +
      helplineText
    )
  }

  // ----------------------------------------------------
  // CASE 4: PRIOR YEAR CARRIED DUES PENDING ONLY (CURRENT SESSION SETTLED)
  // ----------------------------------------------------
  return (
    `🏛️ *${institute}*\n` +
    branchText +
    `────────────────────────\n` +
    `📢 *OFFICIAL FEE PAYMENT REMINDER*\n\n` +
    `Dear Parent, Greetings! 🙏\n` +
    `This is a reminder regarding the carried-forward academic dues for:\n\n` +
    `🎓 *Student Name:* *${params.studentName}*\n` +
    (params.studentCode ? `🆔 *Student ID:* *${params.studentCode}*\n` : '') +
    (params.rollNumber ? `📋 *Roll Number:* *${params.rollNumber}*\n` : '') +
    (params.standard ? `📚 *Class / Course:* *${params.standard}*\n` : '') +
    `\n💰 *FEE BALANCE BREAKDOWN:*\n` +
    `• 📚 Current Session: *Paid in Full (Nil) ✅*\n` +
    `• ⏳ Prior Session Carried Dues: *₹${priorDue.toLocaleString('en-IN')}*\n` +
    `────────────────────────\n` +
    `🧾 *TOTAL OUTSTANDING TO CLEAR: ₹${priorDue.toLocaleString('en-IN')}*\n` +
    `────────────────────────\n\n` +
    `Kindly arrange to settle the carried-forward balance at the center office or via UPI at your earliest convenience.\n\n` +
    `Warm Regards,\n` +
    `*${institute} Accounts*\n` +
    helplineText
  )
}

/**
 * Template for Fee Payment Receipt WhatsApp Message
 */
export function buildReceiptWhatsAppMessage(params: {
  instituteName?: string
  studentName: string
  studentCode?: string
  rollNumber?: string
  standard?: string
  receiptNumber: string
  totalAmount: number
  paymentDate: string
  paymentMode: string
  referenceNumber?: string | null
  remainingBalance?: number
  branchName?: string
  helpline?: string
}): string {
  const institute = (params.instituteName || 'Sutawane Classes').toUpperCase()
  const branchText = params.branchName ? `📍 *Branch:* ${params.branchName}\n` : ''
  const helplineText = params.helpline ? `📞 *Helpline / Accounts:* ${params.helpline}` : ''
  const refText = params.referenceNumber ? `\n• 🏦 Txn / Ref No: *${params.referenceNumber}*` : ''

  const balanceText =
    params.remainingBalance !== undefined
      ? params.remainingBalance <= 0
        ? '\n• 📊 Remaining Dues: *Nil (Fully Settled) ✅*'
        : `\n• 📊 Remaining Dues: *₹${params.remainingBalance.toLocaleString('en-IN')}*`
      : ''

  return (
    `🏛️ *${institute}*\n` +
    branchText +
    `────────────────────────\n` +
    `🧾 *OFFICIAL FEE PAYMENT RECEIPT*\n\n` +
    `Dear Parent, Greetings! 🙏\n` +
    `We acknowledge with thanks the receipt of fee payment for:\n\n` +
    `🎓 *Student Name:* *${params.studentName}*\n` +
    (params.studentCode ? `🆔 *Student ID:* *${params.studentCode}*\n` : '') +
    (params.rollNumber ? `📋 *Roll Number:* *${params.rollNumber}*\n` : '') +
    `📚 *Class / Course:* *${params.standard || 'General'}*\n` +
    `\n💵 *PAYMENT SUMMARY:*\n` +
    `• 🧾 Receipt No: *${params.receiptNumber}*\n` +
    `• 💳 Amount Paid: *₹${params.totalAmount.toLocaleString('en-IN')}*\n` +
    `• 📅 Payment Date: *${formatDateLong(params.paymentDate)}*\n` +
    `• 💰 Payment Mode: *${params.paymentMode}*${refText}` +
    balanceText +
    `\n────────────────────────\n\n` +
    `🙏 Thank you for your payment! Please retain this computer-generated confirmation for your records.\n\n` +
    `Warm Regards,\n` +
    `*${institute} Management*\n` +
    helplineText
  )
}

/**
 * Template for New Admission Confirmation WhatsApp Message
 */
export function buildAdmissionWhatsAppMessage(params: {
  instituteName?: string
  studentName: string
  studentCode?: string
  rollNumber: string
  standard: string
  sessionName?: string
  branchName?: string
  totalFees: number
  helpline?: string
}): string {
  const institute = (params.instituteName || 'Sutawane Classes').toUpperCase()
  const branchText = params.branchName ? `📍 *Branch:* ${params.branchName}\n` : ''
  const helplineText = params.helpline ? `📞 *Helpline / Office:* ${params.helpline}` : ''

  return (
    `🏛️ *${institute}*\n` +
    branchText +
    `────────────────────────\n` +
    `🎉 *CONGRATULATIONS & WELCOME!* 🌟\n\n` +
    `Dear Parent, Greetings! 🙏\n` +
    `We are delighted to confirm that the admission for *${params.studentName}* has been officially registered!\n\n` +
    `📋 *ADMISSION DETAILS:*\n` +
    `• 🎓 *Student Name:* *${params.studentName}*\n` +
    (params.studentCode ? `• 🆔 *Student ID:* *${params.studentCode}*\n` : '') +
    `• 🏷️ *Roll Number:* *${params.rollNumber}*\n` +
    `• 📚 *Class / Course:* *${params.standard}*\n` +
    (params.sessionName ? `• 📅 *Academic Session:* *${params.sessionName}*\n` : '') +
    (params.branchName ? `• 🏢 *Center / Branch:* *${params.branchName}*\n` : '') +
    `• 💰 *Annual Session Fee:* *₹${params.totalFees.toLocaleString('en-IN')}*\n` +
    `────────────────────────\n\n` +
    `We extend a warm welcome to ${params.studentName} and look forward to an academic year of dedication and excellence! 🏆\n\n` +
    `Warm Regards,\n` +
    `*${institute} Administration*\n` +
    helplineText
  )
}

/**
 * Template for General Parent Notice / Greetings
 */
export function buildGeneralNoticeWhatsAppMessage(params: {
  instituteName?: string
  studentName: string
  rollNumber?: string
  standard?: string
  branchName?: string
  helpline?: string
}): string {
  const institute = (params.instituteName || 'Sutawane Classes').toUpperCase()
  const branchText = params.branchName ? `📍 *Branch:* ${params.branchName}\n` : ''
  const helplineText = params.helpline ? `📞 *Helpline:* ${params.helpline}` : ''

  return (
    `🏛️ *${institute}*\n` +
    branchText +
    `────────────────────────\n` +
    `Dear Parent, Greetings from *${institute}*! 🙏\n\n` +
    `Regarding student: *${params.studentName}* ` +
    (params.rollNumber ? `(Roll No: *${params.rollNumber}*, ` : '(') +
    `Course: *${params.standard || 'General'}*).\n\n` +
    `Please let us know if you require any academic updates, fee receipts, or attendance support.\n\n` +
    `Warm Regards,\n` +
    `*${institute} Office*\n` +
    helplineText
  )
}

/**
 * Iconic WhatsApp Brand SVG Icon Component
 */
export const WhatsAppIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg
    viewBox="0 0 24 24"
    width="24"
    height="24"
    stroke="currentColor"
    strokeWidth="0"
    fill="currentColor"
    className={className}
    style={{ fillRule: 'evenodd' }}
  >
    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
  </svg>
)
