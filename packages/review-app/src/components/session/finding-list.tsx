import { cn } from '@/lib/utils'
import { Icon } from '@/components/ui/icon'
import { SectionLabel } from '@/components/ui/section-label'
import { FindingCard } from './finding-card'
import { AlertTriangle } from 'lucide-react'
import type { ReviewFinding } from '@/lib/review-model'

interface FindingListProps {
  findings: ReviewFinding[]
  selectedFindingId: string | null
  onSelectFinding: (id: string) => void
}

export function FindingList({ findings, selectedFindingId, onSelectFinding }: FindingListProps) {
  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      <div className="p-4 pb-2">
        <SectionLabel command="findings" count={findings.length} />
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
        {findings.length === 0 ? (
          <div className="text-center py-8">
            <Icon icon={AlertTriangle} size="lg" variant="muted" className="mx-auto mb-2" />
            <p className="text-sm text-text-tertiary">暂无发现</p>
          </div>
        ) : (
          findings.map((finding) => (
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
