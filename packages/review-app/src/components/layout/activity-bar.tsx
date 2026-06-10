import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { Icon } from '@/components/ui/icon'
import { Home, Clock } from 'lucide-react'

interface ActivityBarItem {
  to: string
  icon: typeof Home
  label: string
}

const topItems: ActivityBarItem[] = [
  { to: '/', icon: Home, label: '首页' },
  { to: '/sessions', icon: Clock, label: '历史记录' },
]

export function ActivityBar() {
  return (
    <aside className="w-12 h-screen bg-bg-base border-r border-border-muted flex flex-col items-center py-4">
      {/* 顶部 Logo */}
      <div className="mb-4">
        <div className="w-8 h-8 flex items-center justify-center">
          <Icon icon={Home} size="lg" variant="accent" />
        </div>
      </div>

      {/* 分隔线 */}
      <div className="w-6 h-px bg-border-muted mb-4" />

      {/* 顶部导航 */}
      <nav className="flex-1 flex flex-col items-center gap-1">
        {topItems.map((item) => (
          <NavLink
            key={item.label}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'relative w-12 h-12 flex items-center justify-center transition-colors duration-150',
                isActive ? 'text-accent-cyan' : 'text-text-tertiary hover:text-text-secondary'
              )
            }
            title={item.label}
          >
            {({ isActive }) => (
              <>
                <Icon icon={item.icon} size="md" />
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-accent-cyan rounded-r" />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

    </aside>
  )
}
