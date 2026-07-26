/**
 * 模块职责：承载本模块的稳定业务逻辑，并对外提供边界清晰的类型或函数。
 * 边界约束：输入数据应在边界处校验；不要在本模块内绕过既定的分层和 IPC 约束。
 * 维护提示：修改时优先保持现有契约和错误语义，并同步更新相关测试。
 */
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
