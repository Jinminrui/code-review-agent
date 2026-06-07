import { Outlet } from 'react-router-dom'
import { ActivityBar } from './activity-bar'

export function AppShell() {
  return (
    <div className="flex h-screen overflow-hidden">
      {/* 活动栏 */}
      <ActivityBar />

      {/* 主内容区 */}
      <main className="flex-1 min-w-0 overflow-auto">
        <div className="page-content">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
