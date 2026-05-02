import { formatDate, relativeTime } from '@/lib/utils'

interface DateDisplayProps {
  iso: string | null | undefined
  relative?: boolean
  className?: string
}

export function DateDisplay({ iso, relative, className }: DateDisplayProps) {
  if (!iso) return <span className={className}>—</span>
  return (
    <span className={className} title={new Date(iso).toLocaleString('en-IN')}>
      {relative ? relativeTime(iso) : formatDate(iso)}
    </span>
  )
}
