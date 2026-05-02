import { getInitials, hashColor, cn } from '@/lib/utils'

interface MemberAvatarProps {
  firstName: string
  lastName: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeMap = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-14 h-14 text-lg',
}

export function MemberAvatar({ firstName, lastName, size = 'md', className }: MemberAvatarProps) {
  const initials = getInitials(firstName, lastName)
  const color = hashColor(`${firstName} ${lastName}`)

  return (
    <div
      className={cn(
        'rounded-full flex items-center justify-center font-semibold text-white shrink-0',
        sizeMap[size],
        className,
      )}
      style={{ backgroundColor: color }}
    >
      {initials}
    </div>
  )
}
