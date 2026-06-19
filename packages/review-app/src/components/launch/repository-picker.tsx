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
