import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { Icon } from '@/components/ui/icon'
import { SectionLabel } from '@/components/ui/section-label'
import { StatusBadge } from '@/components/ui/status-badge'
import { Clock, GitBranch, Folder, FileText, AlertTriangle } from 'lucide-react'

interface Session {
  id: string
  baseRef: string
  targetRef: string
  repoPath: string
  status: 'finished' | 'failed' | 'running'
  changedFiles: number
  findings: number
  highRisk: number
  createdAt: string
}

export function SessionHistoryPage() {
  // TODO: 从后端获取会话列表
  const sessions: Session[] = []

  return (
    <div className="min-h-screen bg-bg-base p-8">
      <div className="max-w-3xl mx-auto">
        {/* 标题 */}
        <div className="mb-8">
          <SectionLabel command="review-history" />
        </div>

        {/* 会话列表 */}
        {sessions.length === 0 ? (
          <div className="empty-state-terminal">
            <div className="text-center">
              <Icon icon={Clock} size="xl" variant="muted" className="mx-auto mb-4" />
              <p className="text-text-tertiary">暂无审查记录</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <SectionLabel command="recent-sessions" count={sessions.length} />

            {sessions.map((session) => (
              <Link
                key={session.id}
                to={`/sessions/${session.id}`}
                className={cn(
                  'block p-4 rounded-lg border border-border-default bg-bg-surface',
                  'hover:bg-bg-elevated hover:border-border-accent hover:shadow-glow-cyan',
                  'transition-all duration-150'
                )}
              >
                {/* 分支信息 */}
                <div className="flex items-center gap-2 mb-2">
                  <Icon icon={GitBranch} size="sm" variant="accent" />
                  <span className="font-mono text-sm text-text-primary">
                    {session.baseRef} → {session.targetRef}
                  </span>
                </div>

                {/* 仓库路径 */}
                <div className="flex items-center gap-2 mb-2">
                  <Icon icon={Folder} size="sm" variant="muted" />
                  <span className="font-mono text-xs text-text-tertiary">
                    {session.repoPath}
                  </span>
                </div>

                {/* 时间和状态 */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Icon icon={Clock} size="sm" variant="muted" />
                    <span className="text-xs text-text-tertiary">
                      {session.createdAt}
                    </span>
                  </div>
                  <StatusBadge status={session.status} label={session.status.toUpperCase()} />
                </div>

                {/* 分隔线 */}
                <div className="h-px bg-border-muted mb-3" />

                {/* 统计信息 */}
                <div className="flex items-center gap-4 text-xs">
                  <div className="flex items-center gap-1.5">
                    <Icon icon={FileText} size="xs" variant="muted" />
                    <span className="text-text-secondary">{session.changedFiles} files</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Icon icon={AlertTriangle} size="xs" variant="warning" />
                    <span className="text-text-secondary">{session.findings} findings</span>
                  </div>
                  {session.highRisk > 0 && (
                    <div className="flex items-center gap-1.5">
                      <Icon icon={AlertTriangle} size="xs" variant="danger" />
                      <span className="text-accent-red">{session.highRisk} high</span>
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
