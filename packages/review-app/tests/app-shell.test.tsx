/**
 * 模块职责：验证工作台外壳的布局语义和导航可识别性。
 * 边界约束：测试公开渲染结果，不依赖具体 CSS 实现细节。
 */
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AppShell } from '../src/components/layout/app-shell'

describe('AppShell', () => {
  it('exposes a named workbench navigation and main content region', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <AppShell />
      </MemoryRouter>
    )

    expect(screen.getByRole('navigation', { name: '工作台导航' })).toBeInTheDocument()
    expect(screen.getByRole('main')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '首页' })).toHaveAttribute('aria-current', 'page')
  })
})
