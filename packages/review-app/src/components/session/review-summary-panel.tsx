/**
 * 模块职责：承载本模块的稳定业务逻辑，并对外提供边界清晰的类型或函数。
 * 边界约束：输入数据应在边界处校验；不要在本模块内绕过既定的分层和 IPC 约束。
 * 维护提示：修改时优先保持现有契约和错误语义，并同步更新相关测试。
 */
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
      <SectionLabel command="审查摘要" className="mb-3" />

      <div className="grid grid-cols-3 gap-3">
        {/* 变更文件 */}
        <div className="text-center p-2 rounded-md bg-bg-base">
          <Icon icon={FileText} size="md" variant="muted" className="mx-auto mb-1" />
          <div className="text-lg font-semibold text-text-primary">{changedFiles}</div>
          <div className="text-xs text-text-tertiary">文件</div>
        </div>

        {/* 发现数量 */}
        <div className="text-center p-2 rounded-md bg-bg-base">
          <Icon icon={AlertTriangle} size="md" variant="warning" className="mx-auto mb-1" />
          <div className="text-lg font-semibold text-text-primary">{findings}</div>
          <div className="text-xs text-text-tertiary">问题</div>
        </div>

        {/* 高危数量 */}
        <div className="text-center p-2 rounded-md bg-bg-base">
          <Icon icon={Shield} size="md" variant="danger" className="mx-auto mb-1" />
          <div className="text-lg font-semibold text-accent-red">{highRisk}</div>
          <div className="text-xs text-text-tertiary">高风险</div>
        </div>
      </div>
    </div>
  )
}
