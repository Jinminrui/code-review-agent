/**
 * 模块职责：承载本模块的稳定业务逻辑，并对外提供边界清晰的类型或函数。
 * 边界约束：输入数据应在边界处校验；不要在本模块内绕过既定的分层和 IPC 约束。
 * 维护提示：修改时优先保持现有契约和错误语义，并同步更新相关测试。
 */
import { startTransition, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { Icon } from '@/components/ui/icon'
import { RepositoryPicker } from './repository-picker'
import { BranchSelector } from './branch-selector'
import { Play, RefreshCw, Folder, GitBranch, AlertTriangle } from 'lucide-react'
import { ipcClient } from '@/lib/ipc-client'

export function LaunchReviewForm() {
  const navigate = useNavigate()
  const [branches, setBranches] = useState<string[]>([])
  const [repositoryPath, setRepositoryPath] = useState('')
  const [baseRef, setBaseRef] = useState('')
  const [targetRef, setTargetRef] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSelectingRepository, setIsSelectingRepository] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 获取分支列表
  useEffect(() => {
    if (!repositoryPath) {
      setBranches([])
      setBaseRef('')
      setTargetRef('')
      return
    }

    void ipcClient.listBranches(repositoryPath).then(
      (nextBranches) => {
        setBranches(nextBranches)
        setBaseRef((current) => (nextBranches.includes(current) ? current : ''))
        setTargetRef((current) => (nextBranches.includes(current) ? current : ''))
      },
      (err) => {
        console.error("Failed to list branches:", err)
      }
    )
  }, [repositoryPath])

  async function handleSelectRepository() {
    if (isSelectingRepository) {
      return
    }

    setIsSelectingRepository(true)
    setError(null)

    try {
      const selectedRepository = await ipcClient.selectRepository()
      if (!selectedRepository) {
        return
      }

      setRepositoryPath(selectedRepository)
    } catch (err) {
      console.error("Failed to select repository:", err)
      setError(err instanceof Error ? err.message : "选择仓库失败")
    } finally {
      setIsSelectingRepository(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!repositoryPath || !baseRef || !targetRef || isSubmitting) {
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const session = await ipcClient.createSession({
        repositoryPath,
        baseRef,
        targetRef,
      })

      startTransition(() => {
        navigate(`/sessions/${session.sessionId}`)
      })
    } catch (err) {
      console.error("Failed to create session:", err)
      setError(err instanceof Error ? err.message : "创建审查会话失败")
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleWorkspaceReview() {
    if (!repositoryPath || isSubmitting) {
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const session = await ipcClient.createSession({
        repositoryPath,
        baseRef: 'HEAD',
        targetRef: 'WORKSPACE',
      })

      startTransition(() => {
        navigate(`/sessions/${session.sessionId}`)
      })
    } catch (err) {
      console.error("Failed to create workspace session:", err)
      setError(err instanceof Error ? err.message : "创建审查会话失败")
    } finally {
      setIsSubmitting(false)
    }
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

      {/* 错误提示 */}
      {error && (
        <div className="mb-4 p-3 rounded-md bg-[rgba(248,81,73,0.1)] border border-[rgba(248,81,73,0.3)] flex items-center gap-2">
          <AlertTriangle size={14} className="text-accent-red flex-shrink-0" />
          <span className="text-sm text-accent-red">{error}</span>
        </div>
      )}

      {/* 表单 */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* 仓库选择 */}
        <div>
          <label className="section-label mb-2">
            <span className="prompt">$</span>
            <Icon icon={Folder} size="xs" />
            <span className="command">repository</span>
          </label>
          <RepositoryPicker
            value={repositoryPath}
            onBrowse={handleSelectRepository}
            isBrowsing={isSelectingRepository}
          />
        </div>

        {/* 基础分支 */}
        <div>
          <label className="section-label mb-2">
            <span className="prompt">$</span>
            <Icon icon={GitBranch} size="xs" />
            <span className="command">base-branch</span>
          </label>
          <BranchSelector
            branches={branches}
            value={baseRef}
            onChange={setBaseRef}
            placeholder="选择基础分支"
          />
        </div>

        {/* 目标分支 */}
        <div>
          <label className="section-label mb-2">
            <span className="prompt">$</span>
            <Icon icon={GitBranch} size="xs" />
            <span className="command">target-branch</span>
          </label>
          <BranchSelector
            branches={branches}
            value={targetRef}
            onChange={setTargetRef}
            placeholder="选择目标分支"
          />
        </div>

        {/* 提交按钮 */}
        <button
          type="submit"
          disabled={!repositoryPath || !baseRef || !targetRef || isSubmitting}
          className={cn(
            'w-full h-10 px-4 rounded-md font-mono text-sm font-medium transition-all duration-150',
            'bg-accent-cyan text-text-on-accent hover:bg-accent-cyan-muted hover:shadow-glow-cyan',
            'active:scale-[0.98]',
            'disabled:opacity-50 disabled:cursor-not-allowed'
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
          onClick={handleWorkspaceReview}
          disabled={!repositoryPath || isSubmitting}
          className={cn(
            'w-full h-10 px-4 rounded-md font-mono text-sm font-medium transition-all duration-150',
            'bg-transparent border border-border-default text-text-secondary',
            'hover:border-border-accent hover:text-text-primary hover:bg-accent-cyan-subtle',
            'disabled:opacity-50 disabled:cursor-not-allowed'
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
