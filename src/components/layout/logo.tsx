import { Link } from '@tanstack/react-router'
import { cn } from '@/lib/utils'

export function Logo({ className }: { className?: string }) {
  return (
    <Link to="/" className={cn('text-sm font-bold tracking-[0.12em] text-cream', className)} aria-label="Kurio — página inicial">
      KURIO
    </Link>
  )
}
