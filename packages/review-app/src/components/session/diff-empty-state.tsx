/**
 * 模块职责：承载本模块的稳定业务逻辑，并对外提供边界清晰的类型或函数。
 * 边界约束：输入数据应在边界处校验；不要在本模块内绕过既定的分层和 IPC 约束。
 * 维护提示：修改时优先保持现有契约和错误语义，并同步更新相关测试。
 */
import { Icon } from '@/components/ui/icon'
import { Search } from 'lucide-react'

export function DiffEmptyState() {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="empty-state-terminal max-w-sm">
        <div className="flex items-start gap-2 mb-4">
          <span className="prompt">$</span>
          <span className="command">select-finding</span>
        </div>
        <div className="flex items-start gap-2">
          <span className="text-accent-cyan">&gt;</span>
          <span>从侧边栏选择一个问题开始审查</span>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <Icon icon={Search} size="lg" variant="muted" className="mx-auto" />
        </div>
        <div className="mt-2 flex items-start gap-2">
          <span className="cursor-blink text-accent-cyan">_</span>
        </div>
      </div>
    </div>
  )
}
