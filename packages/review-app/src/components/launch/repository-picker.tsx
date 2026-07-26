/**
 * 模块职责：承载本模块的稳定业务逻辑，并对外提供边界清晰的类型或函数。
 * 边界约束：输入数据应在边界处校验；不要在本模块内绕过既定的分层和 IPC 约束。
 * 维护提示：修改时优先保持现有契约和错误语义，并同步更新相关测试。
 */
import { cn } from '@/lib/utils'
import { Icon } from '@/components/ui/icon'
import { FolderOpen } from 'lucide-react'

interface RepositoryPickerProps {
  value: string
  onBrowse: () => void
  isBrowsing?: boolean
}

export function RepositoryPicker({
  value,
  onBrowse,
  isBrowsing = false
}: RepositoryPickerProps) {
  return (
    <div className="flex gap-2">
      <div className="relative min-w-0 flex-1">
        <div
          className={cn(
            'w-full h-10 px-3 rounded-md flex items-center',
            'bg-bg-input border border-border-default font-mono text-sm',
            value ? 'text-text-primary' : 'text-text-disabled'
          )}
        >
          {value || '未选择仓库'}
        </div>
      </div>
      <button
        type="button"
        onClick={onBrowse}
        disabled={isBrowsing}
        className={cn(
          'h-10 shrink-0 rounded-md border border-border-default px-3 font-mono text-sm',
          'text-text-secondary transition-colors duration-150',
          'hover:border-border-accent hover:bg-accent-cyan-subtle hover:text-text-primary',
          'focus:outline-none focus:border-accent-cyan focus:ring-1 focus:ring-accent-cyan-subtle',
          'disabled:cursor-not-allowed disabled:opacity-50'
        )}
      >
        <span className="inline-flex items-center gap-2">
          <Icon icon={FolderOpen} size="sm" />
          <span>选择仓库</span>
        </span>
      </button>
    </div>
  )
}
