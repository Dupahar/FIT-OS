import { formatPaise } from '@/lib/utils'

interface CurrencyDisplayProps {
  paise: number
  showGst?: boolean
  gstRate?: string
  className?: string
}

export function CurrencyDisplay({ paise, showGst, gstRate, className }: CurrencyDisplayProps) {
  const formatted = formatPaise(paise)
  const gstAmount = gstRate ? (paise * parseFloat(gstRate)) / 100 : 0

  return (
    <span className={className}>
      <span className="font-syne font-bold">{formatted}</span>
      {showGst && gstRate && (
        <span className="text-xs text-gray-400 ml-1">
          +{formatPaise(gstAmount)} GST
        </span>
      )}
    </span>
  )
}
