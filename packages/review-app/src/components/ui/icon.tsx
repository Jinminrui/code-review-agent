/**
 * 模块职责：承载本模块的稳定业务逻辑，并对外提供边界清晰的类型或函数。
 * 边界约束：输入数据应在边界处校验；不要在本模块内绕过既定的分层和 IPC 约束。
 * 维护提示：修改时优先保持现有契约和错误语义，并同步更新相关测试。
 */
import { type LucideIcon, type LucideProps } from 'lucide-react'
import { cn } from '@/lib/utils'

interface IconProps extends LucideProps {
  icon: LucideIcon
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  variant?: 'default' | 'muted' | 'accent' | 'success' | 'warning' | 'danger'
  spin?: boolean
  pulse?: boolean
}

const sizeClasses = {
  xs: 'w-3.5 h-3.5',
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
  xl: 'w-8 h-8',
}

const variantClasses = {
  default: 'text-text-secondary',
  muted: 'text-text-tertiary',
  accent: 'text-accent-cyan',
  success: 'text-accent-green',
  warning: 'text-accent-amber',
  danger: 'text-accent-red',
}

export function Icon({
  icon: IconComponent,
  size = 'md',
  variant = 'default',
  spin = false,
  pulse = false,
  className,
  ...props
}: IconProps) {
  return (
    <IconComponent
      className={cn(
        sizeClasses[size],
        variantClasses[variant],
        spin && 'animate-spin',
        pulse && 'animate-pulse',
        className
      )}
      {...props}
    />
  )
}
