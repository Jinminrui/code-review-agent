/**
 * 模块职责：承载本模块的稳定业务逻辑，并对外提供边界清晰的类型或函数。
 * 边界约束：输入数据应在边界处校验；不要在本模块内绕过既定的分层和 IPC 约束。
 * 维护提示：修改时优先保持现有契约和错误语义，并同步更新相关测试。
 */
import { cn } from '@/lib/utils'
import { Icon } from '@/components/ui/icon'
import { ProgressBar } from '@/components/ui/progress-bar'
import { SectionLabel } from '@/components/ui/section-label'
import { StatusBadge, type Status } from '@/components/ui/status-badge'
import { Loader2, FileText } from 'lucide-react'
import type { ReviewProgressState } from '@/lib/review-model'

interface SessionProgressProps {
  status: Status
  completedUnits?: number
  totalUnits?: number
  progress?: ReviewProgressState
}

const statusLabels: Record<Status, string> = {
  idle: '空闲',
  running: '审查中',
  streaming: '审查中',
  partial: '部分完成',
  finished: '已完成',
  failed: '失败',
  pending: '等待中',
  cancelled: '已中止'
}

export function SessionProgress({ status, completedUnits = 0, totalUnits = 0, progress }: SessionProgressProps) {
  const percentage = totalUnits > 0 ? Math.round((completedUnits / totalUnits) * 100) : 0
  const isRunning = status === 'running' || status === 'streaming'
  const statusLabel = statusLabels[status] ?? status

  return (
    <div className="p-4 border-b border-border-muted">
      <SectionLabel command="审查状态" className="mb-3" />

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
          <span>{completedUnits}/{totalUnits} 个审查单元已完成</span>
        </div>
        {progress && (
          <div className="space-y-1 text-xs text-text-tertiary">
            <div>阶段：<span className="text-text-secondary">{({ 'pre-analysis': '预分析', planning: '规划', evidence: '证据采集', validation: '校验', complete: '完成' } as const)[progress.phase]}</span></div>
            <div>当前审查单元：<span className="font-mono text-text-secondary">{progress.currentUnit ?? '不可用'}</span></div>
            <div>检查项：<span className="text-text-secondary">{progress.checks.length > 0 ? progress.checks.map((check) => `${check.id}（${check.status}）`).join('、') : '不可用'}</span></div>
            <div>预算：<span className="font-mono text-text-secondary">{progress.budget ? `模型 ${progress.budget.modelCalls} / 工具 ${progress.budget.toolCalls} / 输入 ${progress.budget.maxInputTokens} / 输出 ${progress.budget.maxOutputTokens}` : '不可用'}</span></div>
            {progress.degradation && <div className="text-accent-amber">{progress.degradation}</div>}
          </div>
        )}
      </div>
    </div>
  )
}
