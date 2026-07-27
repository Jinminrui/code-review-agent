/**
 * 模块职责：验证 Diff 模式和定位可信度的公开交互。
 * 边界约束：工具栏只发出模式变化，不负责编辑器实例操作。
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DiffToolbar } from '../src/components/diff/diff-toolbar'

describe('DiffToolbar', () => {
  it('uses side-by-side by default and can switch to inline', () => {
    const onModeChange = vi.fn()

    render(
      <DiffToolbar
        file="src/a.ts"
        status="line-level"
        mode="side-by-side"
        onModeChange={onModeChange}
      />
    )

    expect(screen.getByText('已定位到代码行')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '并排 Diff' })).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(screen.getByRole('button', { name: '内联 Diff' }))
    expect(onModeChange).toHaveBeenCalledWith('inline')
  })
})
