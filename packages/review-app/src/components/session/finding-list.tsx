/**
 * 模块职责：承载本模块的稳定业务逻辑，并对外提供边界清晰的类型或函数。
 * 边界约束：输入数据应在边界处校验；不要在本模块内绕过既定的分层和 IPC 约束。
 * 维护提示：修改时优先保持现有契约和错误语义，并同步更新相关测试。
 */
import { cn } from '@/lib/utils'
import { Icon } from '@/components/ui/icon'
import { SectionLabel } from '@/components/ui/section-label'
import { FindingCard } from './finding-card'
import { AlertTriangle } from 'lucide-react'
import type { ReviewFinding } from '@/lib/review-model'
import { FindingFilter } from './finding-filter'
import { filterFindings, sortFindings, type FindingFilter as FindingFilterValue } from '@/lib/review-view-model'

interface FindingListProps {
  findings: ReviewFinding[]
  selectedFindingId: string | null
  onSelectFinding: (id: string) => void
  filter?: FindingFilterValue
  files?: string[]
  onFilterChange?: (filter: FindingFilterValue) => void
  emptyMessage?: string
}

export function FindingList({ findings, selectedFindingId, onSelectFinding, filter = { severity: 'all', file: 'all' }, files = [], onFilterChange, emptyMessage }: FindingListProps) {
  const visibleFindings = sortFindings(filterFindings(findings, filter))

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      <div className="p-4 pb-2 space-y-3">
        <SectionLabel command="审查问题" count={findings.length} />
        {onFilterChange && (
          <FindingFilter
            value={filter}
            files={files}
            resultCount={visibleFindings.length}
            onChange={onFilterChange}
          />
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
        {visibleFindings.length === 0 ? (
          <div className="text-center py-8">
            <Icon icon={AlertTriangle} size="lg" variant="muted" className="mx-auto mb-2" />
            <p className="text-sm text-text-tertiary">{findings.length === 0 ? (emptyMessage ?? '暂无发现') : '没有符合筛选条件的问题'}</p>
          </div>
        ) : (
          visibleFindings.map((finding) => (
            <FindingCard
              key={finding.id}
              finding={finding}
              isSelected={finding.id === selectedFindingId}
              onClick={() => onSelectFinding(finding.id)}
            />
          ))
        )}
      </div>
    </div>
  )
}
