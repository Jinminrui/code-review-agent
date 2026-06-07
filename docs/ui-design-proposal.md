# 前端 UI 设计方案：终端工坊风 (Terminal Workshop)

## 文档信息

- **版本**: v2.0
- **最后更新**: 2026-06-08
- **状态**: 已确认

---

## 目录

- [设计哲学](#设计哲学)
- [色彩系统](#色彩系统)
- [字体系统](#字体系统)
- [布局系统](#布局系统)
- [组件规范](#组件规范)
- [动效系统](#动效系统)
- [背景与氛围](#背景与氛围)
- [图标系统](#图标系统)
  - [图标规范](#71-图标规范)
  - [图标尺寸系统](#72-图标尺寸系统)
  - [核心图标映射表](#73-核心图标映射表)
  - [图标使用规范](#74-图标使用规范)
  - [完整图标组件封装](#75-完整图标组件封装)
  - [图标在各组件中的应用](#76-图标在各组件中的应用)
  - [推荐图标库](#77-推荐图标库)
- [页面设计详解](#页面设计详解)
- [Tailwind 配置](#tailwind-配置)
- [CSS 变量完整定义](#css-变量完整定义)
- [实施计划](#实施计划)

---

## 设计哲学

### 核心理念

**"代码审查是一门手艺，工具应该体现这种专业性。"**

终端工坊风将代码审查工具的视觉语言锚定在开发者最熟悉的终端环境，营造"专业工匠工作台"的氛围。深色基底减少视觉疲劳，荧光强调色引导注意力，等宽字体强化代码属性。

### 设计原则

1. **信息密度优先** — 每个像素都应承载信息，拒绝无意义的留白
2. **层次分明** — 通过色彩、阴影、边框建立清晰的视觉层次
3. **时刻反馈** — 每个交互都有即时、有意义的视觉响应
4. **专业克制** — 动效服务于功能，不做装饰性动画

### 视觉隐喻

| 元素 | 隐喻 |
|------|------|
| 活动栏 | 终端的命令导航 |
| 侧边栏 | 文件浏览器 / 输出面板 |
| Finding 卡片 | 终端输出行 |
| 进度条 | 任务执行进度 |
| 状态徽章 | 进程状态标识 |

---

## 色彩系统

### 1.1 基底色（Backgrounds）

```css
:root {
  --bg-base: #0D1117;        /* 最深背景 — 页面底层 */
  --bg-surface: #161B22;     /* 面板背景 — 侧边栏、卡片 */
  --bg-elevated: #1C2128;    /* 悬浮状态 — 选中卡片、弹出层 */
  --bg-overlay: #21262D;     /* 覆盖层 — 下拉菜单、tooltip */
  --bg-input: #0D1117;       /* 输入框背景 — 与基底一致 */
}
```

**使用规则**：
- `--bg-base`: 页面 body、活动栏
- `--bg-surface`: 侧边栏面板、非选中卡片
- `--bg-elevated`: 选中卡片、hover 状态、下拉菜单
- `--bg-overlay`: tooltip、弹出层

### 1.2 文字色（Text）

```css
:root {
  --text-primary: #E6EDF3;   /* 主要文字 — 标题、重要内容 */
  --text-secondary: #8B949E; /* 次要文字 — 正文、描述 */
  --text-tertiary: #6E7681;  /* 辅助文字 — 标签、时间戳 */
  --text-disabled: #484F58;  /* 禁用文字 — 不可交互元素 */
  --text-on-accent: #FFFFFF; /* 强调色上的文字 */
}
```

**对比度要求**：
- `--text-primary` on `--bg-surface`: 13.5:1 ✓
- `--text-secondary` on `--bg-surface`: 6.2:1 ✓ (WCAG AA)
- `--text-tertiary` on `--bg-surface`: 4.1:1 ✓ (WCAG AA 大文本)

### 1.3 强调色（Accents）

```css
:root {
  /* 主强调色 — 青色荧光 */
  --accent-cyan: #56D4DD;
  --accent-cyan-muted: #3BA8B0;
  --accent-cyan-subtle: rgba(86, 212, 221, 0.15);

  /* 语义色 */
  --accent-green: #3FB950;   /* 成功、新增、通过 */
  --accent-red: #F85149;     /* 错误、删除、高危 */
  --accent-amber: #D29922;   /* 警告、中等风险 */
  --accent-purple: #BC8CFF;  /* 信息、类别标签 */
  --accent-blue: #58A6FF;    /* 链接、可交互 */
}
```

### 1.4 严重程度配色

| 级别 | 主色 | 背景 | 边框 | 文字 |
|------|------|------|------|------|
| High | `--accent-red` | `rgba(248, 81, 73, 0.1)` | `rgba(248, 81, 73, 0.4)` | `#F85149` |
| Medium | `--accent-amber` | `rgba(210, 153, 34, 0.1)` | `rgba(210, 153, 34, 0.4)` | `#D29922` |
| Low | `--text-tertiary` | `rgba(110, 118, 129, 0.1)` | `rgba(110, 118, 129, 0.3)` | `#6E7681` |

### 1.5 边框色（Borders）

```css
:root {
  --border-default: #30363D;   /* 默认边框 */
  --border-muted: #21262D;     /* 弱化边框 — 分隔线 */
  --border-subtle: #1B1F25;    /* 最弱边框 — 背景分隔 */
  --border-accent: rgba(86, 212, 221, 0.4); /* 强调边框 */
}
```

### 1.6 阴影（Shadows）

```css
:root {
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.4);
  --shadow-lg: 0 12px 40px rgba(0, 0, 0, 0.5);
  --shadow-glow-cyan: 0 0 20px rgba(86, 212, 221, 0.15);
  --shadow-glow-red: 0 0 20px rgba(248, 81, 73, 0.2);
  --shadow-inset: inset 0 1px 0 rgba(255, 255, 255, 0.03);
}
```

---

## 字体系统

### 2.1 字体栈

```css
:root {
  /* 等宽字体 — 代码、数据、标签 */
  --font-mono: 'JetBrains Mono', 'Fira Code', 'SF Mono', 'Cascadia Code', 'Consolas', monospace;

  /* 无衬线 — 标题、正文 */
  --font-sans: 'Inter', 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;

  /* 中文回退 */
  --font-cjk: 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Noto Sans CJK SC';
}
```

### 2.2 字号规范

| 用途 | CSS 变量 | 大小 | 行高 | 字重 | 字体 | 字间距 |
|------|----------|------|------|------|------|--------|
| 页面标题 | `--text-page-title` | 24px | 1.2 | 600 | --font-sans | -0.02em |
| 面板标题 | `--text-panel-title` | 13px | 1.4 | 600 | --font-sans | 0.02em |
| 卡片标题 | `--text-card-title` | 14px | 1.4 | 500 | --font-sans | 0 |
| 正文 | `--text-body` | 13px | 1.6 | 400 | --font-mono | 0 |
| 代码 | `--text-code` | 13px | 1.5 | 400 | --font-mono | 0 |
| 标签 | `--text-label` | 11px | 1.3 | 500 | --font-mono | 0.05em |
| 辅助 | `--text-caption` | 12px | 1.4 | 400 | --font-mono | 0 |

### 2.3 终端风格标签

Section 标签采用终端提示符风格：

```html
<!-- 标准格式 -->
<div class="section-label">
  <span class="prompt">$</span>
  <span class="command">findings</span>
  <span class="count">12</span>
</div>

<!-- 渲染效果 -->
$ findings 12
```

**样式**：
```css
.section-label {
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.05em;
  color: var(--text-tertiary);
  text-transform: uppercase;
}

.section-label .prompt {
  color: var(--accent-cyan);
  margin-right: 6px;
}

.section-label .command {
  color: var(--text-secondary);
}

.section-label .count {
  color: var(--text-tertiary);
  margin-left: 8px;
  padding: 1px 6px;
  background: var(--accent-cyan-subtle);
  border-radius: 4px;
  font-size: 10px;
}
```

---

## 布局系统

### 3.1 全局布局结构

```
┌──────────────────────────────────────────────────────────────────────┐
│ [活动栏] │ [侧边栏]              │ [主内容区]                        │
│   48px   │   320px               │   flex-1 (min 600px)              │
│          │                       │                                    │
│   ⬡      │  ┌─ SESSION ────────┐ │  ┌─────────────────────────────┐ │
│          │  │ Status: Running   │ │  │ Finding Title               │ │
│   ▶      │  │ ████████░░ 67%   │ │  │ src/auth.ts:42-58  [HIGH]   │ │
│   📋     │  └─────────────────┘ │  ├─────────────────────────────┤ │
│          │                       │  │ Evidence:                   │ │
│   ──     │  ┌─ FINDINGS ── 8 ─┐ │  │ User input is directly...  │ │
│          │  │ [Finding 1]      │ │  ├─────────────────────────────┤ │
│          │  │ [Finding 2]      │ │  │ ┌─────────────────────────┐ │ │
│          │  │ [Finding 3]      │ │  │ │ Monaco Diff Editor      │ │ │
│          │  │ [Finding 4]      │ │  │ │                         │ │ │
│          │  │ ...              │ │  │ │                         │ │ │
│          │  └─────────────────┘ │  │ └─────────────────────────┘ │ │
│          │                       │  └─────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
```

### 3.2 活动栏（Activity Bar）

**尺寸**: 48px × 100vh
**背景**: `--bg-base`
**右边框**: 1px solid `--border-muted`

```
┌──────┐
│      │
│  ⬡   │  ← Logo (24px, cyan)
│      │
│ ──── │  ← 分隔线
│      │
│  ▶   │  ← 启动审查 (active)
│  📋  │  ← 历史记录
│      │
│      │
│      │
│ ──── │  ← 分隔线
│  ⚙   │  ← 设置 (预留)
│      │
└──────┘
```

**图标状态**：
- 默认：`--text-tertiary`，20px
- Hover：`--text-secondary`
- Active：`--accent-cyan`，左侧 2px 指示条

```css
.activity-bar-item {
  position: relative;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-tertiary);
  transition: color 0.15s ease;
}

.activity-bar-item:hover {
  color: var(--text-secondary);
}

.activity-bar-item.active {
  color: var(--accent-cyan);
}

.activity-bar-item.active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 2px;
  height: 24px;
  background: var(--accent-cyan);
  border-radius: 0 2px 2px 0;
}
```

### 3.3 侧边栏（Sidebar）

**尺寸**: 320px × 100vh
**背景**: `--bg-surface`
**右边框**: 1px solid `--border-default`
**布局**: 垂直堆叠，可折叠面板

```
┌────────────────────────────┐
│                            │
│  ┌─ SESSION ─────────────┐ │
│  │ ● Running             │ │
│  │ ████████████░░░░ 67%  │ │
│  │ 8/12 units            │ │
│  └───────────────────────┘ │
│                            │
│  ┌─ RISK FILES ──── 3 ───┐ │
│  │ src/auth/login.ts     │ │
│  │ src/api/users.ts      │ │
│  │ src/db/queries.ts     │ │
│  └───────────────────────┘ │
│                            │
│  ┌─ FINDINGS ───── 12 ───┐ │
│  │ [HIGH] Auth Bypass    │ │
│  │ [MED]  SQL Injection  │ │
│  │ [LOW]  Unused Import  │ │
│  │ ...                   │ │
│  └───────────────────────┘ │
│                            │
└────────────────────────────┘
```

**面板规范**：
- 面板标题：`--text-label` 格式，带计数徽章
- 面板间距：1px，使用 `--border-muted` 分隔
- 可折叠：点击标题栏折叠/展开
- 最后一个面板填充剩余空间

### 3.4 主内容区（Main Content）

**最小宽度**: 600px
**背景**: `--bg-base`
**布局**: 垂直堆叠

```
┌─────────────────────────────────────────────┐
│ ┌─ FINDING HEADER ────────────────────────┐ │
│ │ Authentication Bypass Vulnerability     │ │
│ │ src/auth/login.ts:42-58    [HIGH]       │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ ┌─ EVIDENCE ──────────────────────────────┐ │
│ │ User input is directly concatenated     │ │
│ │ into SQL query without sanitization...  │ │
│ │                                         │ │
│ │ > Suggestion: Use parameterized queries │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ ┌─ DIFF ──────────────────────────────────┐ │
│ │  42 │   const query = `SELECT * FROM   │ │
│ │  43 │     users WHERE id = ${userId}`; │ │
│ │  44 │                                 │ │
│ │ ... │                                 │ │
│ └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

---

## 组件规范

### 4.1 FindingCard（发现卡片）

**用途**: 展示单个代码审查发现

```
┌─ HIGH ──────────────────────────────────────┐
│                                             │
│  Authentication Bypass Vulnerability        │
│  src/auth/login.ts:42-58                    │
│                                             │
│  ┌─────────────────────────────────────────┐│
│  │ // User input directly concatenated    ││
│  │ const q = `SELECT * FROM users...      ││
│  └─────────────────────────────────────────┘│
│                                             │
│  > Use parameterized queries to prevent...  │
│                                             │
└─────────────────────────────────────────────┘
```

**规格**：
- 宽度：100%
- 内边距：12px 16px
- 圆角：6px
- 左边框：3px（颜色由严重程度决定）
- 背景：`--bg-surface`（默认）/ `--bg-elevated`（选中）

**状态**：

| 状态 | 背景 | 边框 | 阴影 | 其他 |
|------|------|------|------|------|
| Default | `--bg-surface` | `--border-default` | 无 | — |
| Hover | `--bg-elevated` | `--border-accent` | `--shadow-glow-cyan` | translateY(-1px) |
| Selected | `--bg-elevated` | `--accent-cyan` | `inset 0 0 0 1px var(--border-accent)` | — |
| High Severity | 同上 | 左边框 `--accent-red` | — | 脉冲动画 |

**CSS 实现**：

```css
.finding-card {
  position: relative;
  padding: 12px 16px;
  background: var(--bg-surface);
  border: 1px solid var(--border-default);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.finding-card::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  border-radius: 6px 0 0 6px;
}

.finding-card:hover {
  background: var(--bg-elevated);
  border-color: var(--border-accent);
  box-shadow: var(--shadow-glow-cyan);
  transform: translateY(-1px);
}

.finding-card[data-selected="true"] {
  background: var(--bg-elevated);
  border-color: var(--accent-cyan);
  box-shadow: inset 0 0 0 1px var(--border-accent);
}

/* 严重程度左边框 */
.finding-card[data-severity="high"]::before {
  background: var(--accent-red);
}

.finding-card[data-severity="medium"]::before {
  background: var(--accent-amber);
}

.finding-card[data-severity="low"]::before {
  background: var(--text-tertiary);
}

/* 高危脉冲动画 */
.finding-card[data-severity="high"]::before {
  animation: high-risk-pulse 3s ease-in-out infinite;
}
```

### 4.2 StatusBadge（状态徽章）

**用途**: 显示严重程度或审查状态

**格式**: `[图标] 标签`

```
[● HIGH]     — 实心圆 + 红色
[○ MEDIUM]   — 空心圆 + 琥珀色
[· LOW]      — 小点 + 灰色

[✓ FINISHED] — 勾号 + 绿色
[◌ RUNNING]  — 旋转 + 青色
[✕ FAILED]   — 叉号 + 红色
```

**规格**：
- 高度：20px
- 内边距：2px 8px
- 圆角：4px
- 字体：`--text-label` 格式
- 背景：严重程度背景色

**CSS 实现**：

```css
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 20px;
  padding: 2px 8px;
  border-radius: 4px;
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.status-badge[data-severity="high"] {
  background: rgba(248, 81, 73, 0.1);
  color: var(--accent-red);
}

.status-badge[data-severity="medium"] {
  background: rgba(210, 153, 34, 0.1);
  color: var(--accent-amber);
}

.status-badge[data-severity="low"] {
  background: rgba(110, 118, 129, 0.1);
  color: var(--text-tertiary);
}

/* 图标动画 */
.status-badge[data-status="running"] .icon {
  animation: spin 1s linear infinite;
}
```

### 4.3 ProgressBar（进度条）

**用途**: 显示审查进度

```
┌─ SESSION STATUS ────────────────────────────┐
│                                             │
│  ● Running                                  │
│  ████████████████░░░░░░░░  67%              │
│  8/12 units complete                        │
│                                             │
└─────────────────────────────────────────────┘
```

**规格**：
- 高度：6px
- 圆角：3px
- 背景：`--bg-overlay`
- 填充：青色渐变 + 发光

**CSS 实现**：

```css
.progress-bar {
  height: 6px;
  background: var(--bg-overlay);
  border-radius: 3px;
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--accent-cyan-muted), var(--accent-cyan));
  border-radius: 3px;
  transition: width 0.3s ease;
  animation: progress-glow 2s ease-in-out infinite;
}

@keyframes progress-glow {
  0%, 100% {
    box-shadow: 0 0 8px rgba(86, 212, 221, 0.3);
  }
  50% {
    box-shadow: 0 0 16px rgba(86, 212, 221, 0.5);
  }
}
```

### 4.4 DiffHeader（Diff 头部）

**用途**: 显示当前查看的 finding 信息

```
┌─ FINDING ───────────────────────────────────┐
│                                             │
│  Authentication Bypass Vulnerability        │
│                                             │
│  src/auth/login.ts:42-58                    │
│  [HIGH]  [status: pending]                  │
│                                             │
└─────────────────────────────────────────────┘
```

**规格**：
- 背景：`--bg-surface`
- 下边框：1px solid `--border-default`
- 内边距：16px 20px

### 4.5 EvidencePanel（证据面板）

**用途**: 显示 finding 的详细说明

```
┌─ EVIDENCE ──────────────────────────────────┐
│                                             │
│  User input is directly concatenated into   │
│  SQL query without any sanitization or      │
│  parameterization...                        │
│                                             │
│  ┌─ SUGGESTION ──────────────────────────┐  │
│  │ Use parameterized queries to prevent  │  │
│  │ SQL injection attacks.                │  │
│  └───────────────────────────────────────┘  │
│                                             │
└─────────────────────────────────────────────┘
```

**规格**：
- 背景：`--bg-surface`
- 下边框：1px solid `--border-default`
- 内边距：16px 20px
- 建议区域：左侧 2px 青色边框

### 4.6 EmptyState（空状态）

**用途**: 未选择 finding 时的占位

```
┌─────────────────────────────────────────────┐
│                                             │
│                                             │
│         ┌───────────────────────┐           │
│         │                       │           │
│         │  $ select-finding     │           │
│         │                       │           │
│         │  > Choose a finding   │           │
│         │    from the sidebar   │           │
│         │    to start review    │           │
│         │                       │           │
│         │  _                    │           │
│         │                       │           │
│         └───────────────────────┘           │
│                                             │
│                                             │
└─────────────────────────────────────────────┘
```

**规格**：
- 居中显示
- 终端窗口样式：圆角 8px，背景 `--bg-surface`，边框 `--border-default`
- 文字颜色：`--text-tertiary`
- 光标闪烁动画

**CSS 实现**：

```css
.empty-state-terminal {
  background: var(--bg-surface);
  border: 1px solid var(--border-default);
  border-radius: 8px;
  padding: 24px 32px;
  font-family: var(--font-mono);
  font-size: 13px;
  color: var(--text-tertiary);
  line-height: 1.8;
}

.empty-state-terminal .prompt {
  color: var(--accent-cyan);
}

.empty-state-terminal .cursor {
  display: inline-block;
  width: 8px;
  height: 16px;
  background: var(--accent-cyan);
  animation: cursor-blink 1s step-end infinite;
  vertical-align: text-bottom;
}

@keyframes cursor-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}
```

---

## 动效系统

### 5.1 页面转场

```css
/* 页面进入 — 从下方滑入 + 淡入 */
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

/* 列表项交错进入 */
.finding-card:nth-child(1) { animation-delay: 0ms; }
.finding-card:nth-child(2) { animation-delay: 50ms; }
.finding-card:nth-child(3) { animation-delay: 100ms; }
/* ... */
```

### 5.2 交互反馈

```css
/* 悬停上移 */
.interactive {
  transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
}

.interactive:hover {
  transform: translateY(-1px);
}

/* 点击缩放 */
.interactive:active {
  transform: translateY(0) scale(0.99);
}
```

### 5.3 状态指示

```css
/* 高危脉冲 */
@keyframes high-risk-pulse {
  0%, 100% {
    box-shadow: -4px 0 12px rgba(248, 81, 73, 0.2);
  }
  50% {
    box-shadow: -4px 0 20px rgba(248, 81, 73, 0.35);
  }
}

/* 进度条发光 */
@keyframes progress-glow {
  0%, 100% {
    box-shadow: 0 0 8px rgba(86, 212, 221, 0.3);
  }
  50% {
    box-shadow: 0 0 16px rgba(86, 212, 221, 0.5);
  }
}

/* 旋转加载 */
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* 终端光标 */
@keyframes cursor-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}
```

### 5.4 过渡时间规范

| 交互类型 | 时长 | 缓动 |
|----------|------|------|
| 颜色/背景 | 150ms | ease |
| 位移/缩放 | 150ms | ease |
| 布局变化 | 250ms | ease-in-out |
| 页面转场 | 300ms | ease-out |

---

## 背景与氛围

### 6.1 页面背景

```css
body {
  background-color: var(--bg-base);
  background-image:
    /* 细微网格纹理 — 模拟终端/蓝图 */
    linear-gradient(rgba(86, 212, 221, 0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(86, 212, 221, 0.03) 1px, transparent 1px),
    /* 角落渐变光晕 */
    radial-gradient(ellipse at 0% 0%, rgba(86, 212, 221, 0.08) 0%, transparent 50%),
    radial-gradient(ellipse at 100% 100%, rgba(188, 140, 255, 0.05) 0%, transparent 50%);
  background-size:
    24px 24px,
    24px 24px,
    100% 100%,
    100% 100%;
}
```

### 6.2 面板样式

```css
.panel {
  background: var(--bg-surface);
  border: 1px solid var(--border-default);
  box-shadow:
    var(--shadow-inset),
    var(--shadow-sm);
}

.panel-elevated {
  background: var(--bg-elevated);
  border: 1px solid var(--border-accent);
  box-shadow: var(--shadow-glow-cyan);
}
```

### 6.3 分隔线

```css
/* 水平分隔线 */
.divider-h {
  height: 1px;
  background: var(--border-muted);
  margin: 8px 0;
}

/* 垂直分隔线 */
.divider-v {
  width: 1px;
  background: var(--border-muted);
  margin: 0 8px;
}

/* 终端风格分隔线 */
.divider-terminal {
  height: 1px;
  background: repeating-linear-gradient(
    90deg,
    var(--border-muted) 0px,
    var(--border-muted) 4px,
    transparent 4px,
    transparent 8px
  );
}
```

---

## 图标系统

### 7.1 图标规范

- **风格**: 线条风格（stroke）
- **线宽**: 1.5px
- **尺寸**: 16px (内联) | 20px (导航) | 24px (标题)
- **颜色**: `currentColor`（继承父元素）

### 7.2 图标尺寸系统

| 场景 | 尺寸 | 用途 |
|------|------|------|
| `icon-xs` | 14px | 内联标签、徽章内图标 |
| `icon-sm` | 16px | 按钮内图标、列表项图标 |
| `icon-md` | 20px | 导航图标、表单图标 |
| `icon-lg` | 24px | 面板标题图标、空状态图标 |
| `icon-xl` | 32px | 页面级空状态、引导图标 |

```css
.icon-xs { width: 14px; height: 14px; }
.icon-sm { width: 16px; height: 16px; }
.icon-md { width: 20px; height: 20px; }
.icon-lg { width: 24px; height: 24px; }
.icon-xl { width: 32px; height: 32px; }
```

### 7.3 核心图标映射表

#### 导航图标

| Lucide 图标 | 用途 | 位置 |
|-------------|------|------|
| `Play` | 启动审查 | 活动栏、启动按钮 |
| `Clock` | 历史记录 | 活动栏、历史页标题 |
| `Settings` | 设置 | 活动栏底部 |
| `Home` | 首页/Logo | 活动栏顶部 |

#### 状态图标

| Lucide 图标 | 用途 | 颜色 | 动画 |
|-------------|------|------|------|
| `CheckCircle2` | 完成/成功 | `--accent-green` | 无 |
| `XCircle` | 失败/错误 | `--accent-red` | 无 |
| `AlertTriangle` | 警告/高危 | `--accent-red` / `--accent-amber` | 脉冲（高危） |
| `Info` | 信息/低危 | `--accent-blue` / `--text-tertiary` | 无 |
| `Loader2` | 加载中 | `--accent-cyan` | 旋转 |
| `Circle` | 待处理 | `--text-disabled` | 无 |
| `CircleDot` | 进行中 | `--accent-cyan` | 脉冲 |

#### 文件与代码图标

| Lucide 图标 | 用途 | 场景 |
|-------------|------|------|
| `FileText` | 文件 | 风险文件列表、文件路径 |
| `Folder` | 文件夹 | 仓库选择器 |
| `GitBranch` | 分支 | 分支选择器、session 卡片 |
| `GitCommit` | 提交 | session 详情 |
| `GitCompare` | 对比 | 启动页标题、session 卡片 |
| `Code2` | 代码 | Finding 类别标签 |
| `FileDiff` | Diff | Diff 区域标题 |

#### 操作图标

| Lucide 图标 | 用途 | 场景 |
|-------------|------|------|
| `ChevronDown` | 展开/下拉 | 折叠面板、下拉菜单 |
| `ChevronRight` | 收起/跳转 | 面包屑、链接 |
| `ChevronUp` | 上移 | 排序 |
| `Copy` | 复制 | 代码片段、路径 |
| `ExternalLink` | 外部链接 | 文件路径跳转 |
| `Search` | 搜索 | 搜索框 |
| `Filter` | 筛选 | Finding 列表筛选 |
| `RefreshCw` | 刷新 | 重新审查 |
| `X` | 关闭 | 弹窗、提示 |
| `Check` | 确认 | 确认操作 |

#### 分类图标（Finding Category）

| Lucide 图标 | 用途 | 颜色 |
|-------------|------|------|
| `Shield` | 安全问题 | `--accent-red` |
| `Bug` | Bug/缺陷 | `--accent-red` |
| `Zap` | 性能问题 | `--accent-amber` |
| `Palette` | 代码风格 | `--accent-purple` |
| `FileWarning` | 文件问题 | `--accent-amber` |
| `Lock` | 认证/授权 | `--accent-red` |
| `Database` | 数据库问题 | `--accent-amber` |
| `Network` | 网络问题 | `--accent-blue` |

### 7.4 图标使用规范

#### 7.4.1 图标 + 文字组合

```
┌─────────────────────────────────────┐
│  图标与文字的间距规范               │
├─────────────────────────────────────┤
│  [图标] [空格/间距] [文字]          │
│                                     │
│  小图标 (14-16px): 间距 6px        │
│  中图标 (20px):    间距 8px        │
│  大图标 (24px):    间距 10px       │
└─────────────────────────────────────┘
```

**CSS 实现**：

```css
.icon-text-group {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.icon-text-group[data-size="md"] {
  gap: 8px;
}

.icon-text-group[data-size="lg"] {
  gap: 10px;
}
```

**React 组件示例**：

```tsx
import { GitBranch } from 'lucide-react'

// 分支标签
<span className="inline-flex items-center gap-1.5">
  <GitBranch className="icon-sm text-accent-cyan" />
  <span className="font-mono text-sm">main</span>
</span>

// 状态标签
<span className="inline-flex items-center gap-1.5">
  <CheckCircle2 className="icon-sm text-accent-green" />
  <span className="text-label">FINISHED</span>
</span>
```

#### 7.4.2 图标按钮

```
┌─────────────────────────────────────┐
│  图标按钮样式                       │
├─────────────────────────────────────┤
│  默认:  背景透明, 图标 text-tertiary│
│  Hover: 背景 bg-elevated, 边框出现 │
│  Active: 背景 bg-overlay           │
│  禁用:  图标 text-disabled          │
└─────────────────────────────────────┘
```

**CSS 实现**：

```css
.icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  transition: all 0.15s ease;
}

.icon-button:hover {
  background: var(--bg-elevated);
  border-color: var(--border-default);
  color: var(--text-secondary);
}

.icon-button:active {
  background: var(--bg-overlay);
}

.icon-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.icon-button[data-variant="ghost"] {
  border: none;
}

.icon-button[data-variant="danger"]:hover {
  color: var(--accent-red);
  background: rgba(248, 81, 73, 0.1);
  border-color: rgba(248, 81, 73, 0.3);
}
```

**React 组件示例**：

```tsx
import { Copy, ExternalLink, RefreshCw } from 'lucide-react'

// 复制按钮
<button className="icon-button" title="复制路径">
  <Copy className="icon-sm" />
</button>

// 危险操作按钮
<button className="icon-button" data-variant="danger" title="删除">
  <X className="icon-sm" />
</button>
```

#### 7.4.3 图标徽章组合

```
┌─────────────────────────────────────┐
│  图标 + 计数徽章                    │
├─────────────────────────────────────┤
│  [图标] FINDINGS [计数]             │
│                                     │
│  计数徽章:                          │
│  - 背景: accent-cyan-subtle         │
│  - 文字: accent-cyan                │
│  - 圆角: 10px (pill)                │
│  - 内边距: 2px 6px                  │
└─────────────────────────────────────┘
```

**React 组件示例**：

```tsx
import { AlertTriangle, FileText } from 'lucide-react'

// Finding 计数
<div className="section-label">
  <span className="prompt">$</span>
  <AlertTriangle className="icon-xs" />
  <span className="command">findings</span>
  <span className="count-badge">12</span>
</div>

// 文件计数
<div className="section-label">
  <span className="prompt">$</span>
  <FileText className="icon-xs" />
  <span className="command">risk-files</span>
  <span className="count-badge">3</span>
</div>
```

#### 7.4.4 状态图标动画

```css
/* 旋转动画 — 用于加载状态 */
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.icon-spin {
  animation: spin 1s linear infinite;
}

/* 脉冲动画 — 用于进行中状态 */
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.icon-pulse {
  animation: pulse 2s ease-in-out infinite;
}

/* 高危脉冲 — 红色辉光 */
@keyframes danger-pulse {
  0%, 100% {
    filter: drop-shadow(0 0 4px rgba(248, 81, 73, 0.3));
  }
  50% {
    filter: drop-shadow(0 0 8px rgba(248, 81, 73, 0.5));
  }
}

.icon-danger-pulse {
  animation: danger-pulse 3s ease-in-out infinite;
}
```

**React 组件示例**：

```tsx
import { Loader2, CircleDot, AlertTriangle } from 'lucide-react'

// 加载中
<Loader2 className="icon-md icon-spin text-accent-cyan" />

// 进行中
<CircleDot className="icon-md icon-pulse text-accent-cyan" />

// 高危警告
<AlertTriangle className="icon-md icon-danger-pulse text-accent-red" />
```

### 7.5 完整图标组件封装

```tsx
// components/ui/icon.tsx
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
  xs: 'w-3.5 h-3.5',    // 14px
  sm: 'w-4 h-4',        // 16px
  md: 'w-5 h-5',        // 20px
  lg: 'w-6 h-6',        // 24px
  xl: 'w-8 h-8',        // 32px
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

// 使用示例
<Icon icon={GitBranch} size="sm" variant="accent" />
<Icon icon={Loader2} size="md" variant="accent" spin />
<Icon icon={AlertTriangle} size="lg" variant="danger" pulse />
```

### 7.6 图标在各组件中的应用

#### 活动栏

```
┌──────┐
│      │
│  ⬡   │  ← Icon icon={Home} size="lg" variant="accent"
│      │
│ ──── │
│      │
│  ▶   │  ← Icon icon={Play} size="md" variant="accent" (active)
│  📋  │  ← Icon icon={Clock} size="md" variant="muted"
│      │
│ ──── │
│  ⚙   │  ← Icon icon={Settings} size="md" variant="muted"
│      │
└──────┘
```

#### FindingCard

```
┌─ [!] HIGH ──────────────────────────────────┐
│  [🔒] Authentication Bypass Vulnerability   │
│  [📄] src/auth/login.ts:42-58               │
│                                             │
│  [💬] > Use parameterized queries...        │
└─────────────────────────────────────────────┘

图标使用:
- [!]  ← Icon icon={AlertTriangle} size="xs" variant="danger"
- [🔒] ← Icon icon={Lock} size="sm" variant="danger"
- [📄] ← Icon icon={FileText} size="sm" variant="muted"
- [💬] ← Icon icon={MessageSquare} size="sm" variant="accent"
```

#### SessionProgress

```
┌─ $ session-status ──────────────────────────┐
│                                             │
│  [↻] ● Running                              │
│  ████████████████░░░░░░░░  67%              │
│  [📄] 8/12 units complete                   │
│                                             │
└─────────────────────────────────────────────┘

图标使用:
- [↻]  ← Icon icon={Loader2} size="sm" variant="accent" spin
- [📄] ← Icon icon={FileText} size="xs" variant="muted"
```

#### RiskFileList

```
┌─ $ risk-files [3] ──────────────────────────┐
│                                             │
│  [📄] src/auth/login.ts                     │
│  [📄] src/api/users.ts                      │
│  [📄] src/db/queries.ts                     │
│                                             │
└─────────────────────────────────────────────┘

图标使用:
- [📄] ← Icon icon={FileText} size="sm" variant="muted"
```

#### DiffHeader

```
┌─ $ finding ─────────────────────────────────┐
│                                             │
│  [🔒] Authentication Bypass Vulnerability   │
│                                             │
│  [📄] src/auth/login.ts:42-58               │
│  [!] [HIGH]  [◌] [status: pending]          │
│                                             │
└─────────────────────────────────────────────┘

图标使用:
- [🔒] ← Icon icon={Lock} size="lg" variant="danger"
- [📄] ← Icon icon={FileText} size="sm" variant="muted"
- [!]  ← Icon icon={AlertTriangle} size="xs" variant="danger"
- [◌]  ← Icon icon={CircleDot} size="xs" variant="accent"
```

#### 启动页表单

```
┌─ $ code-review --init ──────────────────────┐
│                                             │
│  [📁] REPOSITORY                            │
│  ┌─────────────────────────────────────┐    │
│  │ /Users/dev/my-project           [▼] │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  [🌿] BASE BRANCH                           │
│  ┌─────────────────────────────────────┐    │
│  │ main                            [▼] │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  [🌿] TARGET BRANCH                         │
│  ┌─────────────────────────────────────┐    │
│  │ feature/auth                    [▼] │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  [▶] $ start-review                         │
│                                             │
│  ─────────── or ───────────                 │
│                                             │
│  [↻] $ review-workspace                     │
│                                             │
└─────────────────────────────────────────────┘

图标使用:
- [📁] ← Icon icon={Folder} size="sm" variant="muted"
- [🌿] ← Icon icon={GitBranch} size="sm" variant="accent"
- [▼]  ← Icon icon={ChevronDown} size="sm" variant="muted"
- [▶]  ← Icon icon={Play} size="sm" variant="default"
- [↻]  ← Icon icon={RefreshCw} size="sm" variant="default"
```

#### 历史页 SessionCard

```
┌─────────────────────────────────────────────┐
│                                             │
│  [🌿] main → feature/auth                   │
│  [📁] /Users/dev/my-project                 │
│  [🕐] 2026-06-08 14:32    [✓] [FINISHED]   │
│  ─────────────────────────────────────────  │
│  [📄] 12 files  [!] 8 findings  [⚠] 2 high │
│                                             │
└─────────────────────────────────────────────┘

图标使用:
- [🌿] ← Icon icon={GitBranch} size="sm" variant="accent"
- [📁] ← Icon icon={Folder} size="sm" variant="muted"
- [🕐] ← Icon icon={Clock} size="sm" variant="muted"
- [✓]  ← Icon icon={CheckCircle2} size="xs" variant="success"
- [📄] ← Icon icon={FileText} size="xs" variant="muted"
- [!]  ← Icon icon={AlertTriangle} size="xs" variant="warning"
- [⚠]  ← Icon icon={AlertTriangle} size="xs" variant="danger"
```

#### 空状态

```
┌─────────────────────────────────────────────┐
│                                             │
│         ┌───────────────────────┐           │
│         │                       │           │
│         │  [🔍] $ select-finding│           │
│         │                       │           │
│         │  > Choose a finding   │           │
│         │    from the sidebar   │           │
│         │    to start review    │           │
│         │                       │           │
│         │  _                    │           │
│         │                       │           │
│         └───────────────────────┘           │
│                                             │
└─────────────────────────────────────────────┘

图标使用:
- [🔍] ← Icon icon={Search} size="lg" variant="muted"
```

### 7.7 推荐图标库

**Lucide Icons** — https://lucide.dev

```tsx
// 完整导入列表
import {
  // 导航
  Play,
  Clock,
  Settings,
  Home,
  
  // 状态
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  Loader2,
  Circle,
  CircleDot,
  
  // 文件与代码
  FileText,
  Folder,
  GitBranch,
  GitCommit,
  GitCompare,
  Code2,
  FileDiff,
  
  // 操作
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Copy,
  ExternalLink,
  Search,
  Filter,
  RefreshCw,
  X,
  Check,
  
  // 分类
  Shield,
  Bug,
  Zap,
  Palette,
  FileWarning,
  Lock,
  Database,
  Network,
  
  // 其他
  MessageSquare,
  ArrowRight,
  ArrowLeft,
  Plus,
  Minus,
  MoreHorizontal,
} from 'lucide-react'
```

---

## 页面设计详解

### 8.1 启动页（ReviewLaunchPage）

**布局**: 居中卡片，最大宽度 480px

```
┌─────────────────────────────────────────────┐
│                                             │
│  ┌─────────────────────────────────────────┐│
│  │                                         ││
│  │  $ code-review --init                   ││
│  │                                         ││
│  │  ┌─ REPOSITORY ──────────────────────┐  ││
│  │  │ /Users/dev/my-project           ▼ │  ││
│  │  └───────────────────────────────────┘  ││
│  │                                         ││
│  │  ┌─ BASE BRANCH ─────────────────────┐  ││
│  │  │ main                            ▼ │  ││
│  │  └───────────────────────────────────┘  ││
│  │                                         ││
│  │  ┌─ TARGET BRANCH ───────────────────┐  ││
│  │  │ feature/auth                    ▼ │  ││
│  │  └───────────────────────────────────┘  ││
│  │                                         ││
│  │  ┌─────────────────────────────────────┐││
│  │  │  $ start-review                     │││
│  │  └─────────────────────────────────────┘││
│  │                                         ││
│  │  ─────────── or ───────────             ││
│  │                                         ││
│  │  ┌─────────────────────────────────────┐││
│  │  │  $ review-workspace                 │││
│  │  └─────────────────────────────────────┘││
│  │                                         ││
│  └─────────────────────────────────────────┘│
│                                             │
└─────────────────────────────────────────────┘
```

**设计要点**：
- 标题使用终端命令风格 `$ code-review --init`
- 输入框标签使用 `$` 前缀
- 按钮使用终端命令风格
- 背景有微弱的网格纹理

**输入框样式**：

```css
.input-field {
  height: 40px;
  padding: 0 12px;
  background: var(--bg-input);
  border: 1px solid var(--border-default);
  border-radius: 6px;
  font-family: var(--font-mono);
  font-size: 13px;
  color: var(--text-primary);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.input-field:focus {
  outline: none;
  border-color: var(--accent-cyan);
  box-shadow: 0 0 0 3px var(--accent-cyan-subtle);
}

.input-field::placeholder {
  color: var(--text-disabled);
}
```

**按钮样式**：

```css
/* 主按钮 */
.btn-primary {
  height: 40px;
  padding: 0 16px;
  background: var(--accent-cyan);
  border: none;
  border-radius: 6px;
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 500;
  color: var(--text-on-accent);
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-primary:hover {
  background: var(--accent-cyan-muted);
  box-shadow: var(--shadow-glow-cyan);
}

.btn-primary:active {
  transform: scale(0.98);
}

/* 次按钮 */
.btn-secondary {
  height: 40px;
  padding: 0 16px;
  background: transparent;
  border: 1px solid var(--border-default);
  border-radius: 6px;
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-secondary:hover {
  border-color: var(--border-accent);
  color: var(--text-primary);
  background: var(--accent-cyan-subtle);
}
```

### 8.2 历史页（SessionHistoryPage）

**布局**: 列表布局，最大宽度 960px，居中

```
┌─────────────────────────────────────────────┐
│                                             │
│  $ review-history                           │
│                                             │
│  ┌─ RECENT SESSIONS ──────────────── 4 ────┐│
│  │                                         ││
│  │  ┌─────────────────────────────────────┐││
│  │  │ main → feature/auth                 │││
│  │  │ /Users/dev/my-project               │││
│  │  │ 2026-06-08 14:32    [FINISHED]      │││
│  │  │ ─────────────────────────────────── │││
│  │  │ 12 files  │  8 findings  │  2 high  │││
│  │  └─────────────────────────────────────┘││
│  │                                         ││
│  │  ┌─────────────────────────────────────┐││
│  │  │ main → feature/api                  │││
│  │  │ /Users/dev/my-project               │││
│  │  │ 2026-06-07 09:15    [FINISHED]      │││
│  │  │ ─────────────────────────────────── │││
│  │  │ 5 files   │  3 findings  │  0 high  │││
│  │  └─────────────────────────────────────┘││
│  │                                         ││
│  └─────────────────────────────────────────┘│
│                                             │
└─────────────────────────────────────────────┘
```

**设计要点**：
- 标题使用终端命令风格
- 卡片显示分支对比（`main → feature/auth`）
- 统计信息使用分隔线分隔
- 状态徽章右对齐

### 8.3 审查页（ReviewSessionPage）

**布局**: 三栏布局（活动栏 + 侧边栏 + 主内容区）

```
┌──────────────────────────────────────────────────────────────────────┐
│ [活动栏] │ [侧边栏 320px]           │ [主内容区 flex-1]              │
│          │                           │                               │
│   ⬡      │  $ session-status         │  ┌─ FINDING ────────────────┐│
│          │  ● Running                │  │ Auth Bypass Vulnerability ││
│   ▶      │  ████████████░░░░ 67%     │  │ src/auth.ts:42  [HIGH]   ││
│   📋     │  8/12 units               │  └─────────────────────────┘│
│          │                           │                               │
│   ──     │  $ risk-files 3           │  ┌─ EVIDENCE ──────────────┐│
│          │  src/auth/login.ts        │  │ User input directly...  ││
│          │  src/api/users.ts         │  │                         ││
│          │  src/db/queries.ts        │  │ > Use parameterized...  ││
│          │                           │  └─────────────────────────┘│
│          │  $ findings 8             │                               │
│          │  ┌─ HIGH ──────────────┐  │  ┌─ DIFF ─────────────────┐│
│          │  │ Auth Bypass         │  │  │  42 │ const q = `SEL.. ││
│          │  │ src/auth.ts:42      │  │  │  43 │   * FROM users.. ││
│          │  └─────────────────────┘  │  │  44 │   WHERE id = ${. ││
│          │  ┌─ MED ───────────────┐  │  │ ... │                 ││
│          │  │ SQL Injection       │  │  └─────────────────────────┘│
│          │  │ src/db.ts:18        │  │                               │
│          │  └─────────────────────┘  │                               │
│          │  ...                      │                               │
└──────────────────────────────────────────────────────────────────────┘
```

**设计要点**：
- 侧边栏垂直堆叠：状态 → 风险文件 → 发现列表
- 主内容区垂直堆叠：头部 → 证据 → Diff
- Finding 卡片可点击，选中后右侧显示详情
- Diff 区域最大化显示代码

---

## Tailwind 配置

### 9.1 扩展配置

```typescript
// tailwind.config.ts
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

---

## CSS 变量完整定义

### 10.1 globals.css

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

/* ===== Monaco 编辑器主题覆盖 ===== */
.monaco-editor .margin {
  background: var(--bg-base) !important;
}

.monaco-editor .line-numbers {
  color: var(--text-disabled) !important;
}

/* Diff 高亮 */
.monaco-editor .inline-added {
  background: rgba(63, 185, 80, 0.15) !important;
}

.monaco-editor .inline-removed {
  background: rgba(248, 81, 73, 0.15) !important;
}

/* Finding 高亮行 */
.review-finding-line {
  background: rgba(86, 212, 221, 0.1) !important;
}

.review-finding-gutter {
  background: var(--accent-cyan) !important;
}
```

---

## 实施计划

### 阶段一：主题基础（Day 1-2）

**目标**: 建立新的视觉基础

- [ ] 更新 `globals.css`，替换所有 CSS 变量
- [ ] 更新 `tailwind.config.ts`，添加自定义主题
- [ ] 替换字体为 JetBrains Mono + Inter
- [ ] 更新全局背景和纹理
- [ ] 更新滚动条样式

### 阶段二：布局重构（Day 3-4）

**目标**: 实现新的三栏布局

- [ ] 重构 `AppShell`，添加活动栏
- [ ] 更新侧边栏布局和面板系统
- [ ] 调整主内容区布局
- [ ] 实现面板折叠功能

### 阶段三：组件更新（Day 5-6）

**目标**: 更新所有组件样式

- [ ] 更新 `FindingCard` 样式和状态
- [ ] 更新 `StatusBadge` 组件
- [ ] 更新 `ProgressBar` 组件
- [ ] 更新输入框和按钮样式
- [ ] 更新空状态设计

### 阶段四：动效与细节（Day 7）

**目标**: 添加动效和打磨细节

- [ ] 添加页面转场动画
- [ ] 实现高危卡片脉冲效果
- [ ] 添加进度条发光效果
- [ ] 优化交互反馈

### 阶段五：Monaco 集成（Day 8）

**目标**: 更新 Monaco 编辑器主题

- [ ] 创建新的 Monaco 主题
- [ ] 更新 diff 高亮颜色
- [ ] 更新 finding 装饰样式
- [ ] 测试编辑器性能

### 阶段六：测试与打磨（Day 9-10）

**目标**: 确保质量

- [ ] 对比度检查（WCAG AA）
- [ ] 性能优化（动画 GPU 加速）
- [ ] 边界情况测试
- [ ] 用户反馈收集

---

## 附录

### A. 设计参考

- [GitHub Dark Theme](https://github.com) — 深色主题色彩参考
- [Linear App](https://linear.app) — 极简专业风格
- [Warp Terminal](https://warp.dev) — 现代终端美学
- [Raycast](https://raycast.com) — 工具类应用设计

### B. 资源链接

- **字体**: [JetBrains Mono](https://www.jetbrains.com/lp/mono/) | [Inter](https://rsms.me/inter/)
- **图标**: [Lucide Icons](https://lucide.dev) | [Phosphor Icons](https://phosphoricons.com)
- **色彩**: [GitHub's Design System](https://primer.style)

### C. 变更记录

| 版本 | 日期 | 变更 |
|------|------|------|
| v1.0 | 2026-06-08 | 初始提案 |
| v2.0 | 2026-06-08 | 完善详细设计方案 |
