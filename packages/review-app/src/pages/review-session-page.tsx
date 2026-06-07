import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useReviewSessionStore } from '@/store/review-session-store'
import { useReviewSessionStream } from '@/hooks/use-review-session-stream'
import { useSelectedFinding } from '@/hooks/use-selected-finding'
import { SessionProgress } from '@/components/session/session-progress'
import { ReviewSummaryPanel } from '@/components/session/review-summary-panel'
import { RiskFileList } from '@/components/session/risk-file-list'
import { FindingList } from '@/components/session/finding-list'
import { MonacoDiffViewer } from '@/components/diff/monaco-diff-viewer'
import { DiffEmptyState } from '@/components/session/diff-empty-state'

export function ReviewSessionPage() {
  const { sessionId = '' } = useParams()
  useReviewSessionStream(sessionId)

  const session = useReviewSessionStore((state) => state.session)
  const selectedFindingId = useReviewSessionStore((state) => state.selectedFindingId)
  const setSelectedFinding = useReviewSessionStore((state) => state.setSelectedFinding)
  const selectedFinding = useSelectedFinding()
  const selectedDiff = selectedFinding ? session?.diffByFile[selectedFinding.file] : null

  useEffect(() => {
    if (!session) {
      return
    }

    if (session.findings.length === 0) {
      setSelectedFinding(null)
      return
    }

    if (!selectedFindingId) {
      setSelectedFinding(session.findings[0]?.id ?? null)
    }
  }, [selectedFindingId, session, setSelectedFinding])

  return (
    <div className="h-screen flex overflow-hidden">
      {/* 侧边栏 */}
      <aside className="w-80 h-full bg-bg-surface border-r border-border-default flex flex-col overflow-hidden">
        {/* 会话进度 */}
        <SessionProgress
          status={session?.status ?? 'idle'}
        />

        {/* 审查摘要 */}
        {session ? (
          <>
            <ReviewSummaryPanel
              changedFiles={session.summary.changedFilesCount}
              findings={session.summary.findingsCount}
              highRisk={session.summary.highSeverityCount}
            />

            {/* 风险文件列表 */}
            <RiskFileList files={session.summary.files} />

            {/* Finding 列表 */}
            <FindingList
              findings={session.findings}
              selectedFindingId={selectedFindingId}
              onSelectFinding={setSelectedFinding}
            />
          </>
        ) : null}
      </aside>

      {/* 主内容区 */}
      <main className="flex-1 min-w-0 overflow-hidden">
        {selectedFinding ? (
          <MonacoDiffViewer
            original={selectedDiff?.original ?? ''}
            modified={selectedDiff?.modified ?? ''}
            finding={selectedFinding}
          />
        ) : (
          <DiffEmptyState />
        )}
      </main>
    </div>
  )
}
