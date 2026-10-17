import { UserIcon } from 'lucide-react'
import type { User } from '@/contracts/domain'
import { cn } from '@/lib/utils'

export function UserAvatar({ user, className }: { user: Pick<User, 'name' | 'avatarUrl'>; className?: string }) {
  if (user.avatarUrl) {
    return <img src={user.avatarUrl} alt="" className={cn('rounded-full object-cover', className)} width={28} height={28} />
  }
  return (
    <span aria-hidden className={cn('grid place-items-center rounded-full bg-band text-accent-strong', className)}>
      <UserIcon className="size-1/2" />
    </span>
  )
}
