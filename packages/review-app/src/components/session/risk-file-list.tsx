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
