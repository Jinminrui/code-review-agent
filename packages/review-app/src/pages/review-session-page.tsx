import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useReviewSessionStore } from '@/store/review-session-store'
import { useReviewSessionStream } from '@/hooks/use-review-session-stream'
import { useSelectedFinding } from '@/hooks/use-selected-finding'
import { SidebarHeader } from '@/components/session/sidebar-header'
import { SessionProgress } from '@/components/session/session-progress'
import { ReviewSummaryPanel } from '@/components/session/review-summary-panel'
import { RiskFileList } from '@/components/session/risk-file-list'
import { FindingList } from '@/components/session/finding-list'
import { MonacoDiffViewer } from '@/components/diff/monaco-diff-viewer'
import { DiffEmptyState } from '@/components/session/diff-empty-state'
import { AlertTriangle } from 'lucide-react'
import { ipcClient } from '@/lib/ipc-client'

export function ReviewSessionPage() {
  const { sessionId = '' } = useParams()
  // 页面挂载即建立快照加载和事件订阅，离开页面时由 hook 统一清理。
  useReviewSessionStream(sessionId)

  const session = useReviewSessionStore((state) => state.session)
  const error = useReviewSessionStore((state) => state.error)
  const selectedFindingId = useReviewSessionStore((state) => state.selectedFindingId)
  const setSelectedFinding = useReviewSessionStore((state) => state.setSelectedFinding)
  const selectedFinding = useSelectedFinding()
  const selectedDiff = selectedFinding ? session?.diffByFile[selectedFinding.file] : null

  const [isCancelConfirmOpen, setCancelConfirmOpen] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)

  const handleCancelReview = async () => {
    setIsCancelling(true)
    setCancelError(null)
    try {
      await ipcClient.cancelSession(sessionId)
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : '中止审查失败')
      setIsCancelling(false)
    }
  }

  useEffect(() => {
    if (session?.status === 'cancelled' || session?.status === 'finished' || session?.status === 'partial' || session?.status === 'failed') {
      setIsCancelling(false)
    }
  }, [session?.status])

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
        {/* 侧边栏头部 - 返回按钮和状态 */}
        <SidebarHeader
          status={session?.status ?? 'idle'}
          onCancel={() => setCancelConfirmOpen(true)}
          isCancelling={isCancelling}
        />

        {/* 错误提示 */}
        {(error || cancelError) && (
          <div className="p-3 bg-[rgba(248,81,73,0.1)] border-b border-border-muted flex items-center gap-2">
            <AlertTriangle size={14} className="text-accent-red flex-shrink-0" />
            <span className="text-xs text-accent-red">{cancelError ?? error}</span>
          </div>
        )}

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

      {/* 取消确认弹层 */}
      {isCancelConfirmOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" role="dialog" aria-modal="true">
          <div className="bg-bg-surface border border-border-default rounded-lg p-5 w-[360px]">
            <h2 className="text-base font-semibold text-text-primary mb-2">中止审查</h2>
            <p className="text-sm text-text-secondary mb-4">
              中止后会保留当前已产生的审查结果。确定要中止这次审查吗？
            </p>
            <div className="flex justify-end gap-2">
              <button
                className="px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary"
                onClick={() => setCancelConfirmOpen(false)}
              >
                继续审查
              </button>
              <button
                className="px-3 py-1.5 text-sm bg-accent-red text-white rounded"
                onClick={() => {
                  setCancelConfirmOpen(false)
                  void handleCancelReview()
                }}
              >
                中止审查
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
