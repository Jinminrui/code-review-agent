# Entry And History UI Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让启动页与历史页统一到当前主工作台的审查编辑台视觉体系中。

**Architecture:** 保持现有 `AppShell` 与路由结构不变，只改造 `ReviewLaunchPage`、`SessionHistoryPage` 及其直接展示组件。启动页采用“说明区 + 发起卡”双区结构，历史页采用“标题区 + 会话卡片流”结构。

**Tech Stack:** React 19、TypeScript 5、Tailwind CSS、React Router、Vitest、Testing Library

---

## Scope Check

本计划只覆盖启动页与历史页的风格统一，不涉及设置页、主工作台或后端 contract，因此可以作为一个独立的小型实现计划执行。

## File Structure Map

- Modify: `packages/review-app/src/pages/review-launch-page.tsx` — 为启动页提供页面级容器
- Modify: `packages/review-app/src/components/launch/launch-review-form.tsx` — 重组为前室说明区 + 发起卡
- Modify: `packages/review-app/src/pages/session-history-page.tsx` — 改造为案卷架式历史卡片流
- Modify: `packages/review-app/tests/review-launch-page.test.tsx` — 增加启动页结构断言并保留提交行为断言
- Create: `packages/review-app/tests/session-history-page.test.tsx` — 新增历史页展示测试

### Task 1: 先用测试锁定新页面层级

**Files:**
- Modify: `packages/review-app/tests/review-launch-page.test.tsx`
- Create: `packages/review-app/tests/session-history-page.test.tsx`

- [ ] **Step 1: 为启动页补结构断言**

```tsx
expect(await screen.findByText(/launch review/i)).toBeInTheDocument();
expect(screen.getByText(/发起一次新审查/i)).toBeInTheDocument();
expect(screen.getByText(/改动摘要/i)).toBeInTheDocument();
```

- [ ] **Step 2: 写历史页测试**

```tsx
it("renders review session cards", async () => {
  window.reviewWorkbenchApi = {
    listRepositories: vi.fn(),
    listBranches: vi.fn(),
    createSession: vi.fn(),
    getSession: vi.fn(),
    listSessions: vi.fn().mockResolvedValue([
      {
        sessionId: "s_1",
        status: "finished",
        repositoryPath: "/repo",
        baseRef: "main",
        targetRef: "feature",
        summary: {
          changedFilesCount: 3,
          findingsCount: 2,
          highSeverityCount: 1,
          files: ["src/a.ts"]
        },
        diffByFile: {
          "src/a.ts": { original: "", modified: "" }
        },
        findings: []
      }
    ]),
    subscribeSession: vi.fn()
  };

  render(
    <MemoryRouter>
      <SessionHistoryPage />
    </MemoryRouter>
  );

  expect(await screen.findByText(/历史会话/i)).toBeInTheDocument();
  expect(screen.getByText(/main -> feature/i)).toBeInTheDocument();
  expect(screen.getByText(/高风险 1/i)).toBeInTheDocument();
});
```

- [ ] **Step 3: 运行精确测试并确认先失败**

Run: `pnpm --filter @app/review-app exec vitest run tests/review-launch-page.test.tsx tests/session-history-page.test.tsx`
Expected: FAIL，提示缺少新结构文案或历史页测试文件尚不存在

### Task 2: 实现启动页“前室 + 发起卡”

**Files:**
- Modify: `packages/review-app/src/pages/review-launch-page.tsx`
- Modify: `packages/review-app/src/components/launch/launch-review-form.tsx`

- [ ] **Step 1: 给启动页页面层预留工作台化容器**

```tsx
export function ReviewLaunchPage() {
  return (
    <AppShell>
      <div className="h-full bg-[rgb(var(--panel-muted))] p-6">
        <LaunchReviewForm />
      </div>
    </AppShell>
  );
}
```

- [ ] **Step 2: 将表单重构为双区布局**

```tsx
<div className="mx-auto grid h-full max-w-6xl items-center gap-6 lg:grid-cols-[1.1fr_0.9fr]">
  <section>...</section>
  <section className="rounded-[30px] border border-[rgb(var(--border))] bg-[rgb(var(--panel-elevated))] p-6">...</section>
</div>
```

- [ ] **Step 3: 在说明区补三条能力摘要**

```tsx
[
  { title: "改动摘要", body: "先理解这次改动集中在哪些文件和链路。" },
  { title: "风险卡片", body: "优先暴露高风险问题与可验证证据。" },
  { title: "Diff 验证", body: "从 finding 直接跳到对应上下文继续核查。" }
]
```

- [ ] **Step 4: 运行启动页测试确认通过**

Run: `pnpm --filter @app/review-app exec vitest run tests/review-launch-page.test.tsx`
Expected: PASS

### Task 3: 实现历史页“案卷架”

**Files:**
- Modify: `packages/review-app/src/pages/session-history-page.tsx`
- Create: `packages/review-app/tests/session-history-page.test.tsx`

- [ ] **Step 1: 将历史页改为标题区 + 卡片流**

```tsx
<div className="mx-auto grid h-full max-w-5xl content-start gap-6 px-8 py-10">
  <section className="grid gap-2">...</section>
  <section className="grid gap-4">...</section>
</div>
```

- [ ] **Step 2: 为每条 session 渲染摘要卡**

```tsx
<Link className="grid gap-4 rounded-[26px] border border-[rgb(var(--border))] bg-[rgb(var(--panel-elevated))] p-5 no-underline transition hover:border-[rgb(var(--border-strong))]">
  ...
</Link>
```

- [ ] **Step 3: 卡片中展示分支、状态与指标**

```tsx
<div className="grid grid-cols-3 gap-3">
  <div>变更文件 {session.summary.changedFilesCount}</div>
  <div>问题总数 {session.summary.findingsCount}</div>
  <div>高风险 {session.summary.highSeverityCount}</div>
</div>
```

- [ ] **Step 4: 运行历史页测试确认通过**

Run: `pnpm --filter @app/review-app exec vitest run tests/session-history-page.test.tsx`
Expected: PASS

### Task 4: 回归验证

**Files:**
- Test: `packages/review-app/tests/review-launch-page.test.tsx`
- Test: `packages/review-app/tests/session-history-page.test.tsx`

- [ ] **Step 1: 运行相关页面测试**

Run: `pnpm --filter @app/review-app exec vitest run tests/review-launch-page.test.tsx tests/session-history-page.test.tsx tests/review-session-page.test.tsx`
Expected: PASS

- [ ] **Step 2: 运行前端全量测试**

Run: `pnpm --filter @app/review-app test`
Expected: PASS

- [ ] **Step 3: 运行前端构建**

Run: `pnpm --filter @app/review-app build`
Expected: PASS
