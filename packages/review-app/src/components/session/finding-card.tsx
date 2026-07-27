/**
 * 模块职责：承载本模块的稳定业务逻辑，并对外提供边界清晰的类型或函数。
 * 边界约束：输入数据应在边界处校验；不要在本模块内绕过既定的分层和 IPC 约束。
 * 维护提示：修改时优先保持现有契约和错误语义，并同步更新相关测试。
 */
import { cn } from '@/lib/utils'
import { Icon } from '@/components/ui/icon'
import { StatusBadge } from '@/components/ui/status-badge'
import { AlertTriangle, Lock, Bug, Shield, Zap, FileText, MessageSquare } from 'lucide-react'
import type { ReviewFinding } from '@/lib/review-model'

interface FindingCardProps {
  finding: ReviewFinding
  isSelected: boolean
  onClick: () => void
}

const categoryIcons = {
  security: Shield,
  bug: Bug,
  performance: Zap,
  style: FileText,
  default: AlertTriangle,
}

export function FindingCard({ finding, isSelected, onClick }: FindingCardProps) {
  const CategoryIcon = categoryIcons[finding.category as keyof typeof categoryIcons] || categoryIcons.default
  const findingStatusLabel = finding.status === 'line-level' ? '已定位到代码行' : '仅定位到文件'

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left p-3 rounded-md border transition-all duration-150',
        'bg-bg-surface border-border-default',
        isSelected
          ? 'border-accent-cyan bg-bg-elevated shadow-[inset_0_0_0_1px_var(--border-accent)]'
          : 'hover:bg-bg-elevated hover:border-border-accent hover:shadow-glow-cyan hover:-translate-y-px'
      )}
      style={{
        borderLeftWidth: '3px',
        borderLeftColor: finding.severity === 'high'
          ? 'var(--accent-red)'
          : finding.severity === 'medium'
          ? 'var(--accent-amber)'
          : 'var(--text-tertiary)',
      }}
    >
      {/* 标题行 */}
      <div className="flex items-start gap-2 mb-2">
        <Icon
          icon={CategoryIcon}
          size="sm"
          variant={finding.severity === 'high' ? 'danger' : finding.severity === 'medium' ? 'warning' : 'muted'}
        />
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-text-primary truncate">
            {finding.summary}
          </h3>
        </div>
        <StatusBadge
          severity={finding.severity}
          label={finding.severity.toUpperCase()}
        />
        <span className="text-[10px] text-text-tertiary">
          {findingStatusLabel}
        </span>
      </div>

      {/* 文件路径 */}
      <div className="flex items-center gap-1.5 mb-2 ml-6">
        <Icon icon={FileText} size="xs" variant="muted" />
        <span className="text-xs font-mono text-text-tertiary truncate">
          {finding.file}{finding.startLine != null ? `:${finding.startLine}-${finding.endLine}` : ''}
        </span>
      </div>

      {/* 证据预览 */}
      {finding.evidence && (
        <div className="ml-6 mt-2 p-2 rounded bg-bg-base border border-border-subtle">
          <div className="flex items-start gap-1.5">
            <Icon icon={MessageSquare} size="xs" variant="accent" className="mt-0.5 flex-shrink-0" />
            <p className="text-xs text-text-tertiary line-clamp-2 font-mono">
              {finding.evidence}
            </p>
          </div>
        </div>
      )}
    </button>
  )
}
