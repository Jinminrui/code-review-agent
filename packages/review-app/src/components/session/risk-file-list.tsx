/**
 * 模块职责：承载本模块的稳定业务逻辑，并对外提供边界清晰的类型或函数。
 * 边界约束：输入数据应在边界处校验；不要在本模块内绕过既定的分层和 IPC 约束。
 * 维护提示：修改时优先保持现有契约和错误语义，并同步更新相关测试。
 */
import { cn } from '@/lib/utils'
import { Icon } from '@/components/ui/icon'
import { SectionLabel } from '@/components/ui/section-label'
import { FileText } from 'lucide-react'

interface RiskFileListProps {
  files: string[]
}

export function RiskFileList({ files }: RiskFileListProps) {
  if (files.length === 0) return null

  return (
    <div className="p-4 border-b border-border-muted">
      <SectionLabel command="risk-files" count={files.length} className="mb-3" />

      <div className="space-y-1">
        {files.map((file) => (
          <div
            key={file}
            className={cn(
              'flex items-center gap-2 px-2 py-1.5 rounded',
              'text-xs font-mono text-text-secondary',
              'hover:bg-bg-elevated transition-colors duration-150'
            )}
          >
            <Icon icon={FileText} size="sm" variant="muted" />
            <span className="truncate">{file}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
