/**
 * 模块职责：承载本模块的稳定业务逻辑，并对外提供边界清晰的类型或函数。
 * 边界约束：输入数据应在边界处校验；不要在本模块内绕过既定的分层和 IPC 约束。
 * 维护提示：修改时优先保持现有契约和错误语义，并同步更新相关测试。
 */
import { cn } from '@/lib/utils'
import { type ButtonHTMLAttributes, forwardRef } from 'react'

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'ghost' | 'danger'
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ variant = 'default', className, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center w-8 h-8 rounded-md border border-transparent transition-all duration-150 ease-out',
          'text-text-tertiary hover:text-text-secondary',
          variant === 'default' && 'hover:bg-bg-elevated hover:border-border-default',
          variant === 'ghost' && 'hover:bg-bg-elevated',
          variant === 'danger' && 'hover:text-accent-red hover:bg-[rgba(248,81,73,0.1)] hover:border-[rgba(248,81,73,0.3)]',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          className
        )}
        {...props}
      />
    )
  }
)

IconButton.displayName = 'IconButton'
