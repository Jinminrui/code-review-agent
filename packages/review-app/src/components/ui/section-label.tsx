import { cn } from '@/lib/utils'
import { type LucideIcon } from 'lucide-react'
import { Icon } from './icon'

interface SectionLabelProps {
  icon?: LucideIcon
  command: string
  count?: number
  className?: string
}

export function SectionLabel({ icon, command, count, className }: SectionLabelProps) {
  return (
    <div className={cn('section-label', className)}>
      <span className="prompt">$</span>
      {icon && <Icon icon={icon} size="xs" />}
      <span className="command">{command}</span>
      {count !== undefined && (
        <span className="count-badge">{count}</span>
      )}
    </div>
  )
}
