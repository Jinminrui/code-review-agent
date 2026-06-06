# Review Workbench UI Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将审查会话主工作台升级为高保真“审查编辑台”界面，强化左侧审查脉络与右侧 diff 验证台体验。

**Architecture:** 保持现有 `AppShell -> ReviewSessionPage -> session/diff components` 结构不变，在现有 React 组件上做分层重组和视觉系统升级。左侧新增会话头部与证据化 finding 流，右侧围绕 selected finding 建立上下文顶栏、证据摘要条和更可信的 diff 包装层。

**Tech Stack:** React 19、TypeScript 5、Tailwind CSS、Zustand、Vitest、Testing Library、Monaco Diff Editor

---

## Scope Check

本计划只覆盖 `review-session-page` 主工作台 UI 刷新，不涉及 review 启动页、历史页或设置页重设计，因此是单一子系统改造，适合单独执行。

## File Structure Map

- Modify: `packages/review-app/src/components/layout/app-shell.tsx` — 升级全局壳层和导航骨架
- Modify: `packages/review-app/src/pages/review-session-page.tsx` — 调整三层工作台布局并串联新增区块
- Modify: `packages/review-app/src/components/session/session-progress.tsx` — 从单卡片进度改为轻量执行痕迹
- Modify: `packages/review-app/src/components/session/review-summary-panel.tsx` — 从数字三宫格改为主结论 + 指标结构
- Modify: `packages/review-app/src/components/session/risk-file-list.tsx` — 改造为高风险文件带
- Modify: `packages/review-app/src/components/session/finding-card.tsx` — 升级 finding 卡层级、选中态与文件级表达
- Modify: `packages/review-app/src/components/session/finding-list.tsx` — 增加 section 标题和列表容器节奏
- Modify: `packages/review-app/src/components/session/diff-empty-state.tsx` — 改为空状态工作台文案与结构
- Modify: `packages/review-app/src/components/diff/monaco-diff-viewer.tsx` — 增加阅读台容器、上下文顶栏、证据摘要条
- Modify: `packages/review-app/src/styles/globals.css` — 收紧全局色板、背景与基础排版变量
- Test: `packages/review-app/tests/review-session-page.test.tsx`
- Test: `packages/review-app/tests/finding-list.test.tsx`

### Task 1: 先用测试锁定工作台结构

**Files:**
- Modify: `packages/review-app/tests/review-session-page.test.tsx`
- Modify: `packages/review-app/tests/finding-list.test.tsx`

- [ ] **Step 1: 为页面补充工作台结构断言**

```tsx
it("renders review workbench regions", async () => {
  renderWithRouter(<ReviewSessionPage />, { route: "/sessions/session-1" });

  expect(await screen.findByText(/review workbench/i)).toBeInTheDocument();
  expect(screen.getByText(/summary/i)).toBeInTheDocument();
  expect(screen.getByText(/risk files/i)).toBeInTheDocument();
  expect(screen.getByText(/evidence/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: 运行页面测试确认先失败**

Run: `pnpm --filter @app/review-app test -- review-session-page.test.tsx finding-list.test.tsx`
Expected: FAIL，提示缺少 `Evidence` 区域或新的 workbench 结构文本

- [ ] **Step 3: 为 finding 列表补充分区标题与文件级表达断言**

```tsx
it("shows finding metadata including file-level fallback", () => {
  render(
    <FindingList
      findings={[
        {
          id: "finding-1",
          severity: "high",
          category: "correctness",
          summary: "未处理空返回值",
          explanation: "调用方没有检查空值",
          file: "src/session.ts",
          confidenceSignals: [],
          status: "file-level"
        }
      ]}
      selectedFindingId={null}
      onSelect={() => {}}
    />
  );

  expect(screen.getByText(/findings/i)).toBeInTheDocument();
  expect(screen.getByText(/file-level/i)).toBeInTheDocument();
});
```

- [ ] **Step 4: 运行列表测试确认失败**

Run: `pnpm --filter @app/review-app test -- finding-list.test.tsx`
Expected: FAIL，提示未渲染 `Findings` 标题或 `file-level` 文案

### Task 2: 重构页面骨架与左侧控制栏

**Files:**
- Modify: `packages/review-app/src/components/layout/app-shell.tsx`
- Modify: `packages/review-app/src/pages/review-session-page.tsx`
- Modify: `packages/review-app/src/components/session/session-progress.tsx`
- Modify: `packages/review-app/src/components/session/review-summary-panel.tsx`
- Modify: `packages/review-app/src/components/session/risk-file-list.tsx`
- Modify: `packages/review-app/src/components/session/finding-list.tsx`
- Modify: `packages/review-app/src/components/session/finding-card.tsx`

- [ ] **Step 1: 升级全局壳层布局**

```tsx
export function AppShell({ children }: PropsWithChildren) {
  return (
    <div className="grid h-full grid-cols-[88px_1fr] bg-[rgb(var(--bg))] text-[rgb(var(--ink))]">
      <aside className="border-r border-[rgb(var(--border-subtle))] bg-[rgb(var(--shell))] px-4 py-5">
        <div className="flex h-full flex-col justify-between">
          <div className="grid gap-6">
            <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[rgb(var(--muted-strong))]">
              Review
            </div>
          </div>
        </div>
      </aside>
      <main className="min-w-0">{children}</main>
    </div>
  );
}
```

- [ ] **Step 2: 在 `ReviewSessionPage` 建立三层工作台**

```tsx
<AppShell>
  <div className="grid h-full grid-cols-[408px_1fr]">
    <aside className="grid min-h-0 grid-rows-[auto_auto_auto_auto_1fr] gap-4 overflow-hidden border-r border-[rgb(var(--border))] bg-[rgb(var(--panel))] p-5">
      <SessionProgress ... />
      <ReviewSummaryPanel ... />
      <RiskFileList ... />
      <FindingList ... />
    </aside>
    <section className="min-w-0 bg-[rgb(var(--panel-muted))] p-4">
      ...
    </section>
  </div>
</AppShell>
```

- [ ] **Step 3: 将进度组件改为执行痕迹条带**

```tsx
export function SessionProgress({ status }: SessionProgressProps) {
  return (
    <section className="rounded-[24px] border border-[rgb(var(--border))] bg-[rgb(var(--panel-elevated))] px-4 py-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[rgb(var(--muted))]">
          Session Status
        </p>
        <span className="rounded-full bg-[rgb(var(--accent-soft))] px-2 py-1 text-[11px] text-[rgb(var(--accent-ink))]">
          {status}
        </span>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: 将摘要改为主结论 + 指标**

```tsx
<section className="grid gap-4 rounded-[28px] border border-[rgb(var(--border))] bg-[rgb(var(--panel-elevated))] p-5">
  <div className="grid gap-2">
    <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[rgb(var(--muted))]">Summary</div>
    <p className="text-sm leading-6 text-[rgb(var(--ink))]">
      本次改动聚焦于审查会话与 diff 验证链路，建议优先核查高风险 finding。
    </p>
  </div>
  <div className="grid grid-cols-3 gap-3">...</div>
</section>
```

- [ ] **Step 5: 重构风险文件与 finding 卡**

```tsx
<section className="grid gap-3 rounded-[24px] border border-[rgb(var(--border))] bg-[rgb(var(--panel-elevated))] p-4">
  <div className="flex items-center justify-between">
    <h2 className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[rgb(var(--muted))]">
      Risk Files
    </h2>
  </div>
</section>
```

```tsx
<button
  className={clsx(
    "grid gap-3 rounded-[22px] border px-4 py-4 text-left transition",
    active
      ? "border-[rgb(var(--accent-border))] bg-[rgb(var(--accent-surface))] shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]"
      : "border-[rgb(var(--border))] bg-[rgb(var(--panel-elevated))] hover:border-[rgb(var(--border-strong))]"
  )}
>
  ...
</button>
```

- [ ] **Step 6: 运行测试确认结构通过**

Run: `pnpm --filter @app/review-app test -- review-session-page.test.tsx finding-list.test.tsx`
Expected: PASS

### Task 3: 重构右侧证据阅读台

**Files:**
- Modify: `packages/review-app/src/components/diff/monaco-diff-viewer.tsx`
- Modify: `packages/review-app/src/components/session/diff-empty-state.tsx`
- Modify: `packages/review-app/src/pages/review-session-page.tsx`

- [ ] **Step 1: 为 diff viewer 增加顶栏与证据摘要条**

```tsx
export function MonacoDiffViewer({ original, modified, finding }: MonacoDiffViewerProps) {
  const evidence = finding.evidence ?? finding.suggestion ?? finding.explanation;

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_auto_1fr] gap-3 rounded-[28px] border border-[rgb(var(--border))] bg-[rgb(var(--panel))] p-4">
      <header className="flex items-start justify-between rounded-[22px] border border-[rgb(var(--border-subtle))] bg-[rgb(var(--panel-elevated))] px-4 py-3">
        ...
      </header>
      <section className="rounded-[20px] bg-[rgb(var(--panel-muted))] px-4 py-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[rgb(var(--muted))]">Evidence</div>
        <p className="mt-2 text-sm leading-6 text-[rgb(var(--ink))]">{evidence}</p>
      </section>
      <div className="min-h-0 overflow-hidden rounded-[24px] border border-[rgb(var(--border-subtle))]">
        <DiffEditor ... />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 为空状态补充工作台引导**

```tsx
export function DiffEmptyState() {
  return (
    <div className="grid h-full place-items-center rounded-[28px] border border-dashed border-[rgb(var(--border))] bg-[rgb(var(--panel))] p-8">
      <div className="grid max-w-md gap-3 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[rgb(var(--muted))]">Evidence Desk</p>
        <h2 className="text-xl font-semibold text-[rgb(var(--ink))]">从左侧选择一条 finding 开始验证</h2>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 在页面层处理文件级提示与空数据降级**

```tsx
const selectedDiff = selectedFinding ? session?.diffByFile[selectedFinding.file] : null;

<MonacoDiffViewer
  original={selectedDiff?.original ?? ""}
  modified={selectedDiff?.modified ?? ""}
  finding={selectedFinding}
/>
```

- [ ] **Step 4: 运行页面测试确认右侧区域通过**

Run: `pnpm --filter @app/review-app test -- review-session-page.test.tsx`
Expected: PASS

### Task 4: 收紧视觉系统并做回归验证

**Files:**
- Modify: `packages/review-app/src/styles/globals.css`
- Test: `packages/review-app/tests/review-session-page.test.tsx`

- [ ] **Step 1: 收紧全局变量与背景**

```css
:root {
  color-scheme: light;
  --bg: 244 241 235;
  --shell: 233 228 220;
  --panel: 252 250 246;
  --panel-elevated: 255 253 249;
  --panel-muted: 246 242 236;
  --ink: 29 31 35;
  --muted: 113 108 101;
  --muted-strong: 88 84 78;
  --accent-ink: 124 62 35;
  --accent-soft: 238 222 208;
  --accent-surface: 244 233 223;
  --accent-border: 184 112 75;
  --border: 219 210 198;
  --border-subtle: 229 222 212;
  --border-strong: 195 182 165;
}

body {
  margin: 0;
  font-family: "SF Pro Display", "PingFang SC", sans-serif;
  background:
    radial-gradient(circle at top left, rgba(184, 112, 75, 0.12), transparent 28%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.22), rgba(255, 255, 255, 0)),
    rgb(var(--bg));
  color: rgb(var(--ink));
}
```

- [ ] **Step 2: 运行工作台相关测试**

Run: `pnpm --filter @app/review-app test -- review-session-page.test.tsx finding-list.test.tsx`
Expected: PASS

- [ ] **Step 3: 运行前端完整测试回归**

Run: `pnpm --filter @app/review-app test`
Expected: PASS

- [ ] **Step 4: 运行前端构建验证**

Run: `pnpm --filter @app/review-app build`
Expected: PASS，输出 Vite 构建产物
