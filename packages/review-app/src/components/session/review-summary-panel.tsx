import { cn } from '@/lib/utils'
import { Icon } from '@/components/ui/icon'
import { SectionLabel } from '@/components/ui/section-label'
import { FileText, AlertTriangle, Shield } from 'lucide-react'

interface ReviewSummaryPanelProps {
  changedFiles: number
  findings: number
  highRisk: number
}

export function ReviewSummaryPanel({ changedFiles, findings, highRisk }: ReviewSummaryPanelProps) {
  return (
    <div className="p-4 border-b border-border-muted">
      <SectionLabel command="session-summary" className="mb-3" />

      <div className="grid grid-cols-3 gap-3">
        {/* 变更文件 */}
        <div className="text-center p-2 rounded-md bg-bg-base">
          <Icon icon={FileText} size="md" variant="muted" className="mx-auto mb-1" />
          <div className="text-lg font-semibold text-text-primary">{changedFiles}</div>
          <div className="text-xs text-text-tertiary">files</div>
        </div>

        {/* 发现数量 */}
        <div className="text-center p-2 rounded-md bg-bg-base">
          <Icon icon={AlertTriangle} size="md" variant="warning" className="mx-auto mb-1" />
          <div className="text-lg font-semibold text-text-primary">{findings}</div>
          <div className="text-xs text-text-tertiary">findings</div>
        </div>

        {/* 高危数量 */}
        <div className="text-center p-2 rounded-md bg-bg-base">
          <Icon icon={Shield} size="md" variant="danger" className="mx-auto mb-1" />
          <div className="text-lg font-semibold text-accent-red">{highRisk}</div>
          <div className="text-xs text-text-tertiary">high</div>
        </div>
      </div>
    </div>
  )
}
