import { cn } from '@/lib/utils'
import { Icon } from '@/components/ui/icon'
import { ProgressBar } from '@/components/ui/progress-bar'
import { SectionLabel } from '@/components/ui/section-label'
import { StatusBadge, type Status } from '@/components/ui/status-badge'
import { Loader2, FileText } from 'lucide-react'

interface SessionProgressProps {
  status: Status
  completedUnits?: number
  totalUnits?: number
}

const statusLabels: Record<Status, string> = {
  idle: '空闲',
  running: '审查中',
  streaming: '审查中',
  partial: '部分完成',
  finished: '已完成',
  failed: '失败',
  pending: '等待中'
}

export function SessionProgress({ status, completedUnits = 0, totalUnits = 0 }: SessionProgressProps) {
  const percentage = totalUnits > 0 ? Math.round((completedUnits / totalUnits) * 100) : 0
  const isRunning = status === 'running' || status === 'streaming'
  const statusLabel = statusLabels[status] ?? status

  return (
    <div className="p-4 border-b border-border-muted">
      <SectionLabel command="session-status" className="mb-3" />

      {/* 状态和进度 */}
      <div className="space-y-3">
        {/* 状态标签 */}
        <div className="flex items-center gap-2">
          <StatusBadge
            status={status}
            label={statusLabel}
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
