import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format paise to INR display string (₹X,XX,XXX)
 */
export function formatPaise(paise: number | string): string {
  const rupees = Number(paise) / 100
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rupees)
}

/**
 * Format paise to INR without currency symbol
 */
export function formatPaiseRaw(paise: number | string): string {
  const rupees = Number(paise) / 100
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rupees)
}

/**
 * Format number in lakhs (₹X.XL)
 */
export function formatLakhs(paise: number | string): string {
  const lakhs = Number(paise) / 100 / 100000
  return `₹${lakhs.toFixed(2)}L`
}

/**
 * Format ISO date string to display format
 */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const date = new Date(iso)
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/**
 * Format ISO date to full display: "Thursday, 19 March 2026"
 */
export function formatFullDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

/**
 * Relative time display: "2 hours ago", "3 days ago"
 */
export function relativeTime(iso: string): string {
  const now = new Date()
  const date = new Date(iso)
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return formatDate(iso)
}

/**
 * Get initials from first and last name
 */
export function getInitials(firstName?: string | null, lastName?: string | null): string {
  const f = firstName?.charAt(0) || ''
  const l = lastName?.charAt(0) || ''
  return `${f}${l}`.toUpperCase() || '?'
}

/**
 * Generate a consistent color from a name hash
 */
const AVATAR_COLORS = [
  '#00B894', '#0984E3', '#6C5CE7', '#FD79A8',
  '#E17055', '#00CEC9', '#FDCB6E', '#A29BFE',
]

export function hashColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

/**
 * Get time-of-day greeting
 */
export function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

/**
 * Days between now and a date
 */
export function daysUntil(iso: string): number {
  const now = new Date()
  const target = new Date(iso)
  const diffMs = target.getTime() - now.getTime()
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24))
}

/**
 * Check if a date is within N days from now
 */
export function isWithinDays(iso: string, days: number): boolean {
  const d = daysUntil(iso)
  return d >= 0 && d <= days
}

/**
 * Calculate percentage elapsed between two dates
 */
export function dateProgressPercent(startIso: string, endIso: string): number {
  const start = new Date(startIso).getTime()
  const end = new Date(endIso).getTime()
  const now = Date.now()
  if (now >= end) return 100
  if (now <= start) return 0
  return Math.round(((now - start) / (end - start)) * 100)
}

/**
 * Get billing interval label
 */
export function intervalLabel(interval: string): string {
  switch (interval) {
    case 'monthly': return '1 month'
    case 'quarterly': return '3 months'
    case 'semiannual': return '6 months'
    case 'annual': return '12 months'
    case 'custom': return 'custom'
    default: return interval
  }
}
