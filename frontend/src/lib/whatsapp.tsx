import React from 'react'
import { formatDateLong, formatCurrency } from './utils'

/**
 * Standardize phone numbers to international WhatsApp format.
 * Defaults to India (+91) if 10 digits provided.
 */
export function formatWhatsAppNumber(rawPhone: string): string {
  if (!rawPhone) return ''
  let digits = rawPhone.replace(/\D/g, '')

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
 * Open WhatsApp with pre-filled message
 */
export function openWhatsApp(phone: string, message: string): void {
  const formattedPhone = formatWhatsAppNumber(phone)
  if (!formattedPhone || formattedPhone.length < 10) {
    alert('Invalid or missing registered phone number.')
    return
  }

  const encodedMsg = encodeURIComponent(message)
  const url = `https://wa.me/${formattedPhone}?text=${encodedMsg}`
  window.open(url, '_blank', 'noopener,noreferrer')
}

/**
 * Template for Fee Payment Receipt WhatsApp Message
 */
export function buildReceiptWhatsAppMessage(params: {
  instituteName?: string
  studentName: string
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
  const institute = params.instituteName || 'Sutawane Classes'
  const helplineText = params.helpline ? `\n📞 Helpline: ${params.helpline}` : ''
  const refText = params.referenceNumber ? `\n• Txn / Ref No: *${params.referenceNumber}*` : ''
  const balanceText =
    params.remainingBalance !== undefined
      ? params.remainingBalance === 0
        ? '\n• Remaining Balance: *Nil (Fully Settled)*'
        : `\n• Remaining Dues: *₹${params.remainingBalance.toLocaleString('en-IN')}*`
      : ''

  return (
    `Dear Parent, greetings from *${institute}*!\n\n` +
    `We have successfully received a fee payment for *${params.studentName}*.\n\n` +
    `📄 *Fee Payment Receipt Summary:*\n` +
    `• Receipt No: *${params.receiptNumber}*\n` +
    `• Amount Paid: *₹${params.totalAmount.toLocaleString('en-IN')}*\n` +
    `• Payment Date: *${formatDateLong(params.paymentDate)}*\n` +
    `• Payment Mode: *${params.paymentMode}*${refText}\n` +
    `• Class / Course: *${params.standard || 'General'}*\n` +
    (params.rollNumber ? `• Roll No: *${params.rollNumber}*\n` : '') +
    (params.branchName ? `• Branch: *${params.branchName}*\n` : '') +
    balanceText +
    `\n\nThank you for your payment! Please retain this computer-generated confirmation for your records.\n` +
    `- *${institute}*` +
    helplineText
  )
}

/**
 * Template for New Admission Confirmation WhatsApp Message
 */
export function buildAdmissionWhatsAppMessage(params: {
  instituteName?: string
  studentName: string
  rollNumber: string
  standard: string
  sessionName?: string
  branchName?: string
  totalFees: number
  helpline?: string
}): string {
  const institute = params.instituteName || 'Sutawane Classes'
  const helplineText = params.helpline ? `\n📞 Helpline: ${params.helpline}` : ''

  return (
    `Dear Parent, greetings from *${institute}*! 🎉\n\n` +
    `We are delighted to confirm that the admission for *${params.studentName}* has been successfully registered!\n\n` +
    `📋 *Admission Details:*\n` +
    `• Roll Number: *${params.rollNumber}*\n` +
    `• Class / Course: *${params.standard}*\n` +
    (params.sessionName ? `• Academic Session: *${params.sessionName}*\n` : '') +
    (params.branchName ? `• Center / Branch: *${params.branchName}*\n` : '') +
    `• Annual Session Fee: *₹${params.totalFees.toLocaleString('en-IN')}*\n\n` +
    `We extend a warm welcome to ${params.studentName} and look forward to an academic year of dedication and excellence!\n\n` +
    `- *${institute}*` +
    helplineText
  )
}

/**
 * Template for Fee Reminder WhatsApp Message
 */
export function buildFeeReminderWhatsAppMessage(params: {
  instituteName?: string
  studentName: string
  rollNumber?: string
  standard?: string
  pendingAmount: number
  overallPendingAmount?: number
  branchName?: string
  helpline?: string
}): string {
  const institute = params.instituteName || 'Sutawane Classes'
  const helplineText = params.helpline ? `\n📞 Helpline: ${params.helpline}` : ''

  return (
    `Dear Parent, greetings from *${institute}*.\n\n` +
    `This is a gentle fee reminder regarding *${params.studentName}* ` +
    `(Roll No: *${params.rollNumber || '—'}*, Course: *${params.standard || '—'}*).\n\n` +
    `💰 *Outstanding Fee Details:*\n` +
    `• Current Session Pending: *₹${params.pendingAmount.toLocaleString('en-IN')}*\n` +
    (params.overallPendingAmount && params.overallPendingAmount !== params.pendingAmount
      ? `• Overall Total Dues: *₹${params.overallPendingAmount.toLocaleString('en-IN')}*\n`
      : '') +
    `\nKindly clear the outstanding dues at the center office or via UPI at your earliest convenience.\n\n` +
    `Thank you for your cooperation!\n` +
    `- *${institute}*` +
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
