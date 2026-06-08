import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { Icon } from '@/components/ui/icon'
import { StatusBadge } from '@/components/ui/status-badge'
import { GitBranch, Folder, FileText, AlertTriangle, Trash2, Download } from 'lucide-react'
import type { SessionSummary } from '@/lib/review-model'

interface SessionCardProps {
  session: SessionSummary;
  onDelete: (sessionId: string) => void;
  onExport: (sessionId: string) => void;
}

export function SessionCard({ session, onDelete, onExport }: SessionCardProps) {
  return (
    <div
      className={cn(
        'block p-4 rounded-lg border border-border-default bg-bg-surface',
        'hover:bg-bg-elevated hover:border-border-accent hover:shadow-glow-cyan',
        'transition-all duration-150'
      )}
    >
      {/* 分支信息 */}
      <div className="flex items-center gap-2 mb-2">
        <Icon icon={GitBranch} size="sm" variant="accent" />
        <Link
          to={`/sessions/${session.sessionId}`}
          className="font-mono text-sm text-text-primary hover:text-accent-cyan transition-colors"
        >
          {session.baseRef} → {session.targetRef}
        </Link>
      </div>

      {/* 仓库路径 */}
      <div className="flex items-center gap-2 mb-2">
        <Icon icon={Folder} size="sm" variant="muted" />
        <span className="font-mono text-xs text-text-tertiary">
          {session.repositoryPath}
        </span>
      </div>

      {/* 状态 */}
      <div className="flex items-center justify-between mb-3">
        <StatusBadge
          status={session.status === 'running' ? 'running' : session.status === 'finished' ? 'finished' : 'failed'}
          label={session.status.toUpperCase()}
        />
      </div>

      {/* 分隔线 */}
      <div className="h-px bg-border-muted mb-3" />

      {/* 统计信息 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <Icon icon={FileText} size="xs" variant="muted" />
            <span className="text-text-secondary">{session.summary.changedFilesCount} files</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Icon icon={AlertTriangle} size="xs" variant="warning" />
            <span className="text-text-secondary">{session.summary.findingsCount} findings</span>
          </div>
          {session.summary.highSeverityCount > 0 && (
            <div className="flex items-center gap-1.5">
              <Icon icon={AlertTriangle} size="xs" variant="danger" />
              <span className="text-accent-red">{session.summary.highSeverityCount} high</span>
            </div>
          )}
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onExport(session.sessionId)}
            className="p-1.5 text-text-tertiary hover:text-text-secondary hover:bg-bg-elevated rounded transition-colors"
            title="导出"
          >
            <Download size={14} />
          </button>
          <button
            onClick={() => onDelete(session.sessionId)}
            className="p-1.5 text-text-tertiary hover:text-accent-red hover:bg-bg-elevated rounded transition-colors"
            title="删除"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
