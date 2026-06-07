import { cn } from '@/lib/utils'
import { Icon } from '@/components/ui/icon'
import { ProgressBar } from '@/components/ui/progress-bar'
import { SectionLabel } from '@/components/ui/section-label'
import { StatusBadge } from '@/components/ui/status-badge'
import { Loader2, FileText } from 'lucide-react'

interface SessionProgressProps {
  status: string
  completedUnits?: number
  totalUnits?: number
}

export function SessionProgress({ status, completedUnits = 0, totalUnits = 0 }: SessionProgressProps) {
  const percentage = totalUnits > 0 ? Math.round((completedUnits / totalUnits) * 100) : 0
  const isRunning = status === 'running' || status === 'streaming'

  return (
    <div className="p-4 border-b border-border-muted">
      <SectionLabel command="session-status" className="mb-3" />

      {/* 状态和进度 */}
      <div className="space-y-3">
        {/* 状态标签 */}
        <div className="flex items-center gap-2">
          {isRunning ? (
            <Icon icon={Loader2} size="sm" variant="accent" spin />
          ) : null}
          <StatusBadge
            status={status as any}
            label={status.toUpperCase()}
          />
        </div>

        {/* 进度条 */}
        <ProgressBar value={percentage} />

        {/* 单元计数 */}
        <div className="flex items-center gap-2 text-xs text-text-tertiary">
          <Icon icon={FileText} size="xs" variant="muted" />
          <span>{completedUnits}/{totalUnits} units complete</span>
        </div>
      </div>
    </div>
  )
}
