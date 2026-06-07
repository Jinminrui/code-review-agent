import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { Icon } from '@/components/ui/icon'
import { RepositoryPicker } from './repository-picker'
import { BranchSelector } from './branch-selector'
import { Play, RefreshCw, Folder, GitBranch } from 'lucide-react'

export function LaunchReviewForm() {
  const navigate = useNavigate()
  const [repo, setRepo] = useState('')
  const [baseBranch, setBaseBranch] = useState('')
  const [targetBranch, setTargetBranch] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // TODO: 调用后端启动审查
    navigate('/sessions/new')
  }

  const handleReviewWorkspace = () => {
    // TODO: 调用后端审查工作区
    navigate('/sessions/new')
  }

  return (
    <div className="w-full max-w-lg">
      {/* 标题 */}
      <div className="mb-8 text-center">
        <div className="section-label justify-center mb-2">
          <span className="prompt">$</span>
          <span className="command">code-review --init</span>
        </div>
        <h1 className="text-2xl font-semibold text-text-primary tracking-tight">
          启动代码审查
        </h1>
        <p className="mt-2 text-sm text-text-secondary">
          选择仓库和分支，开始审查代码变更
        </p>
      </div>

      {/* 表单 */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* 仓库选择 */}
        <div>
          <label className="section-label mb-2">
            <span className="prompt">$</span>
            <Icon icon={Folder} size="xs" />
            <span className="command">repository</span>
          </label>
          <RepositoryPicker value={repo} onChange={setRepo} />
        </div>

        {/* 基础分支 */}
        <div>
          <label className="section-label mb-2">
            <span className="prompt">$</span>
            <Icon icon={GitBranch} size="xs" />
            <span className="command">base-branch</span>
          </label>
          <BranchSelector value={baseBranch} onChange={setBaseBranch} placeholder="选择基础分支" />
        </div>

        {/* 目标分支 */}
        <div>
          <label className="section-label mb-2">
            <span className="prompt">$</span>
            <Icon icon={GitBranch} size="xs" />
            <span className="command">target-branch</span>
          </label>
          <BranchSelector value={targetBranch} onChange={setTargetBranch} placeholder="选择目标分支" />
        </div>

        {/* 提交按钮 */}
        <button
          type="submit"
          className={cn(
            'w-full h-10 px-4 rounded-md font-mono text-sm font-medium transition-all duration-150',
            'bg-accent-cyan text-text-on-accent hover:bg-accent-cyan-muted hover:shadow-glow-cyan',
            'active:scale-[0.98]'
          )}
        >
          <span className="inline-flex items-center gap-2">
            <Icon icon={Play} size="sm" />
            <span>$ start-review</span>
          </span>
        </button>

        {/* 分隔线 */}
        <div className="flex items-center gap-4 my-6">
          <div className="flex-1 h-px bg-border-muted" />
          <span className="text-xs text-text-disabled font-mono">or</span>
          <div className="flex-1 h-px bg-border-muted" />
        </div>

        {/* 审查工作区按钮 */}
        <button
          type="button"
          onClick={handleReviewWorkspace}
          className={cn(
            'w-full h-10 px-4 rounded-md font-mono text-sm font-medium transition-all duration-150',
            'bg-transparent border border-border-default text-text-secondary',
            'hover:border-border-accent hover:text-text-primary hover:bg-accent-cyan-subtle'
          )}
        >
          <span className="inline-flex items-center gap-2">
            <Icon icon={RefreshCw} size="sm" />
            <span>$ review-workspace</span>
          </span>
        </button>
      </form>
    </div>
  )
}
