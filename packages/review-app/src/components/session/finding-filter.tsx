/**
 * 模块职责：提供 finding 的严重级别和文件筛选控件。
 * 边界约束：组件只维护受控值，不直接改变或排序 finding 数据。
 */
import type { FindingFilter } from '@/lib/review-view-model'

interface FindingFilterProps {
  value: FindingFilter
  files: string[]
  resultCount: number
  onChange: (value: FindingFilter) => void
}

export function FindingFilter({ value, files, resultCount, onChange }: FindingFilterProps) {
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="问题筛选">
      <label className="sr-only" htmlFor="finding-severity-filter">风险级别</label>
      <select
        id="finding-severity-filter"
        aria-label="风险级别"
        value={value.severity}
        onChange={(event) => onChange({ ...value, severity: event.target.value as FindingFilter['severity'] })}
        className="h-8 rounded-md border border-border-default bg-bg-input px-2 text-xs text-text-secondary focus:border-accent-cyan focus:outline-none"
      >
        <option value="all">全部风险</option>
        <option value="high">高风险</option>
        <option value="medium">中风险</option>
        <option value="low">低风险</option>
      </select>

      <label className="sr-only" htmlFor="finding-file-filter">筛选文件</label>
      <select
        id="finding-file-filter"
        aria-label="文件"
        value={value.file}
        onChange={(event) => onChange({ ...value, file: event.target.value })}
        className="min-w-0 max-w-56 h-8 rounded-md border border-border-default bg-bg-input px-2 text-xs font-mono text-text-secondary focus:border-accent-cyan focus:outline-none"
      >
        <option value="all">全部文件</option>
        {files.map((file) => <option key={file} value={file}>{file}</option>)}
      </select>

      <span className="ml-auto text-xs text-text-tertiary">{resultCount} 个问题</span>
    </div>
  )
}
