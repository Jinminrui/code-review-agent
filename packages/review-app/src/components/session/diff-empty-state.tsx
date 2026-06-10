import { Icon } from '@/components/ui/icon'
import { Search } from 'lucide-react'

export function DiffEmptyState() {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="empty-state-terminal max-w-sm">
        <div className="flex items-start gap-2 mb-4">
          <span className="prompt">$</span>
          <span className="command">select-finding</span>
        </div>
        <div className="flex items-start gap-2">
          <span className="text-accent-cyan">&gt;</span>
          <span>从侧边栏选择一个问题开始审查</span>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <Icon icon={Search} size="lg" variant="muted" className="mx-auto" />
        </div>
        <div className="mt-2 flex items-start gap-2">
          <span className="cursor-blink text-accent-cyan">_</span>
        </div>
      </div>
    </div>
  )
}
