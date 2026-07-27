/**
 * 模块职责：验证 finding 筛选器的公开交互。
 * 边界约束：筛选器只发出选择值，不负责过滤审查数据。
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { FindingFilter } from '../src/components/session/finding-filter'
import type { FindingFilter as FindingFilterValue } from '../src/lib/review-view-model'

describe('FindingFilter', () => {
  it('emits severity and file changes', () => {
    const onChange = vi.fn()

    function TestFilter() {
      const [value, setValue] = useState<FindingFilterValue>({ severity: 'all', file: 'all' })
      return <FindingFilter value={value} files={['src/a.ts', 'src/b.ts']} resultCount={2} onChange={(nextValue) => { onChange(nextValue); setValue(nextValue) }} />
    }

    render(<TestFilter />)

    fireEvent.change(screen.getByRole('combobox', { name: '风险级别' }), { target: { value: 'high' } })
    expect(onChange).toHaveBeenLastCalledWith({ severity: 'high', file: 'all' })

    fireEvent.change(screen.getByRole('combobox', { name: '文件' }), { target: { value: 'src/b.ts' } })
    expect(onChange).toHaveBeenLastCalledWith({ severity: 'high', file: 'src/b.ts' })
    expect(screen.getByText('2 个问题')).toBeInTheDocument()
  })
})
