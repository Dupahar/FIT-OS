import { cn } from '@/lib/utils'

interface StatusBadgeProps {
  status: string
  className?: string
}

const statusConfig: Record<string, { label: string; classes: string; pulse?: boolean }> = {
  active:    { label: 'Active',    classes: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  frozen:    { label: 'Frozen',    classes: 'bg-blue-50 text-blue-700 border-blue-200' },
  expiring:  { label: 'Expiring',  classes: 'bg-amber-50 text-amber-700 border-amber-200' },
  cancelled: { label: 'Cancelled', classes: 'bg-red-50 text-red-700 border-red-200' },
  inactive:  { label: 'Inactive',  classes: 'bg-gray-50 text-gray-600 border-gray-200' },
  pending:   { label: 'Pending',   classes: 'bg-gray-50 text-gray-600 border-gray-200' },
  paid:      { label: 'Paid',      classes: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  void:      { label: 'Void',      classes: 'bg-gray-50 text-gray-500 border-gray-200' },
  online:    { label: 'Online',    classes: 'bg-emerald-50 text-emerald-700 border-emerald-200', pulse: true },
  offline:   { label: 'Offline',   classes: 'bg-gray-50 text-gray-500 border-gray-200' },
  error:     { label: 'Error',     classes: 'bg-red-50 text-red-700 border-red-200' },
  failed:    { label: 'Failed',    classes: 'bg-red-50 text-red-700 border-red-200' },
  delivered: { label: 'Delivered', classes: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  processing:{ label: 'Processing',classes: 'bg-blue-50 text-blue-600 border-blue-200' },
  refunded:  { label: 'Refunded',  classes: 'bg-amber-50 text-amber-700 border-amber-200' },
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status || ''] || {
    label: status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Unknown',
    classes: 'bg-gray-50 text-gray-600 border-gray-200',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border',
        config.classes,
        className,
      )}
    >
      {config.pulse && (
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
        </span>
      )}
      {config.label}
    </span>
  )
}
