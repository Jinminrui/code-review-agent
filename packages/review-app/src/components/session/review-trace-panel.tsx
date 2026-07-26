/**
 * 模块职责：承载本模块的稳定业务逻辑，并对外提供边界清晰的类型或函数。
 * 边界约束：输入数据应在边界处校验；不要在本模块内绕过既定的分层和 IPC 约束。
 * 维护提示：修改时优先保持现有契约和错误语义，并同步更新相关测试。
 */
import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ReviewTrace } from '@/lib/review-model'

interface ReviewTracePanelProps {
  trace: ReviewTrace
}

const unavailable = '不可用'

export function ReviewTracePanel({ trace }: ReviewTracePanelProps) {
  const [expanded, setExpanded] = useState(false)
  return (
    <section className="border-b border-border-muted p-4" aria-label="审查轨迹">
      <button className="flex w-full items-center justify-between text-left" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded}>
        <span className="text-xs font-mono uppercase tracking-wider text-text-secondary">review-trace</span>
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>
      {expanded && (
        <div className="mt-3 space-y-3 text-xs text-text-tertiary">
          <TraceSection label="计划摘要" value={trace.planSummary ?? unavailable} />
          <TraceSection label="工具摘要" value={trace.toolSummaries?.join('；') || unavailable} />
          <TraceSection label="证据来源" value={trace.evidenceSources.length > 0 ? trace.evidenceSources.join('；') : unavailable} />
          <TraceSection label="Reflection 结论" value={trace.reflectionConclusion ?? unavailable} />
          {trace.degradation && <TraceSection label="降级提示" value={trace.degradation} />}
        </div>
      )}
    </section>
  )
}

function TraceSection({ label, value }: { label: string; value: string }) {
  return <div><div className="mb-1 text-text-secondary">{label}</div><div className={cn('font-mono break-words', value === unavailable && 'text-text-disabled')}>{value}</div></div>
}
