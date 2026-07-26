/**
 * 模块职责：承载本模块的稳定业务逻辑，并对外提供边界清晰的类型或函数。
 * 边界约束：输入数据应在边界处校验；不要在本模块内绕过既定的分层和 IPC 约束。
 * 维护提示：修改时优先保持现有契约和错误语义，并同步更新相关测试。
 */
import { useEffect, useState } from 'react'
import { useSessionHistoryStore } from '@/store/session-history-store'
import { SessionCard } from '@/components/session/session-card'
import { DeleteConfirmDialog } from '@/components/session/delete-confirm-dialog'
import { Icon } from '@/components/ui/icon'
import { Clock } from 'lucide-react'

export function SessionHistoryPage() {
  const {
    sessions,
    isLoading,
    error,
    fetchSessions,
    deleteSession,
    exportSession,
    clearError
  } = useSessionHistoryStore();

  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleDelete = (sessionId: string) => {
    setDeleteTarget(sessionId);
  };

  const handleConfirmDelete = async () => {
    if (deleteTarget) {
      await deleteSession(deleteTarget);
      setDeleteTarget(null);
    }
  };

  const handleExport = (sessionId: string) => {
    exportSession(sessionId);
  };

  return (
    <div className="min-h-screen bg-bg-base p-8">
      <div className="max-w-3xl mx-auto">
        {/* 标题 */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-text-primary mb-2">审查历史</h1>
          <p className="text-text-secondary">
            共 {sessions.length} 条记录
          </p>
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="mb-4 p-4 bg-accent-red/10 border border-accent-red/20 rounded-lg">
            <p className="text-accent-red text-sm">{error}</p>
            <button
              onClick={clearError}
              className="text-xs text-accent-red/70 hover:text-accent-red mt-1"
            >
              关闭
            </button>
          </div>
        )}

        {/* 加载状态 */}
        {isLoading && (
          <div className="text-center py-12">
            <p className="text-text-tertiary">加载中...</p>
          </div>
        )}

        {/* 会话列表 */}
        {!isLoading && sessions.length === 0 ? (
          <div className="empty-state-terminal">
            <div className="text-center">
              <Icon icon={Clock} size="xl" variant="muted" className="mx-auto mb-4" />
              <p className="text-text-tertiary">暂无审查记录</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((session) => (
              <SessionCard
                key={session.sessionId}
                session={session}
                onDelete={handleDelete}
                onExport={handleExport}
              />
            ))}
          </div>
        )}
      </div>

      {/* 删除确认对话框 */}
      <DeleteConfirmDialog
        isOpen={deleteTarget !== null}
        sessionId={deleteTarget ?? ''}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
