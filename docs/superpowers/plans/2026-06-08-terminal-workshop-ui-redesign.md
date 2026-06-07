# Terminal Workshop UI 重新设计实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将前端 UI 从浅色 B2B SaaS 风格转变为深色终端工坊风，提升专业感和视觉识别度

**Architecture:** 基于 CSS 变量系统的深色主题，采用 JetBrains Mono + Inter 字体组合，引入 Lucide Icons 图标库，重构 AppShell 为三栏布局（活动栏 + 侧边栏 + 主内容区）

**Tech Stack:** React 19, Tailwind CSS 3, Lucide Icons, CSS Custom Properties

---

## 文件结构

### 新增文件

| 文件路径 | 职责 |
|----------|------|
| `packages/review-app/src/components/ui/icon.tsx` | Icon 组件封装 |
| `packages/review-app/src/components/ui/status-badge.tsx` | 状态徽章组件 |
| `packages/review-app/src/components/ui/progress-bar.tsx` | 进度条组件 |
| `packages/review-app/src/components/ui/icon-button.tsx` | 图标按钮组件 |
| `packages/review-app/src/components/ui/section-label.tsx` | 终端风格 Section 标签 |
| `packages/review-app/src/components/layout/activity-bar.tsx` | 活动栏组件 |
| `packages/review-app/src/styles/animations.css` | 动画样式 |

### 修改文件

| 文件路径 | 职责 |
|----------|------|
| `packages/review-app/src/styles/globals.css` | 全局样式和 CSS 变量 |
| `packages/review-app/tailwind.config.ts` | Tailwind 主题配置 |
| `packages/review-app/src/components/layout/app-shell.tsx` | 全局布局 |
| `packages/review-app/src/components/session/finding-card.tsx` | Finding 卡片 |
| `packages/review-app/src/components/session/session-progress.tsx` | 会话进度 |
| `packages/review-app/src/components/session/risk-file-list.tsx` | 风险文件列表 |
| `packages/review-app/src/components/session/finding-list.tsx` | Finding 列表 |
| `packages/review-app/src/components/session/diff-empty-state.tsx` | 空状态 |
| `packages/review-app/src/components/diff/monaco-diff-viewer.tsx` | Diff 查看器 |
| `packages/review-app/src/components/launch/launch-review-form.tsx` | 启动表单 |
| `packages/review-app/src/components/launch/repository-picker.tsx` | 仓库选择器 |
| `packages/review-app/src/components/launch/branch-selector.tsx` | 分支选择器 |
| `packages/review-app/src/pages/review-launch-page.tsx` | 启动页 |
| `packages/review-app/src/pages/session-history-page.tsx` | 历史页 |
| `packages/review-app/src/pages/review-session-page.tsx` | 审查页 |

---

## Task 1: 安装依赖

**Files:**
- Modify: `packages/review-app/package.json`

- [ ] **Step 1: 安装 lucide-react**

```bash
cd /Users/jinminrui/Desktop/code-review-agent
pnpm --filter @app/review-app add lucide-react
```

- [ ] **Step 2: 验证安装**

```bash
pnpm --filter @app/review-app list lucide-react
```

Expected: 显示 lucide-react 版本信息

- [ ] **Step 3: Commit**

```bash
git add packages/review-app/package.json pnpm-lock.yaml
git commit -m "chore: add lucide-react icon library"
```

---

## Task 2: 更新 CSS 变量系统

**Files:**
- Modify: `packages/review-app/src/styles/globals.css`

- [ ] **Step 1: 备份当前 globals.css**

```bash
cp /Users/jinminrui/Desktop/code-review-agent/packages/review-app/src/styles/globals.css /Users/jinminrui/Desktop/code-review-agent/packages/review-app/src/styles/globals.css.backup
```

- [ ] **Step 2: 替换 globals.css 内容**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  color-scheme: dark;

  /* ===== 基底色 ===== */
  --bg-base: #0D1117;
  --bg-surface: #161B22;
  --bg-elevated: #1C2128;
  --bg-overlay: #21262D;
  --bg-input: #0D1117;

  /* ===== 文字色 ===== */
  --text-primary: #E6EDF3;
  --text-secondary: #8B949E;
  --text-tertiary: #6E7681;
  --text-disabled: #484F58;
  --text-on-accent: #FFFFFF;

  /* ===== 强调色 ===== */
  --accent-cyan: #56D4DD;
  --accent-cyan-muted: #3BA8B0;
  --accent-cyan-subtle: rgba(86, 212, 221, 0.15);
  --accent-green: #3FB950;
  --accent-red: #F85149;
  --accent-amber: #D29922;
  --accent-purple: #BC8CFF;
  --accent-blue: #58A6FF;

  /* ===== 边框色 ===== */
  --border-default: #30363D;
  --border-muted: #21262D;
  --border-subtle: #1B1F25;
  --border-accent: rgba(86, 212, 221, 0.4);

  /* ===== 阴影 ===== */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.4);
  --shadow-lg: 0 12px 40px rgba(0, 0, 0, 0.5);
  --shadow-glow-cyan: 0 0 20px rgba(86, 212, 221, 0.15);
  --shadow-glow-red: 0 0 20px rgba(248, 81, 73, 0.2);
  --shadow-inset: inset 0 1px 0 rgba(255, 255, 255, 0.03);

  /* ===== 字体 ===== */
  --font-mono: 'JetBrains Mono', 'Fira Code', 'SF Mono', 'Cascadia Code', 'Consolas', monospace;
  --font-sans: 'Inter', 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-cjk: 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Noto Sans CJK SC';
}

/* ===== 全局样式 ===== */
body {
  margin: 0;
  padding: 0;
  font-family: var(--font-sans), var(--font-cjk);
  font-size: 14px;
  line-height: 1.5;
  color: var(--text-primary);
  background-color: var(--bg-base);
  background-image:
    linear-gradient(rgba(86, 212, 221, 0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(86, 212, 221, 0.03) 1px, transparent 1px),
    radial-gradient(ellipse at 0% 0%, rgba(86, 212, 221, 0.08) 0%, transparent 50%),
    radial-gradient(ellipse at 100% 100%, rgba(188, 140, 255, 0.05) 0%, transparent 50%);
  background-size:
    24px 24px,
    24px 24px,
    100% 100%,
    100% 100%;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* ===== 代码字体 ===== */
code, pre, .font-mono {
  font-family: var(--font-mono), var(--font-cjk);
}

/* ===== 滚动条 ===== */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: var(--bg-base);
}

::-webkit-scrollbar-thumb {
  background: var(--border-default);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--text-disabled);
}

/* ===== 选中高亮 ===== */
::selection {
  background: rgba(86, 212, 221, 0.3);
  color: var(--text-primary);
}

/* ===== 焦点样式 ===== */
:focus-visible {
  outline: 2px solid var(--accent-cyan);
  outline-offset: 2px;
}

/* ===== 图标尺寸 ===== */
.icon-xs { width: 14px; height: 14px; }
.icon-sm { width: 16px; height: 16px; }
.icon-md { width: 20px; height: 20px; }
.icon-lg { width: 24px; height: 24px; }
.icon-xl { width: 32px; height: 32px; }

/* ===== 图标动画 ===== */
.icon-spin {
  animation: spin 1s linear infinite;
}

.icon-pulse {
  animation: pulse 2s ease-in-out infinite;
}

.icon-danger-pulse {
  animation: danger-pulse 3s ease-in-out infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

@keyframes danger-pulse {
  0%, 100% {
    filter: drop-shadow(0 0 4px rgba(248, 81, 73, 0.3));
  }
  50% {
    filter: drop-shadow(0 0 8px rgba(248, 81, 73, 0.5));
  }
}

/* ===== 终端风格标签 ===== */
.section-label {
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.05em;
  color: var(--text-tertiary);
  text-transform: uppercase;
  display: flex;
  align-items: center;
  gap: 6px;
}

.section-label .prompt {
  color: var(--accent-cyan);
}

.section-label .command {
  color: var(--text-secondary);
}

.section-label .count-badge {
  color: var(--text-tertiary);
  padding: 1px 6px;
  background: var(--accent-cyan-subtle);
  border-radius: 4px;
  font-size: 10px;
}

/* ===== Monaco 编辑器主题覆盖 ===== */
.monaco-editor .margin {
  background: var(--bg-base) !important;
}

.monaco-editor .line-numbers {
  color: var(--text-disabled) !important;
}

.monaco-editor .inline-added {
  background: rgba(63, 185, 80, 0.15) !important;
}

.monaco-editor .inline-removed {
  background: rgba(248, 81, 73, 0.15) !important;
}

.review-finding-line {
  background: rgba(86, 212, 221, 0.1) !important;
}

.review-finding-gutter {
  background: var(--accent-cyan) !important;
}

/* ===== 页面转场动画 ===== */
@keyframes page-enter {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.page-content {
  animation: page-enter 0.3s ease-out;
}

/* ===== 高危脉冲动画 ===== */
@keyframes high-risk-pulse {
  0%, 100% {
    box-shadow: -4px 0 12px rgba(248, 81, 73, 0.2);
  }
  50% {
    box-shadow: -4px 0 20px rgba(248, 81, 73, 0.35);
  }
}

/* ===== 进度条发光动画 ===== */
@keyframes progress-glow {
  0%, 100% {
    box-shadow: 0 0 8px rgba(86, 212, 221, 0.3);
  }
  50% {
    box-shadow: 0 0 16px rgba(86, 212, 221, 0.5);
  }
}

/* ===== 终端光标闪烁 ===== */
@keyframes cursor-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

.cursor-blink {
  animation: cursor-blink 1s step-end infinite;
}
```

- [ ] **Step 3: 删除备份文件**

```bash
rm /Users/jinminrui/Desktop/code-review-agent/packages/review-app/src/styles/globals.css.backup
```

- [ ] **Step 4: Commit**

```bash
git add packages/review-app/src/styles/globals.css
git commit -m "feat: replace CSS variables with terminal workshop dark theme"
```

---

## Task 3: 更新 Tailwind 配置

**Files:**
- Modify: `packages/review-app/tailwind.config.ts`

- [ ] **Step 1: 替换 tailwind.config.ts 内容**

```typescript
import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // 基底色
        'bg-base': 'var(--bg-base)',
        'bg-surface': 'var(--bg-surface)',
        'bg-elevated': 'var(--bg-elevated)',
        'bg-overlay': 'var(--bg-overlay)',
        'bg-input': 'var(--bg-input)',

        // 文字色
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        'text-tertiary': 'var(--text-tertiary)',
        'text-disabled': 'var(--text-disabled)',
        'text-on-accent': 'var(--text-on-accent)',

        // 强调色
        'accent-cyan': 'var(--accent-cyan)',
        'accent-cyan-muted': 'var(--accent-cyan-muted)',
        'accent-cyan-subtle': 'var(--accent-cyan-subtle)',
        'accent-green': 'var(--accent-green)',
        'accent-red': 'var(--accent-red)',
        'accent-amber': 'var(--accent-amber)',
        'accent-purple': 'var(--accent-purple)',
        'accent-blue': 'var(--accent-blue)',

        // 边框色
        'border-default': 'var(--border-default)',
        'border-muted': 'var(--border-muted)',
        'border-subtle': 'var(--border-subtle)',
        'border-accent': 'var(--border-accent)',
      },
      fontFamily: {
        mono: ['var(--font-mono)'],
        sans: ['var(--font-sans)'],
      },
      boxShadow: {
        'glow-cyan': 'var(--shadow-glow-cyan)',
        'glow-red': 'var(--shadow-glow-red)',
        'inset-light': 'var(--shadow-inset)',
      },
      animation: {
        'pulse-border': 'high-risk-pulse 3s ease-in-out infinite',
        'glow': 'progress-glow 2s ease-in-out infinite',
        'cursor-blink': 'cursor-blink 1s step-end infinite',
        'spin-slow': 'spin 2s linear infinite',
      },
      keyframes: {
        'high-risk-pulse': {
          '0%, 100%': { boxShadow: '-4px 0 12px rgba(248, 81, 73, 0.2)' },
          '50%': { boxShadow: '-4px 0 20px rgba(248, 81, 73, 0.35)' },
        },
        'progress-glow': {
          '0%, 100%': { boxShadow: '0 0 8px rgba(86, 212, 221, 0.3)' },
          '50%': { boxShadow: '0 0 16px rgba(86, 212, 221, 0.5)' },
        },
        'cursor-blink': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
      },
    },
  },
  plugins: [],
} satisfies Config
```

- [ ] **Step 2: Commit**

```bash
git add packages/review-app/tailwind.config.ts
git commit -m "feat: update Tailwind config with terminal workshop theme"
```

---

## Task 4: 创建 Icon 组件

**Files:**
- Create: `packages/review-app/src/components/ui/icon.tsx`

- [ ] **Step 1: 创建 Icon 组件**

```tsx
import { type LucideIcon, type LucideProps } from 'lucide-react'
import { cn } from '@/lib/utils'

interface IconProps extends LucideProps {
  icon: LucideIcon
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  variant?: 'default' | 'muted' | 'accent' | 'success' | 'warning' | 'danger'
  spin?: boolean
  pulse?: boolean
}

const sizeClasses = {
  xs: 'w-3.5 h-3.5',
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
  xl: 'w-8 h-8',
}

const variantClasses = {
  default: 'text-text-secondary',
  muted: 'text-text-tertiary',
  accent: 'text-accent-cyan',
  success: 'text-accent-green',
  warning: 'text-accent-amber',
  danger: 'text-accent-red',
}

export function Icon({
  icon: IconComponent,
  size = 'md',
  variant = 'default',
  spin = false,
  pulse = false,
  className,
  ...props
}: IconProps) {
  return (
    <IconComponent
      className={cn(
        sizeClasses[size],
        variantClasses[variant],
        spin && 'animate-spin',
        pulse && 'animate-pulse',
        className
      )}
      {...props}
    />
  )
}
```

- [ ] **Step 2: 创建 cn 工具函数（如果不存在）**

检查 `packages/review-app/src/lib/utils.ts` 是否存在，如果不存在则创建：

```typescript
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

如果需要创建，先安装依赖：

```bash
pnpm --filter @app/review-app add clsx tailwind-merge
```

- [ ] **Step 3: Commit**

```bash
git add packages/review-app/src/components/ui/icon.tsx
git commit -m "feat: create Icon component with Lucide integration"
```

---

## Task 5: 创建 UI 基础组件

**Files:**
- Create: `packages/review-app/src/components/ui/status-badge.tsx`
- Create: `packages/review-app/src/components/ui/progress-bar.tsx`
- Create: `packages/review-app/src/components/ui/icon-button.tsx`
- Create: `packages/review-app/src/components/ui/section-label.tsx`

- [ ] **Step 1: 创建 StatusBadge 组件**

```tsx
import { cn } from '@/lib/utils'
import { Icon } from './icon'
import { type LucideIcon, CheckCircle2, XCircle, AlertTriangle, Info, Loader2, Circle, CircleDot } from 'lucide-react'

type Severity = 'high' | 'medium' | 'low'
type Status = 'finished' | 'failed' | 'running' | 'pending'

interface StatusBadgeProps {
  severity?: Severity
  status?: Status
  label: string
  className?: string
}

const severityConfig = {
  high: {
    background: 'bg-[rgba(248,81,73,0.1)]',
    text: 'text-accent-red',
    icon: AlertTriangle as LucideIcon,
  },
  medium: {
    background: 'bg-[rgba(210,153,34,0.1)]',
    text: 'text-accent-amber',
    icon: AlertTriangle as LucideIcon,
  },
  low: {
    background: 'bg-[rgba(110,118,129,0.1)]',
    text: 'text-text-tertiary',
    icon: Info as LucideIcon,
  },
}

const statusConfig = {
  finished: {
    background: 'bg-[rgba(63,185,80,0.1)]',
    text: 'text-accent-green',
    icon: CheckCircle2 as LucideIcon,
  },
  failed: {
    background: 'bg-[rgba(248,81,73,0.1)]',
    text: 'text-accent-red',
    icon: XCircle as LucideIcon,
  },
  running: {
    background: 'bg-[rgba(86,212,221,0.1)]',
    text: 'text-accent-cyan',
    icon: Loader2 as LucideIcon,
    spin: true,
  },
  pending: {
    background: 'bg-[rgba(110,118,129,0.1)]',
    text: 'text-text-disabled',
    icon: Circle as LucideIcon,
  },
}

export function StatusBadge({ severity, status, label, className }: StatusBadgeProps) {
  const config = severity ? severityConfig[severity] : status ? statusConfig[status] : null

  if (!config) return null

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 h-5 px-2 rounded font-mono text-[11px] font-medium tracking-wider uppercase',
        config.background,
        config.text,
        className
      )}
    >
      <Icon
        icon={config.icon}
        size="xs"
        className={cn(
          'running' in config && config.spin && 'icon-spin'
        )}
      />
      {label}
    </span>
  )
}
```

- [ ] **Step 2: 创建 ProgressBar 组件**

```tsx
import { cn } from '@/lib/utils'

interface ProgressBarProps {
  value: number
  max?: number
  className?: string
}

export function ProgressBar({ value, max = 100, className }: ProgressBarProps) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100)

  return (
    <div
      className={cn(
        'h-1.5 bg-bg-overlay rounded-full overflow-hidden',
        className
      )}
    >
      <div
        className="h-full rounded-full transition-all duration-300 ease-out animate-glow"
        style={{
          width: `${percentage}%`,
          background: 'linear-gradient(90deg, var(--accent-cyan-muted), var(--accent-cyan))',
        }}
      />
    </div>
  )
}
```

- [ ] **Step 3: 创建 IconButton 组件**

```tsx
import { cn } from '@/lib/utils'
import { type ButtonHTMLAttributes, forwardRef } from 'react'

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'ghost' | 'danger'
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ variant = 'default', className, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center w-8 h-8 rounded-md border border-transparent transition-all duration-150 ease-out',
          'text-text-tertiary hover:text-text-secondary',
          variant === 'default' && 'hover:bg-bg-elevated hover:border-border-default',
          variant === 'ghost' && 'hover:bg-bg-elevated',
          variant === 'danger' && 'hover:text-accent-red hover:bg-[rgba(248,81,73,0.1)] hover:border-[rgba(248,81,73,0.3)]',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          className
        )}
        {...props}
      />
    )
  }
)

IconButton.displayName = 'IconButton'
```

- [ ] **Step 4: 创建 SectionLabel 组件**

```tsx
import { cn } from '@/lib/utils'
import { type LucideIcon } from 'lucide-react'
import { Icon } from './icon'

interface SectionLabelProps {
  icon?: LucideIcon
  command: string
  count?: number
  className?: string
}

export function SectionLabel({ icon, command, count, className }: SectionLabelProps) {
  return (
    <div className={cn('section-label', className)}>
      <span className="prompt">$</span>
      {icon && <Icon icon={icon} size="xs" />}
      <span className="command">{command}</span>
      {count !== undefined && (
        <span className="count-badge">{count}</span>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add packages/review-app/src/components/ui/
git commit -m "feat: create UI base components (StatusBadge, ProgressBar, IconButton, SectionLabel)"
```

---

## Task 6: 创建 ActivityBar 组件

**Files:**
- Create: `packages/review-app/src/components/layout/activity-bar.tsx`

- [ ] **Step 1: 创建 ActivityBar 组件**

```tsx
import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { Icon } from '@/components/ui/icon'
import { Home, Play, Clock, Settings } from 'lucide-react'

interface ActivityBarItem {
  to: string
  icon: typeof Home
  label: string
}

const topItems: ActivityBarItem[] = [
  { to: '/', icon: Home, label: '首页' },
  { to: '/', icon: Play, label: '启动审查' },
  { to: '/sessions', icon: Clock, label: '历史记录' },
]

const bottomItems: ActivityBarItem[] = [
  { to: '/settings', icon: Settings, label: '设置' },
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

      {/* 分隔线 */}
      <div className="w-6 h-px bg-border-muted mb-4" />

      {/* 底部导航 */}
      <nav className="flex flex-col items-center gap-1">
        {bottomItems.map((item) => (
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
            <Icon icon={item.icon} size="md" />
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/review-app/src/components/layout/activity-bar.tsx
git commit -m "feat: create ActivityBar component with navigation icons"
```

---

## Task 7: 重构 AppShell 布局

**Files:**
- Modify: `packages/review-app/src/components/layout/app-shell.tsx`

- [ ] **Step 1: 读取当前 app-shell.tsx**

```bash
cat /Users/jinminrui/Desktop/code-review-agent/packages/review-app/src/components/layout/app-shell.tsx
```

- [ ] **Step 2: 替换为新的三栏布局**

```tsx
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
```

- [ ] **Step 3: Commit**

```bash
git add packages/review-app/src/components/layout/app-shell.tsx
git commit -m "refactor: AppShell to use ActivityBar for three-column layout"
```

---

## Task 8: 更新启动页

**Files:**
- Modify: `packages/review-app/src/pages/review-launch-page.tsx`
- Modify: `packages/review-app/src/components/launch/launch-review-form.tsx`
- Modify: `packages/review-app/src/components/launch/repository-picker.tsx`
- Modify: `packages/review-app/src/components/launch/branch-selector.tsx`

- [ ] **Step 1: 更新 review-launch-page.tsx**

```tsx
import { LaunchReviewForm } from '@/components/launch/launch-review-form'

export function ReviewLaunchPage() {
  return (
    <div className="min-h-screen bg-bg-base flex items-center justify-center p-8">
      <LaunchReviewForm />
    </div>
  )
}
```

- [ ] **Step 2: 更新 launch-review-form.tsx**

```tsx
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
```

- [ ] **Step 3: 更新 repository-picker.tsx**

```tsx
import { cn } from '@/lib/utils'
import { Icon } from '@/components/ui/icon'
import { ChevronDown } from 'lucide-react'

interface RepositoryPickerProps {
  value: string
  onChange: (value: string) => void
}

export function RepositoryPicker({ value, onChange }: RepositoryPickerProps) {
  // TODO: 从后端获取仓库列表
  const repositories = [
    { id: '1', name: 'my-project', path: '/Users/dev/my-project' },
    { id: '2', name: 'another-project', path: '/Users/dev/another-project' },
  ]

  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'w-full h-10 px-3 pr-8 rounded-md appearance-none cursor-pointer',
          'bg-bg-input border border-border-default text-text-primary font-mono text-sm',
          'focus:outline-none focus:border-accent-cyan focus:ring-1 focus:ring-accent-cyan-subtle',
          'transition-colors duration-150'
        )}
      >
        <option value="">选择仓库...</option>
        {repositories.map((repo) => (
          <option key={repo.id} value={repo.id}>
            {repo.path}
          </option>
        ))}
      </select>
      <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
        <Icon icon={ChevronDown} size="sm" variant="muted" />
      </div>
    </div>
  )
}
```

- [ ] **Step 4: 更新 branch-selector.tsx**

```tsx
import { cn } from '@/lib/utils'
import { Icon } from '@/components/ui/icon'
import { ChevronDown, GitBranch } from 'lucide-react'

interface BranchSelectorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export function BranchSelector({ value, onChange, placeholder = '选择分支' }: BranchSelectorProps) {
  // TODO: 从后端获取分支列表
  const branches = ['main', 'develop', 'feature/auth', 'feature/api']

  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'w-full h-10 px-3 pr-8 rounded-md appearance-none cursor-pointer',
          'bg-bg-input border border-border-default text-text-primary font-mono text-sm',
          'focus:outline-none focus:border-accent-cyan focus:ring-1 focus:ring-accent-cyan-subtle',
          'transition-colors duration-150'
        )}
      >
        <option value="">{placeholder}</option>
        {branches.map((branch) => (
          <option key={branch} value={branch}>
            {branch}
          </option>
        ))}
      </select>
      <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
        <Icon icon={ChevronDown} size="sm" variant="muted" />
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add packages/review-app/src/pages/review-launch-page.tsx packages/review-app/src/components/launch/
git commit -m "feat: update launch page with terminal workshop styling"
```

---

## Task 9: 更新历史页

**Files:**
- Modify: `packages/review-app/src/pages/session-history-page.tsx`

- [ ] **Step 1: 更新 session-history-page.tsx**

```tsx
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { Icon } from '@/components/ui/icon'
import { SectionLabel } from '@/components/ui/section-label'
import { StatusBadge } from '@/components/ui/status-badge'
import { Clock, GitBranch, Folder, FileText, AlertTriangle } from 'lucide-react'

interface Session {
  id: string
  baseRef: string
  targetRef: string
  repoPath: string
  status: 'finished' | 'failed' | 'running'
  changedFiles: number
  findings: number
  highRisk: number
  createdAt: string
}

export function SessionHistoryPage() {
  // TODO: 从后端获取会话列表
  const sessions: Session[] = []

  return (
    <div className="min-h-screen bg-bg-base p-8">
      <div className="max-w-3xl mx-auto">
        {/* 标题 */}
        <div className="mb-8">
          <SectionLabel command="review-history" />
        </div>

        {/* 会话列表 */}
        {sessions.length === 0 ? (
          <div className="empty-state-terminal">
            <div className="text-center">
              <Icon icon={Clock} size="xl" variant="muted" className="mx-auto mb-4" />
              <p className="text-text-tertiary">暂无审查记录</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <SectionLabel command="recent-sessions" count={sessions.length} />

            {sessions.map((session) => (
              <Link
                key={session.id}
                to={`/sessions/${session.id}`}
                className={cn(
                  'block p-4 rounded-lg border border-border-default bg-bg-surface',
                  'hover:bg-bg-elevated hover:border-border-accent hover:shadow-glow-cyan',
                  'transition-all duration-150'
                )}
              >
                {/* 分支信息 */}
                <div className="flex items-center gap-2 mb-2">
                  <Icon icon={GitBranch} size="sm" variant="accent" />
                  <span className="font-mono text-sm text-text-primary">
                    {session.baseRef} → {session.targetRef}
                  </span>
                </div>

                {/* 仓库路径 */}
                <div className="flex items-center gap-2 mb-2">
                  <Icon icon={Folder} size="sm" variant="muted" />
                  <span className="font-mono text-xs text-text-tertiary">
                    {session.repoPath}
                  </span>
                </div>

                {/* 时间和状态 */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Icon icon={Clock} size="sm" variant="muted" />
                    <span className="text-xs text-text-tertiary">
                      {session.createdAt}
                    </span>
                  </div>
                  <StatusBadge status={session.status} label={session.status.toUpperCase()} />
                </div>

                {/* 分隔线 */}
                <div className="h-px bg-border-muted mb-3" />

                {/* 统计信息 */}
                <div className="flex items-center gap-4 text-xs">
                  <div className="flex items-center gap-1.5">
                    <Icon icon={FileText} size="xs" variant="muted" />
                    <span className="text-text-secondary">{session.changedFiles} files</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Icon icon={AlertTriangle} size="xs" variant="warning" />
                    <span className="text-text-secondary">{session.findings} findings</span>
                  </div>
                  {session.highRisk > 0 && (
                    <div className="flex items-center gap-1.5">
                      <Icon icon={AlertTriangle} size="xs" variant="danger" />
                      <span className="text-accent-red">{session.highRisk} high</span>
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/review-app/src/pages/session-history-page.tsx
git commit -m "feat: update session history page with terminal workshop styling"
```

---

## Task 10: 更新审查页侧边栏组件

**Files:**
- Modify: `packages/review-app/src/components/session/session-progress.tsx`
- Modify: `packages/review-app/src/components/session/risk-file-list.tsx`
- Modify: `packages/review-app/src/components/session/finding-list.tsx`
- Modify: `packages/review-app/src/components/session/finding-card.tsx`
- Modify: `packages/review-app/src/components/session/review-summary-panel.tsx`
- Modify: `packages/review-app/src/components/session/diff-empty-state.tsx`

- [ ] **Step 1: 更新 session-progress.tsx**

```tsx
import { cn } from '@/lib/utils'
import { Icon } from '@/components/ui/icon'
import { ProgressBar } from '@/components/ui/progress-bar'
import { SectionLabel } from '@/components/ui/section-label'
import { StatusBadge } from '@/components/ui/status-badge'
import { Loader2, FileText } from 'lucide-react'

interface SessionProgressProps {
  status: string
  completedUnits: number
  totalUnits: number
}

export function SessionProgress({ status, completedUnits, totalUnits }: SessionProgressProps) {
  const percentage = totalUnits > 0 ? Math.round((completedUnits / totalUnits) * 100) : 0
  const isRunning = status === 'running' || status === 'streaming'

  return (
    <div className="p-4 border-b border-border-muted">
      <SectionLabel command="session-status" className="mb-3" />

      {/* 状态和进度 */}
      <div className="space-y-3">
        {/* 状态标签 */}
        <div className="flex items-center gap-2">
          {isRunning ? (
            <Icon icon={Loader2} size="sm" variant="accent" spin />
          ) : null}
          <StatusBadge
            status={status as any}
            label={status.toUpperCase()}
          />
        </div>

        {/* 进度条 */}
        <ProgressBar value={percentage} />

        {/* 单元计数 */}
        <div className="flex items-center gap-2 text-xs text-text-tertiary">
          <Icon icon={FileText} size="xs" variant="muted" />
          <span>{completedUnits}/{totalUnits} units complete</span>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 更新 risk-file-list.tsx**

```tsx
import { cn } from '@/lib/utils'
import { Icon } from '@/components/ui/icon'
import { SectionLabel } from '@/components/ui/section-label'
import { FileText } from 'lucide-react'

interface RiskFileListProps {
  files: string[]
}

export function RiskFileList({ files }: RiskFileListProps) {
  if (files.length === 0) return null

  return (
    <div className="p-4 border-b border-border-muted">
      <SectionLabel command="risk-files" count={files.length} className="mb-3" />

      <div className="space-y-1">
        {files.map((file) => (
          <div
            key={file}
            className={cn(
              'flex items-center gap-2 px-2 py-1.5 rounded',
              'text-xs font-mono text-text-secondary',
              'hover:bg-bg-elevated transition-colors duration-150'
            )}
          >
            <Icon icon={FileText} size="sm" variant="muted" />
            <span className="truncate">{file}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: 更新 finding-card.tsx**

```tsx
import { cn } from '@/lib/utils'
import { Icon } from '@/components/ui/icon'
import { StatusBadge } from '@/components/ui/status-badge'
import { AlertTriangle, Lock, Bug, Shield, Zap, FileText, MessageSquare } from 'lucide-react'
import type { ReviewFinding } from '@/lib/review-model'

interface FindingCardProps {
  finding: ReviewFinding
  isSelected: boolean
  onClick: () => void
}

const categoryIcons = {
  security: Shield,
  bug: Bug,
  performance: Zap,
  style: FileText,
  default: AlertTriangle,
}

export function FindingCard({ finding, isSelected, onClick }: FindingCardProps) {
  const CategoryIcon = categoryIcons[finding.category as keyof typeof categoryIcons] || categoryIcons.default

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left p-3 rounded-md border transition-all duration-150',
        'bg-bg-surface border-border-default',
        isSelected
          ? 'border-accent-cyan bg-bg-elevated shadow-[inset_0_0_0_1px_var(--border-accent)]'
          : 'hover:bg-bg-elevated hover:border-border-accent hover:shadow-glow-cyan hover:-translate-y-px',
        finding.severity === 'high' && 'animate-pulse-border'
      )}
      style={{
        borderLeftWidth: '3px',
        borderLeftColor: finding.severity === 'high'
          ? 'var(--accent-red)'
          : finding.severity === 'medium'
          ? 'var(--accent-amber)'
          : 'var(--text-tertiary)',
      }}
    >
      {/* 标题行 */}
      <div className="flex items-start gap-2 mb-2">
        <Icon
          icon={CategoryIcon}
          size="sm"
          variant={finding.severity === 'high' ? 'danger' : finding.severity === 'medium' ? 'warning' : 'muted'}
        />
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-text-primary truncate">
            {finding.title}
          </h3>
        </div>
        <StatusBadge
          severity={finding.severity}
          label={finding.severity.toUpperCase()}
        />
      </div>

      {/* 文件路径 */}
      <div className="flex items-center gap-1.5 mb-2 ml-6">
        <Icon icon={FileText} size="xs" variant="muted" />
        <span className="text-xs font-mono text-text-tertiary truncate">
          {finding.file}:{finding.startLine}-{finding.endLine}
        </span>
      </div>

      {/* 证据预览 */}
      {finding.evidence && (
        <div className="ml-6 mt-2 p-2 rounded bg-bg-base border border-border-subtle">
          <div className="flex items-start gap-1.5">
            <Icon icon={MessageSquare} size="xs" variant="accent" className="mt-0.5 flex-shrink-0" />
            <p className="text-xs text-text-tertiary line-clamp-2 font-mono">
              {finding.evidence}
            </p>
          </div>
        </div>
      )}
    </button>
  )
}
```

- [ ] **Step 4: 更新 finding-list.tsx**

```tsx
import { cn } from '@/lib/utils'
import { Icon } from '@/components/ui/icon'
import { SectionLabel } from '@/components/ui/section-label'
import { FindingCard } from './finding-card'
import { AlertTriangle } from 'lucide-react'
import type { ReviewFinding } from '@/lib/review-model'

interface FindingListProps {
  findings: ReviewFinding[]
  selectedFindingId: string | null
  onSelectFinding: (id: string) => void
}

export function FindingList({ findings, selectedFindingId, onSelectFinding }: FindingListProps) {
  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      <div className="p-4 pb-2">
        <SectionLabel command="findings" count={findings.length} />
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
        {findings.length === 0 ? (
          <div className="text-center py-8">
            <Icon icon={AlertTriangle} size="lg" variant="muted" className="mx-auto mb-2" />
            <p className="text-sm text-text-tertiary">暂无发现</p>
          </div>
        ) : (
          findings.map((finding) => (
            <FindingCard
              key={finding.findingId}
              finding={finding}
              isSelected={finding.findingId === selectedFindingId}
              onClick={() => onSelectFinding(finding.findingId)}
            />
          ))
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: 更新 review-summary-panel.tsx**

```tsx
import { cn } from '@/lib/utils'
import { Icon } from '@/components/ui/icon'
import { SectionLabel } from '@/components/ui/section-label'
import { FileText, AlertTriangle, Shield } from 'lucide-react'

interface ReviewSummaryPanelProps {
  changedFiles: number
  findings: number
  highRisk: number
}

export function ReviewSummaryPanel({ changedFiles, findings, highRisk }: ReviewSummaryPanelProps) {
  return (
    <div className="p-4 border-b border-border-muted">
      <SectionLabel command="session-summary" className="mb-3" />

      <div className="grid grid-cols-3 gap-3">
        {/* 变更文件 */}
        <div className="text-center p-2 rounded-md bg-bg-base">
          <Icon icon={FileText} size="md" variant="muted" className="mx-auto mb-1" />
          <div className="text-lg font-semibold text-text-primary">{changedFiles}</div>
          <div className="text-xs text-text-tertiary">files</div>
        </div>

        {/* 发现数量 */}
        <div className="text-center p-2 rounded-md bg-bg-base">
          <Icon icon={AlertTriangle} size="md" variant="warning" className="mx-auto mb-1" />
          <div className="text-lg font-semibold text-text-primary">{findings}</div>
          <div className="text-xs text-text-tertiary">findings</div>
        </div>

        {/* 高危数量 */}
        <div className="text-center p-2 rounded-md bg-bg-base">
          <Icon icon={Shield} size="md" variant="danger" className="mx-auto mb-1" />
          <div className="text-lg font-semibold text-accent-red">{highRisk}</div>
          <div className="text-xs text-text-tertiary">high</div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: 更新 diff-empty-state.tsx**

```tsx
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
          <span>Choose a finding from the sidebar to start review</span>
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
```

- [ ] **Step 7: Commit**

```bash
git add packages/review-app/src/components/session/
git commit -m "feat: update session components with terminal workshop styling"
```

---

## Task 11: 更新审查页

**Files:**
- Modify: `packages/review-app/src/pages/review-session-page.tsx`

- [ ] **Step 1: 更新 review-session-page.tsx**

```tsx
import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useReviewSessionStore } from '@/store/review-session-store'
import { useReviewSessionStream } from '@/hooks/use-review-session-stream'
import { SessionProgress } from '@/components/session/session-progress'
import { ReviewSummaryPanel } from '@/components/session/review-summary-panel'
import { RiskFileList } from '@/components/session/risk-file-list'
import { FindingList } from '@/components/session/finding-list'
import { MonacoDiffViewer } from '@/components/diff/monaco-diff-viewer'
import { DiffEmptyState } from '@/components/session/diff-empty-state'

export function ReviewSessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const { session, selectedFindingId, setSelectedFindingId } = useReviewSessionStore()

  // 订阅会话流
  useReviewSessionStream(sessionId || '')

  // 自动选择第一个 finding
  useEffect(() => {
    if (session?.findings?.length && !selectedFindingId) {
      setSelectedFindingId(session.findings[0].findingId)
    }
  }, [session, selectedFindingId, setSelectedFindingId])

  if (!session) {
    return (
      <div className="min-h-screen bg-bg-base flex items-center justify-center">
        <div className="text-text-tertiary">加载中...</div>
      </div>
    )
  }

  const selectedFinding = session.findings.find(f => f.findingId === selectedFindingId)

  return (
    <div className="h-screen flex overflow-hidden">
      {/* 侧边栏 */}
      <aside className="w-80 h-full bg-bg-surface border-r border-border-default flex flex-col overflow-hidden">
        {/* 会话进度 */}
        <SessionProgress
          status={session.status}
          completedUnits={session.completedUnits}
          totalUnits={session.totalUnits}
        />

        {/* 审查摘要 */}
        <ReviewSummaryPanel
          changedFiles={session.changedFiles}
          findings={session.findings.length}
          highRisk={session.highRiskCount}
        />

        {/* 风险文件列表 */}
        <RiskFileList files={session.riskFiles} />

        {/* Finding 列表 */}
        <FindingList
          findings={session.findings}
          selectedFindingId={selectedFindingId}
          onSelectFinding={setSelectedFindingId}
        />
      </aside>

      {/* 主内容区 */}
      <main className="flex-1 min-w-0 overflow-hidden">
        {selectedFinding ? (
          <MonacoDiffViewer finding={selectedFinding} />
        ) : (
          <DiffEmptyState />
        )}
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/review-app/src/pages/review-session-page.tsx
git commit -m "feat: update review session page with terminal workshop layout"
```

---

## Task 12: 更新 Monaco Diff Viewer

**Files:**
- Modify: `packages/review-app/src/components/diff/monaco-diff-viewer.tsx`

- [ ] **Step 1: 更新 monaco-diff-viewer.tsx**

```tsx
import { useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Icon } from '@/components/ui/icon'
import { StatusBadge } from '@/components/ui/status-badge'
import { SectionLabel } from '@/components/ui/section-label'
import { DiffEditor } from '@monaco-editor/react'
import { Lock, FileText, MessageSquare, Lightbulb } from 'lucide-react'
import { useMonacoReveal } from '@/hooks/use-monaco-reveal'
import type { ReviewFinding } from '@/lib/review-model'

interface MonacoDiffViewerProps {
  finding: ReviewFinding
}

export function MonacoDiffViewer({ finding }: MonacoDiffViewerProps) {
  const editorRef = useRef<any>(null)

  // 使用 hook 处理行定位和装饰
  useMonacoReveal(editorRef, finding)

  const handleEditorDidMount = (editor: any) => {
    editorRef.current = editor
  }

  return (
    <div className="h-full flex flex-col bg-bg-base">
      {/* Finding 头部 */}
      <div className="p-4 border-b border-border-default bg-bg-surface">
        <SectionLabel command="finding" className="mb-3" />

        <div className="flex items-start gap-3">
          <Icon
            icon={Lock}
            size="lg"
            variant={finding.severity === 'high' ? 'danger' : finding.severity === 'medium' ? 'warning' : 'muted'}
          />
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-text-primary mb-1">
              {finding.title}
            </h2>
            <div className="flex items-center gap-2">
              <Icon icon={FileText} size="sm" variant="muted" />
              <span className="text-xs font-mono text-text-tertiary">
                {finding.file}:{finding.startLine}-{finding.endLine}
              </span>
            </div>
          </div>
          <StatusBadge severity={finding.severity} label={finding.severity.toUpperCase()} />
        </div>
      </div>

      {/* 证据和建议 */}
      {(finding.evidence || finding.suggestion) && (
        <div className="p-4 border-b border-border-default bg-bg-surface">
          <SectionLabel command="evidence" className="mb-3" />

          {finding.evidence && (
            <div className="mb-3">
              <div className="flex items-start gap-2">
                <Icon icon={MessageSquare} size="sm" variant="accent" className="mt-0.5 flex-shrink-0" />
                <p className="text-sm text-text-secondary leading-relaxed">
                  {finding.evidence}
                </p>
              </div>
            </div>
          )}

          {finding.suggestion && (
            <div className="pl-4 border-l-2 border-accent-cyan">
              <div className="flex items-start gap-2">
                <Icon icon={Lightbulb} size="sm" variant="accent" className="mt-0.5 flex-shrink-0" />
                <p className="text-sm text-text-secondary leading-relaxed">
                  {finding.suggestion}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Diff 编辑器 */}
      <div className="flex-1 min-h-0">
        <DiffEditor
          height="100%"
          language="typescript"
          theme="vs-dark"
          options={{
            readOnly: true,
            renderSideBySide: false,
            minimap: { enabled: false },
            lineNumbers: 'on',
            glyphMargin: true,
            folding: false,
            lineDecorationsWidth: 0,
            lineNumbersMinChars: 3,
          }}
          onMount={handleEditorDidMount}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/review-app/src/components/diff/monaco-diff-viewer.tsx
git commit -m "feat: update Monaco diff viewer with terminal workshop styling"
```

---

## Task 13: 类型检查和构建测试

**Files:**
- None (verification only)

- [ ] **Step 1: 运行类型检查**

```bash
cd /Users/jinminrui/Desktop/code-review-agent
pnpm typecheck
```

Expected: 无类型错误

- [ ] **Step 2: 修复任何类型错误**

根据错误信息修复代码中的类型问题。

- [ ] **Step 3: 运行构建**

```bash
pnpm build
```

Expected: 构建成功

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "fix: resolve type errors and ensure build passes"
```

---

## Task 14: 运行开发服务器测试

**Files:**
- None (verification only)

- [ ] **Step 1: 启动前端开发服务器**

```bash
cd /Users/jinminrui/Desktop/code-review-agent
pnpm dev:web
```

- [ ] **Step 2: 验证 UI 变更**

在浏览器中打开 http://localhost:5173，检查：
- [ ] 深色主题是否正确应用
- [ ] 活动栏是否显示
- [ ] 图标是否正确显示
- [ ] 字体是否正确（JetBrains Mono）
- [ ] 动画是否正常工作

- [ ] **Step 3: 停止开发服务器**

按 Ctrl+C 停止服务器。

- [ ] **Step 4: Commit（如有修复）**

```bash
git add -A
git commit -m "fix: address UI issues found during manual testing"
```

---

## Task 15: 最终提交

**Files:**
- None (final commit)

- [ ] **Step 1: 查看所有变更**

```bash
git status
git diff --stat
```

- [ ] **Step 2: 添加所有未提交的变更**

```bash
git add -A
```

- [ ] **Step 3: 最终提交**

```bash
git commit -m "feat: complete terminal workshop UI redesign

- Replace light theme with dark terminal workshop theme
- Add Lucide Icons integration
- Implement three-column layout with ActivityBar
- Update all components with new styling
- Add animations and micro-interactions
- Update Tailwind configuration
- Update CSS custom properties
"
```

---

## 完成

实施计划已完成！所有任务执行完毕后，前端 UI 将从浅色 B2B SaaS 风格成功转变为深色终端工坊风。

### 验收清单

- [ ] 深色主题正确应用
- [ ] JetBrains Mono + Inter 字体正确加载
- [ ] Lucide Icons 正确显示
- [ ] 活动栏导航功能正常
- [ ] 侧边栏布局正确
- [ ] Finding 卡片样式正确
- [ ] 状态徽章显示正确
- [ ] 进度条动画正常
- [ ] Monaco 编辑器主题正确
- [ ] 页面转场动画正常
- [ ] 响应式布局正常
- [ ] 类型检查通过
- [ ] 构建成功
