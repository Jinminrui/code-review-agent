import { cn } from '@/lib/utils'
import { Icon } from '@/components/ui/icon'
import { ChevronDown, FolderOpen } from 'lucide-react'

interface RepositoryPickerProps {
  repositories: string[]
  value: string
  onChange: (value: string) => void
  onBrowse: () => void
  isBrowsing?: boolean
}

export function RepositoryPicker({
  repositories,
  value,
  onChange,
  onBrowse,
  isBrowsing = false
}: RepositoryPickerProps) {
  return (
    <div className="flex gap-2">
      <div className="relative min-w-0 flex-1">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            'w-full h-10 px-3 pr-8 rounded-md appearance-none cursor-pointer',
            'bg-bg-input border border-border-default text-text-primary font-mono text-sm',
            'focus:outline-none focus:border-accent-cyan focus:ring-1 focus:ring-accent-cyan-subtle',
            'transition-colors duration-150'
          )}
        >
          <option value="">选择仓库...</option>
          {repositories.map((repo) => (
            <option key={repo} value={repo}>
              {repo}
            </option>
          ))}
        </select>
        <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
          <Icon icon={ChevronDown} size="sm" variant="muted" />
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
