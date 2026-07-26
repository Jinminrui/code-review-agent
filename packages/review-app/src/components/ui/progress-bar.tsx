/**
 * 模块职责：承载本模块的稳定业务逻辑，并对外提供边界清晰的类型或函数。
 * 边界约束：输入数据应在边界处校验；不要在本模块内绕过既定的分层和 IPC 约束。
 * 维护提示：修改时优先保持现有契约和错误语义，并同步更新相关测试。
 */
import { cn } from '@/lib/utils'

interface ProgressBarProps {
  value: number
  max?: number
  className?: string
}

export function ProgressBar({ value, max = 100, className }: ProgressBarProps) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100)

  return (
    <div
      className={cn(
        'h-1.5 bg-bg-overlay rounded-full overflow-hidden',
        className
      )}
    >
      <div
        className="h-full rounded-full transition-all duration-300 ease-out animate-glow"
        style={{
          width: `${percentage}%`,
          background: 'linear-gradient(90deg, var(--accent-cyan-muted), var(--accent-cyan))',
        }}
      />
    </div>
  )
}
