import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format a number as Indian Rupee currency
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)
}

/**
 * Returns today's local date in YYYY-MM-DD format (ideal for HTML5 <input type="date">)
 * Avoids the UTC-lag bug where `new Date().toISOString().split('T')[0]` returns yesterday's date
 * in timezones ahead of UTC (e.g., IST UTC+05:30 early morning).
 */
export function getTodayDateString(date: Date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Converts any date or ISO string to local YYYY-MM-DD format for date inputs.
 * If null/undefined/empty, returns today's local date.
 */
export function toInputDateString(date?: string | Date | null): string {
  if (!date) return getTodayDateString()
  if (typeof date === 'string') {
    const trimmed = date.trim()
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed
    if (/^\d{4}-\d{2}-\d{2}T/.test(trimmed)) {
      const datePart = trimmed.split('T')[0]
      if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return datePart
    }
    const d = new Date(trimmed)
    if (!isNaN(d.getTime())) {
      return getTodayDateString(d)
    }
    return getTodayDateString()
  }
  if (date instanceof Date && !isNaN(date.getTime())) {
    return getTodayDateString(date)
  }
  return getTodayDateString()
}

/**
 * Format a date string or Date object to Indian locale DD/MM/YYYY.
 * Returns "—" if date is null, undefined, or empty.
 */
export function formatDate(date?: string | Date | null): string {
  if (!date) return '—'
  if (typeof date === "string") {
    const trimmed = date.trim()
    if (!trimmed) return '—'
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const [year, month, day] = trimmed.split('-')
      return `${day}/${month}/${year}`
    }
    const d = new Date(trimmed)
    if (isNaN(d.getTime())) return trimmed
    return new Intl.DateTimeFormat("en-IN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(d)
  }
  if (isNaN(new Date(date).getTime())) return '—'
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date)
}

/**
 * Format a date to a more readable form like "11 Oct 2026".
 * Returns "—" if date is null, undefined, or empty.
 */
export function formatDateLong(date?: string | Date | null): string {
  if (!date) return '—'
  if (typeof date === "string") {
    const trimmed = date.trim()
    if (!trimmed) return '—'
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const [year, month, day] = trimmed.split('-')
      const d = new Date(Number(year), Number(month) - 1, Number(day))
      return new Intl.DateTimeFormat("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(d)
    }
  }
  const d = typeof date === "string" ? new Date(date) : date
  if (!d || isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d)
}

/**
 * Convert number to Indian Rupee Words for official receipts
 */
export function numberToWordsINR(amount: number): string {
  if (amount === 0) return 'Rupees Zero Only'

  const a = [
    '',
    'One',
    'Two',
    'Three',
    'Four',
    'Five',
    'Six',
    'Seven',
    'Eight',
    'Nine',
    'Ten',
    'Eleven',
    'Twelve',
    'Thirteen',
    'Fourteen',
    'Fifteen',
    'Sixteen',
    'Seventeen',
    'Eighteen',
    'Nineteen',
  ]
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

  const num = Math.floor(amount)
  if (num.toString().length > 9) return `Rupees ${amount} Only`

  function inWords(n: number): string {
    let str = ''
    if (n >= 10000000) {
      str += `${inWords(Math.floor(n / 10000000))} Crore `
      n %= 10000000
    }
    if (n >= 100000) {
      str += `${inWords(Math.floor(n / 100000))} Lakh `
      n %= 100000
    }
    if (n >= 1000) {
      str += `${inWords(Math.floor(n / 1000))} Thousand `
      n %= 1000
    }
    if (n >= 100) {
      str += `${inWords(Math.floor(n / 100))} Hundred `
      n %= 100
    }
    if (n > 0) {
      if (str !== '') str += 'and '
      if (n < 20) {
        str += a[n]
      } else {
        str += b[Math.floor(n / 10)]
        if (n % 10) str += ` ${a[n % 10]}`
      }
    }
    return str.trim()
  }

  const words = inWords(num)
  return `Rupees ${words} Only`
}
