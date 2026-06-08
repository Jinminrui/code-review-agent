import { cn } from '@/lib/utils'

interface DeleteConfirmDialogProps {
  isOpen: boolean;
  sessionId: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteConfirmDialog({ isOpen, sessionId, onConfirm, onCancel }: DeleteConfirmDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 背景遮罩 */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* 对话框 */}
      <div
        className={cn(
          'relative z-10 w-full max-w-md p-6 rounded-lg',
          'bg-bg-surface border border-border-default shadow-xl'
        )}
      >
        <h3 className="text-lg font-semibold text-text-primary mb-2">
          确认删除
        </h3>
        <p className="text-text-secondary mb-1">
          确定要删除这条审查记录吗？
        </p>
        <p className="text-sm text-text-tertiary mb-6">
          会话 ID: {sessionId}
        </p>
        <p className="text-sm text-accent-red mb-6">
          此操作不可撤销。
        </p>

        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium',
              'bg-bg-elevated text-text-secondary',
              'hover:bg-bg-surface hover:text-text-primary',
              'transition-colors'
            )}
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium',
              'bg-accent-red text-white',
              'hover:bg-accent-red/90',
              'transition-colors'
            )}
          >
            删除
          </button>
        </div>
      </div>
    </div>
  );
}
