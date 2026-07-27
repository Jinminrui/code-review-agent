/**
 * 模块职责：验证 finding 展示规则和会话空状态文案。
 * 边界约束：视图模型只处理已校验的结构化数据，不猜测后端缺失字段。
 */
import { describe, expect, it } from 'vitest'
import {
  filterFindings,
  getComparisonLabel,
  getSessionEmptyState,
  sortFindings,
  type FindingFilter
} from '../src/lib/review-view-model'
import type { ReviewFinding } from '../src/lib/review-model'

const findings: ReviewFinding[] = [
  { id: 'low-file', severity: 'low', category: 'style', summary: '低风险', explanation: '说明', file: 'src/z.ts', confidenceSignals: [], status: 'file-level' },
  { id: 'high-line', severity: 'high', category: 'bug', summary: '高风险', explanation: '说明', file: 'src/b.ts', startLine: 12, endLine: 12, confidenceSignals: [], status: 'line-level' },
  { id: 'medium-line', severity: 'medium', category: 'bug', summary: '中风险', explanation: '说明', file: 'src/a.ts', startLine: 4, endLine: 4, confidenceSignals: [], status: 'line-level' },
  { id: 'high-file', severity: 'high', category: 'security', summary: '高风险文件级', explanation: '说明', file: 'src/b.ts', confidenceSignals: [], status: 'file-level' }
]

describe('review view model', () => {
  it('sorts findings by severity, file, line, then file-level status', () => {
    expect(sortFindings(findings).map((finding) => finding.id)).toEqual([
      'high-line',
      'high-file',
      'medium-line',
      'low-file'
    ])
  })

  it('filters findings by severity and file without mutating the source list', () => {
    const filter: FindingFilter = { severity: 'high', file: 'src/b.ts' }
    expect(filterFindings(findings, filter).map((finding) => finding.id)).toEqual(['high-line', 'high-file'])
    expect(findings[0]?.id).toBe('low-file')
  })

  it('returns explicit empty state copy for running and finished sessions', () => {
    expect(getSessionEmptyState('running', 0).message).toBe('正在分析变更，发现问题后会实时显示')
    expect(getSessionEmptyState('finished', 0).message).toBe('未发现需要关注的问题')
  })

  it('builds a comparison label from target and base refs', () => {
    expect(getComparisonLabel('main', 'feature')).toBe('将审查 feature 相对 main 的改动')
  })
})
