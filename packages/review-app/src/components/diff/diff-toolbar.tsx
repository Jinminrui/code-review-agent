/**
 * 模块职责：提供 Diff 展示模式和 finding 定位可信度的轻量工具栏。
 * 边界约束：不操作 Monaco 实例，仅通过受控属性通知页面模式变化。
 */
import { Columns2, FileCode2, Rows3 } from 'lucide-react'
import { Icon } from '@/components/ui/icon'

export type DiffMode = 'side-by-side' | 'inline'

interface DiffToolbarProps {
  file: string
  status: 'line-level' | 'file-level'
  mode: DiffMode
  onModeChange: (mode: DiffMode) => void
}

export function DiffToolbar({ file, status, mode, onModeChange }: DiffToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle px-3 py-2">
      <div className="flex min-w-0 items-center gap-2 text-xs text-text-secondary">
        <Icon icon={FileCode2} size="sm" variant="muted" />
        <span className="truncate font-mono">{file}</span>
        <span className="shrink-0 rounded bg-bg-overlay px-1.5 py-0.5 text-[11px] text-text-tertiary">
          {status === 'line-level' ? '已定位到代码行' : '仅定位到文件'}
        </span>
      </div>

      <div className="flex items-center gap-1 rounded-md border border-border-default bg-bg-input p-0.5">
        <button
          type="button"
          aria-label="并排 Diff"
          aria-pressed={mode === 'side-by-side'}
          onClick={() => onModeChange('side-by-side')}
          className={mode === 'side-by-side' ? 'rounded bg-bg-elevated px-2 py-1 text-xs text-text-primary' : 'rounded px-2 py-1 text-xs text-text-tertiary hover:text-text-primary'}
        >
          <span className="inline-flex items-center gap-1"><Columns2 size={13} />并排</span>
        </button>
        <button
          type="button"
          aria-label="内联 Diff"
          aria-pressed={mode === 'inline'}
          onClick={() => onModeChange('inline')}
          className={mode === 'inline' ? 'rounded bg-bg-elevated px-2 py-1 text-xs text-text-primary' : 'rounded px-2 py-1 text-xs text-text-tertiary hover:text-text-primary'}
        >
          <span className="inline-flex items-center gap-1"><Rows3 size={13} />内联</span>
        </button>
      </div>
    </div>
  )
}
