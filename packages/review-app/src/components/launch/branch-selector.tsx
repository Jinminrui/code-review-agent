import { cn } from '@/lib/utils'
import { Icon } from '@/components/ui/icon'
import { ChevronDown } from 'lucide-react'

interface BranchSelectorProps {
  branches: string[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export function BranchSelector({ branches, value, onChange, placeholder = '选择分支' }: BranchSelectorProps) {

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
        <option value="">{placeholder}</option>
        {branches.map((branch) => (
          <option key={branch} value={branch}>
            {branch}
          </option>
        ))}
      </select>
      <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
        <Icon icon={ChevronDown} size="sm" variant="muted" />
      </div>
    </div>
  )
}
