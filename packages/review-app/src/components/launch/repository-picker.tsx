import { cn } from '@/lib/utils'
import { Icon } from '@/components/ui/icon'
import { ChevronDown } from 'lucide-react'

interface RepositoryPickerProps {
  repositories: string[]
  value: string
  onChange: (value: string) => void
}

export function RepositoryPicker({ repositories, value, onChange }: RepositoryPickerProps) {
  return (
    <div className="relative">
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
  )
}
