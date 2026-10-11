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
 * Format a date string or Date object to Indian locale DD/MM/YYYY
 */
export function formatDate(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d)
}

/**
 * Format a date to a more readable form like "11 Oct 2026"
 */
export function formatDateLong(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date
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
