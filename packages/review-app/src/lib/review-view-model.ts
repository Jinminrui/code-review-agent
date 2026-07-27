/**
 * 模块职责：把结构化审查数据转换为稳定的展示顺序、筛选结果和状态文案。
 * 边界约束：不修改输入数据，也不从缺失字段推断后端未提供的信息。
 */
import type { ReviewFinding, ReviewSessionDetail } from './review-model'

const severityOrder: Record<ReviewFinding['severity'], number> = {
  high: 0,
  medium: 1,
  low: 2
}

export type FindingFilter = {
  severity: ReviewFinding['severity'] | 'all'
  file: string | 'all'
}

export type SessionEmptyState = {
  tone: 'progress' | 'success' | 'warning' | 'error'
  message: string
}

export function sortFindings(findings: ReviewFinding[]): ReviewFinding[] {
  return [...findings].sort((left, right) => {
    const severityDifference = severityOrder[left.severity] - severityOrder[right.severity]
    if (severityDifference !== 0) return severityDifference

    const fileDifference = left.file.localeCompare(right.file)
    if (fileDifference !== 0) return fileDifference

    const lineDifference = (left.startLine ?? Number.POSITIVE_INFINITY) - (right.startLine ?? Number.POSITIVE_INFINITY)
    if (lineDifference !== 0) return lineDifference

    return left.id.localeCompare(right.id)
  })
}

export function filterFindings(findings: ReviewFinding[], filter: FindingFilter): ReviewFinding[] {
  return findings.filter((finding) => {
    const matchesSeverity = filter.severity === 'all' || finding.severity === filter.severity
    const matchesFile = filter.file === 'all' || finding.file === filter.file
    return matchesSeverity && matchesFile
  })
}

export function getSessionEmptyState(status: ReviewSessionDetail['status'], findingCount: number): SessionEmptyState {
  if (findingCount > 0) {
    return { tone: 'success', message: '' }
  }

  switch (status) {
    case 'running':
      return { tone: 'progress', message: '正在分析变更，发现问题后会实时显示' }
    case 'finished':
      return { tone: 'success', message: '未发现需要关注的问题' }
    case 'partial':
      return { tone: 'warning', message: '部分审查单元未完成，以下结果仅供参考' }
    case 'failed':
      return { tone: 'error', message: '审查未完成，请重试或重新启动' }
    case 'cancelled':
      return { tone: 'warning', message: '审查已中止，当前结果不完整' }
    default:
      return { tone: 'progress', message: '正在准备审查' }
  }
}

export function getComparisonLabel(baseRef: string, targetRef: string): string {
  return `将审查 ${targetRef} 相对 ${baseRef} 的改动`
}
