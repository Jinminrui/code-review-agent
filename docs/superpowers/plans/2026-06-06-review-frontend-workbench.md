# Review Frontend Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建桌面端可视化代码审查 Agent 的前端工作台，包括仓库/分支选择、审查会话列表、问题卡片流、右侧 diff 详情和渐进式执行状态展示。

**Architecture:** 前端运行在 Electron renderer 中，使用 React 单页应用承载全部界面，通过类型化 IPC contract 调用主进程后端。状态按“路由页 + 领域 store + 视图组件”拆分：页面负责场景编排，store 负责会话和选中状态，组件只负责展示和交互。

**Tech Stack:** React 19、TypeScript 5、Vite、React Router、Zustand、TanStack Query、Vitest、Testing Library、Playwright、Tailwind CSS、shadcn/ui、Monaco Diff Editor

---

## 技术选型与架构决策

### 1. 技术选型

1. `React 19`
   原因：适合构建状态驱动的复杂桌面 UI，后续可以平滑接入并发特性处理长任务流。
2. `Vite`
   原因：renderer 开发体验快，和 Electron 组合成熟，适合小团队快速迭代。
3. `React Router`
   原因：MVP 至少有“新建审查”、“会话详情”、“设置”三个场景，显式路由比单页条件渲染更稳。
4. `Zustand`
   原因：适合本地交互状态，例如选中的 finding、展开的文件、面板宽度，不会过度工程化。
5. `TanStack Query`
   原因：适合管理会话列表、会话详情、重跑结果等异步数据，以及 IPC 返回的数据缓存与失效。
6. `Tailwind CSS + shadcn/ui`
   原因：能快速构建有一致性的桌面风格组件，同时保留足够的定制空间，避免默认 Electron 应用的粗糙感。
7. `Monaco Diff Editor`
   原因：右侧代码视图是产品核心，Monaco 在行号、decorations、scroll reveal、代码语义感受上明显优于手写 diff DOM。
8. `Vitest + Testing Library + Playwright`
   原因：分别覆盖组件单测、交互测试和 Electron 场景级 E2E。

### 2. 前端目录结构

```text
packages/
  review-app/
    package.json
    tsconfig.json
    vite.config.ts
    index.html
    src/
      main.tsx
      app/
        router.tsx
        providers.tsx
      pages/
        review-launch-page.tsx
        review-session-page.tsx
        settings-page.tsx
      components/
        layout/
          app-shell.tsx
          split-pane.tsx
        launch/
          repository-picker.tsx
          branch-selector.tsx
          launch-review-form.tsx
        session/
          review-summary-panel.tsx
          risk-file-list.tsx
          finding-list.tsx
          finding-card.tsx
          session-progress.tsx
          diff-toolbar.tsx
          diff-empty-state.tsx
        diff/
          monaco-diff-viewer.tsx
          finding-decorations.ts
          line-range.ts
        settings/
          provider-profile-form.tsx
          privacy-settings-form.tsx
      hooks/
        use-review-session-stream.ts
        use-selected-finding.ts
        use-monaco-reveal.ts
      store/
        review-session-store.ts
        workbench-ui-store.ts
      lib/
        ipc-client.ts
        review-model.ts
        review-view-model.ts
        severity.ts
      test/
        fake-review-session.ts
      styles/
        globals.css
    tests/
      review-launch-page.test.tsx
      review-session-page.test.tsx
      finding-list.test.tsx
      use-review-session-stream.test.tsx
      app.e2e.spec.ts
```

### 3. 前端架构约束

1. 前端只消费结构化模型，不直接解析 LLM 原始文本。
2. renderer 不直接访问文件系统和 git，所有仓库/会话能力都通过 IPC client 获取。
3. 单个 store 不同时承担“远程数据缓存”和“瞬时 UI 状态”两类职责。
4. diff 视图必须支持“根据 finding 自动滚动定位”和“定位失败时文件级降级高亮”。
5. 第一版不做复杂虚拟列表，优先保证结构清晰和交互可靠；如果大列表出现性能问题，再做局部优化。

## 任务拆分总览

本计划只覆盖“前端工作台子系统”，不包含 Electron 主进程实现和后端审查引擎代码。完成本计划后，应得到一个能发起审查、查看会话、消费渐进式结果并定位到 diff 的 renderer 应用。

### Task 1: 初始化前端包、Vite 与样式系统

**Files:**
- Create: `packages/review-app/package.json`
- Create: `packages/review-app/tsconfig.json`
- Create: `packages/review-app/vite.config.ts`
- Create: `packages/review-app/index.html`
- Create: `packages/review-app/src/main.tsx`
- Create: `packages/review-app/src/styles/globals.css`
- Test: `packages/review-app/package.json`

- [ ] **Step 1: 先写工具链冒烟命令**

Run: `pnpm --version`
Expected: 输出 pnpm 版本

Run: `node --version`
Expected: 输出 Node 22 兼容版本

- [ ] **Step 2: 创建前端包配置**

```json
{
  "name": "@app/review-app",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "test": "vitest run",
    "test:e2e": "playwright test"
  },
  "dependencies": {
    "@monaco-editor/react": "^4.7.0",
    "@tanstack/react-query": "^5.80.7",
    "clsx": "^2.1.1",
    "monaco-editor": "^0.52.2",
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "react-router-dom": "^7.6.2",
    "zustand": "^5.0.5",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@playwright/test": "^1.53.0",
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.3.0",
    "@testing-library/user-event": "^14.6.1",
    "@types/react": "^19.1.6",
    "@types/react-dom": "^19.1.5",
    "@vitejs/plugin-react": "^4.4.1",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.5.3",
    "tailwindcss": "^3.4.17",
    "typescript": "^5.8.3",
    "vite": "^6.3.5",
    "vitest": "^3.1.4"
  }
}
```

- [ ] **Step 3: 创建 TS 与 Vite 配置**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "types": ["vite/client"],
    "rootDir": "src",
    "outDir": "dist",
    "composite": true
  },
  "include": ["src/**/*.ts", "src/**/*.tsx", "tests/**/*.ts", "tests/**/*.tsx"]
}
```

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src")
    }
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"]
  }
});
```

- [ ] **Step 4: 创建基础入口和全局样式**

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Review Workbench</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  color-scheme: light;
  --bg: 248 247 242;
  --panel: 255 255 252;
  --ink: 31 35 41;
  --muted: 103 112 123;
  --accent: 196 84 37;
  --border: 223 216 206;
}

html,
body,
#root {
  height: 100%;
}

body {
  margin: 0;
  font-family: "SF Pro Display", "PingFang SC", sans-serif;
  background: radial-gradient(circle at top left, rgba(196, 84, 37, 0.12), transparent 32%), rgb(var(--bg));
  color: rgb(var(--ink));
}
```

```ts
import React from "react";
import ReactDOM from "react-dom/client";
import { AppProviders } from "./app/providers";
import { AppRouter } from "./app/router";
import "./styles/globals.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppProviders>
      <AppRouter />
    </AppProviders>
  </React.StrictMode>
);
```

- [ ] **Step 5: 安装依赖并验证前端包可启动**

Run: `pnpm install`
Expected: 安装完成

Run: `pnpm --filter @app/review-app build`
Expected: 构建成功

- [ ] **Step 6: Commit**

```bash
git add packages/review-app
git commit -m "chore: bootstrap review app renderer"
```

### Task 2: 定义前端模型、IPC Client 和应用级 Providers

**Files:**
- Create: `packages/review-app/src/lib/review-model.ts`
- Create: `packages/review-app/src/lib/ipc-client.ts`
- Create: `packages/review-app/src/app/providers.tsx`
- Create: `packages/review-app/src/app/router.tsx`
- Create: `packages/review-app/src/test/setup.ts`
- Create: `packages/review-app/tests/review-model.test.ts`
- Modify: `packages/review-app/src/main.tsx`

- [ ] **Step 1: 先写失败测试，锁定前端消费的 review model**

```ts
import { describe, expect, it } from "vitest";
import { reviewSessionDetailSchema } from "../src/lib/review-model";

describe("reviewSessionDetailSchema", () => {
  it("accepts a minimal session detail payload", () => {
    const result = reviewSessionDetailSchema.parse({
      sessionId: "s_1",
      status: "running",
      repositoryPath: "/repo",
      baseRef: "main",
      targetRef: "feature",
      summary: {
        changedFilesCount: 1,
        findingsCount: 0,
        highSeverityCount: 0,
        files: ["src/a.ts"]
      },
      findings: []
    });

    expect(result.summary.changedFilesCount).toBe(1);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm --filter @app/review-app test packages/review-app/tests/review-model.test.ts`
Expected: FAIL，提示 `reviewSessionDetailSchema` 未定义

- [ ] **Step 3: 实现 review model 与 IPC client contract**

```ts
import { z } from "zod";

export const reviewFindingSchema = z.object({
  id: z.string(),
  severity: z.enum(["high", "medium", "low"]),
  category: z.string(),
  summary: z.string(),
  explanation: z.string(),
  file: z.string(),
  startLine: z.number().optional(),
  endLine: z.number().optional(),
  evidence: z.string().optional(),
  suggestion: z.string().optional(),
  confidenceSignals: z.array(z.string()),
  status: z.enum(["line-level", "file-level"])
});

export const reviewSessionDetailSchema = z.object({
  sessionId: z.string(),
  status: z.enum(["idle", "running", "partial", "finished", "failed"]),
  repositoryPath: z.string(),
  baseRef: z.string(),
  targetRef: z.string(),
  summary: z.object({
    changedFilesCount: z.number(),
    findingsCount: z.number(),
    highSeverityCount: z.number(),
    files: z.array(z.string())
  }),
  findings: z.array(reviewFindingSchema)
});

export type ReviewSessionDetail = z.infer<typeof reviewSessionDetailSchema>;
```

```ts
import type { ReviewSessionDetail } from "./review-model";

export type CreateSessionInput = {
  repositoryPath: string;
  baseRef: string;
  targetRef: string;
  providerProfileId: string;
};

export type ReviewWorkbenchApi = {
  listRepositories(): Promise<string[]>;
  listBranches(repositoryPath: string): Promise<string[]>;
  createSession(input: CreateSessionInput): Promise<{ sessionId: string }>;
  getSession(sessionId: string): Promise<ReviewSessionDetail>;
  listSessions(): Promise<ReviewSessionDetail[]>;
  subscribeSession(sessionId: string, onEvent: (event: unknown) => void): () => void;
};

declare global {
  interface Window {
    reviewWorkbenchApi: ReviewWorkbenchApi;
  }
}

export const ipcClient = {
  listRepositories: () => window.reviewWorkbenchApi.listRepositories(),
  listBranches: (repositoryPath: string) => window.reviewWorkbenchApi.listBranches(repositoryPath),
  createSession: (input: CreateSessionInput) => window.reviewWorkbenchApi.createSession(input),
  getSession: (sessionId: string) => window.reviewWorkbenchApi.getSession(sessionId),
  listSessions: () => window.reviewWorkbenchApi.listSessions(),
  subscribeSession: (sessionId: string, onEvent: (event: unknown) => void) =>
    window.reviewWorkbenchApi.subscribeSession(sessionId, onEvent)
};
```

- [ ] **Step 4: 创建应用 Providers 和 Router**

```ts
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";

const queryClient = new QueryClient();

export function AppProviders({ children }: PropsWithChildren) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
```

```ts
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { ReviewLaunchPage } from "@/pages/review-launch-page";
import { ReviewSessionPage } from "@/pages/review-session-page";
import { SettingsPage } from "@/pages/settings-page";

const router = createMemoryRouter([
  { path: "/", element: <ReviewLaunchPage /> },
  { path: "/sessions/:sessionId", element: <ReviewSessionPage /> },
  { path: "/settings", element: <SettingsPage /> }
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
```

- [ ] **Step 5: 补充测试环境文件**

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 6: 运行测试**

Run: `pnpm --filter @app/review-app test packages/review-app/tests/review-model.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add packages/review-app/src/lib packages/review-app/src/app packages/review-app/src/test packages/review-app/tests/review-model.test.ts packages/review-app/src/main.tsx
git commit -m "feat: define review app contracts and providers"
```

### Task 3: 实现新建审查页与仓库/分支选择表单

**Files:**
- Create: `packages/review-app/src/pages/review-launch-page.tsx`
- Create: `packages/review-app/src/components/layout/app-shell.tsx`
- Create: `packages/review-app/src/components/launch/repository-picker.tsx`
- Create: `packages/review-app/src/components/launch/branch-selector.tsx`
- Create: `packages/review-app/src/components/launch/launch-review-form.tsx`
- Create: `packages/review-app/tests/review-launch-page.test.tsx`
- Modify: `packages/review-app/src/app/router.tsx`

- [ ] **Step 1: 先写失败测试，锁定创建 session 入口**

```ts
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReviewLaunchPage } from "../src/pages/review-launch-page";

describe("ReviewLaunchPage", () => {
  it("submits repository and branch selection", async () => {
    window.reviewWorkbenchApi = {
      listRepositories: vi.fn().mockResolvedValue(["/repo"]),
      listBranches: vi.fn().mockResolvedValue(["main", "feature"]),
      createSession: vi.fn().mockResolvedValue({ sessionId: "s_1" }),
      getSession: vi.fn(),
      listSessions: vi.fn().mockResolvedValue([]),
      subscribeSession: vi.fn()
    };

    render(<ReviewLaunchPage />);

    fireEvent.change(await screen.findByLabelText("仓库"), { target: { value: "/repo" } });
    fireEvent.change(await screen.findByLabelText("Base 分支"), { target: { value: "main" } });
    fireEvent.change(await screen.findByLabelText("Target 分支"), { target: { value: "feature" } });
    fireEvent.click(screen.getByRole("button", { name: "开始审查" }));

    expect(window.reviewWorkbenchApi.createSession).toHaveBeenCalledWith({
      repositoryPath: "/repo",
      baseRef: "main",
      targetRef: "feature",
      providerProfileId: "default"
    });
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm --filter @app/review-app test packages/review-app/tests/review-launch-page.test.tsx`
Expected: FAIL，提示组件或标签不存在

- [ ] **Step 3: 实现页面壳与表单组件**

```ts
import type { PropsWithChildren } from "react";

export function AppShell({ children }: PropsWithChildren) {
  return (
    <div className="grid h-full grid-cols-[280px_1fr] bg-[rgb(var(--bg))]">
      <aside className="border-r border-[rgb(var(--border))] bg-[rgb(var(--panel))] p-4">
        <div className="text-sm font-semibold tracking-[0.2em] text-[rgb(var(--muted))]">REVIEW WORKBENCH</div>
      </aside>
      <main className="min-w-0">{children}</main>
    </div>
  );
}
```

```ts
type RepositoryPickerProps = {
  repositories: string[];
  value: string;
  onChange(value: string): void;
};

export function RepositoryPicker(props: RepositoryPickerProps) {
  return (
    <label className="grid gap-2 text-sm">
      <span>仓库</span>
      <select aria-label="仓库" value={props.value} onChange={(event) => props.onChange(event.target.value)}>
        <option value="">请选择仓库</option>
        {props.repositories.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>
    </label>
  );
}
```

```ts
type BranchSelectorProps = {
  label: string;
  value: string;
  branches: string[];
  onChange(value: string): void;
};

export function BranchSelector(props: BranchSelectorProps) {
  return (
    <label className="grid gap-2 text-sm">
      <span>{props.label}</span>
      <select aria-label={props.label} value={props.value} onChange={(event) => props.onChange(event.target.value)}>
        <option value="">请选择分支</option>
        {props.branches.map((branch) => (
          <option key={branch} value={branch}>
            {branch}
          </option>
        ))}
      </select>
    </label>
  );
}
```

```ts
import { useEffect, useState, startTransition } from "react";
import { useNavigate } from "react-router-dom";
import { ipcClient } from "@/lib/ipc-client";
import { RepositoryPicker } from "./repository-picker";
import { BranchSelector } from "./branch-selector";

export function LaunchReviewForm() {
  const navigate = useNavigate();
  const [repositories, setRepositories] = useState<string[]>([]);
  const [branches, setBranches] = useState<string[]>([]);
  const [repositoryPath, setRepositoryPath] = useState("");
  const [baseRef, setBaseRef] = useState("");
  const [targetRef, setTargetRef] = useState("");

  useEffect(() => {
    ipcClient.listRepositories().then(setRepositories);
  }, []);

  useEffect(() => {
    if (!repositoryPath) {
      setBranches([]);
      return;
    }
    ipcClient.listBranches(repositoryPath).then(setBranches);
  }, [repositoryPath]);

  async function handleSubmit() {
    const session = await ipcClient.createSession({
      repositoryPath,
      baseRef,
      targetRef,
      providerProfileId: "default"
    });

    startTransition(() => {
      navigate(`/sessions/${session.sessionId}`);
    });
  }

  return (
    <div className="mx-auto grid max-w-3xl gap-6 p-10">
      <RepositoryPicker repositories={repositories} value={repositoryPath} onChange={setRepositoryPath} />
      <BranchSelector label="Base 分支" value={baseRef} branches={branches} onChange={setBaseRef} />
      <BranchSelector label="Target 分支" value={targetRef} branches={branches} onChange={setTargetRef} />
      <button className="h-11 rounded-full bg-[rgb(var(--accent))] px-6 text-white" onClick={handleSubmit}>
        开始审查
      </button>
    </div>
  );
}
```

```ts
import { AppShell } from "@/components/layout/app-shell";
import { LaunchReviewForm } from "@/components/launch/launch-review-form";

export function ReviewLaunchPage() {
  return (
    <AppShell>
      <LaunchReviewForm />
    </AppShell>
  );
}
```

- [ ] **Step 4: 运行测试验证通过**

Run: `pnpm --filter @app/review-app test packages/review-app/tests/review-launch-page.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/review-app/src/pages/review-launch-page.tsx packages/review-app/src/components/layout/app-shell.tsx packages/review-app/src/components/launch packages/review-app/tests/review-launch-page.test.tsx
git commit -m "feat: add review launch page"
```

### Task 4: 实现会话详情页骨架、store 和渐进式事件订阅

**Files:**
- Create: `packages/review-app/src/store/review-session-store.ts`
- Create: `packages/review-app/src/hooks/use-review-session-stream.ts`
- Create: `packages/review-app/src/pages/review-session-page.tsx`
- Create: `packages/review-app/src/components/session/session-progress.tsx`
- Create: `packages/review-app/src/components/session/diff-empty-state.tsx`
- Create: `packages/review-app/tests/use-review-session-stream.test.tsx`
- Create: `packages/review-app/tests/review-session-page.test.tsx`

- [ ] **Step 1: 先写失败测试，锁定事件流合并行为**

```ts
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useReviewSessionStream } from "../src/hooks/use-review-session-stream";

describe("useReviewSessionStream", () => {
  it("subscribes to a session and unsubscribes on cleanup", () => {
    const unsubscribe = vi.fn();
    window.reviewWorkbenchApi = {
      listRepositories: vi.fn(),
      listBranches: vi.fn(),
      createSession: vi.fn(),
      getSession: vi.fn().mockResolvedValue({
        sessionId: "s_1",
        status: "running",
        repositoryPath: "/repo",
        baseRef: "main",
        targetRef: "feature",
        summary: { changedFilesCount: 0, findingsCount: 0, highSeverityCount: 0, files: [] },
        findings: []
      }),
      listSessions: vi.fn(),
      subscribeSession: vi.fn().mockReturnValue(unsubscribe)
    };

    const { unmount } = renderHook(() => useReviewSessionStream("s_1"));
    unmount();

    expect(window.reviewWorkbenchApi.subscribeSession).toHaveBeenCalledWith("s_1", expect.any(Function));
    expect(unsubscribe).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm --filter @app/review-app test packages/review-app/tests/use-review-session-stream.test.tsx`
Expected: FAIL，提示 hook 未定义

- [ ] **Step 3: 实现 session store 和事件流 hook**

```ts
import { create } from "zustand";
import type { ReviewSessionDetail } from "@/lib/review-model";

type ReviewSessionStore = {
  selectedFindingId: string | null;
  session: ReviewSessionDetail | null;
  setSession(session: ReviewSessionDetail): void;
  setSelectedFinding(id: string | null): void;
};

export const useReviewSessionStore = create<ReviewSessionStore>((set) => ({
  selectedFindingId: null,
  session: null,
  setSession: (session) => set({ session }),
  setSelectedFinding: (selectedFindingId) => set({ selectedFindingId })
}));
```

```ts
import { useEffect } from "react";
import { ipcClient } from "@/lib/ipc-client";
import { useReviewSessionStore } from "@/store/review-session-store";

export function useReviewSessionStream(sessionId: string) {
  const setSession = useReviewSessionStore((state) => state.setSession);

  useEffect(() => {
    let active = true;

    ipcClient.getSession(sessionId).then((session) => {
      if (active) {
        setSession(session);
      }
    });

    const unsubscribe = ipcClient.subscribeSession(sessionId, async () => {
      const next = await ipcClient.getSession(sessionId);
      if (active) {
        setSession(next);
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [sessionId, setSession]);
}
```

- [ ] **Step 4: 实现会话详情页最小骨架**

```ts
import { useParams } from "react-router-dom";
import { AppShell } from "@/components/layout/app-shell";
import { SessionProgress } from "@/components/session/session-progress";
import { DiffEmptyState } from "@/components/session/diff-empty-state";
import { useReviewSessionStore } from "@/store/review-session-store";
import { useReviewSessionStream } from "@/hooks/use-review-session-stream";

export function ReviewSessionPage() {
  const { sessionId = "" } = useParams();
  useReviewSessionStream(sessionId);
  const session = useReviewSessionStore((state) => state.session);

  return (
    <AppShell>
      <div className="grid h-full grid-cols-[360px_1fr]">
        <aside className="border-r border-[rgb(var(--border))] bg-[rgb(var(--panel))] p-4">
          <SessionProgress status={session?.status ?? "idle"} />
        </aside>
        <section className="min-w-0">
          <DiffEmptyState />
        </section>
      </div>
    </AppShell>
  );
}
```

```ts
type SessionProgressProps = {
  status: "idle" | "running" | "partial" | "finished" | "failed";
};

export function SessionProgress({ status }: SessionProgressProps) {
  return <div className="rounded-2xl border border-[rgb(var(--border))] p-4 text-sm">当前状态：{status}</div>;
}
```

```ts
export function DiffEmptyState() {
  return (
    <div className="grid h-full place-items-center text-sm text-[rgb(var(--muted))]">
      选择一个问题卡片后，这里会显示对应的 diff 详情
    </div>
  );
}
```

- [ ] **Step 5: 运行测试**

Run: `pnpm --filter @app/review-app test packages/review-app/tests/use-review-session-stream.test.tsx packages/review-app/tests/review-session-page.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/review-app/src/store packages/review-app/src/hooks packages/review-app/src/pages/review-session-page.tsx packages/review-app/src/components/session/session-progress.tsx packages/review-app/src/components/session/diff-empty-state.tsx packages/review-app/tests/use-review-session-stream.test.tsx packages/review-app/tests/review-session-page.test.tsx
git commit -m "feat: add session page skeleton and streaming state"
```

### Task 5: 实现左侧摘要面板、风险文件列表和问题卡片流

**Files:**
- Create: `packages/review-app/src/lib/severity.ts`
- Create: `packages/review-app/src/components/session/review-summary-panel.tsx`
- Create: `packages/review-app/src/components/session/risk-file-list.tsx`
- Create: `packages/review-app/src/components/session/finding-list.tsx`
- Create: `packages/review-app/src/components/session/finding-card.tsx`
- Create: `packages/review-app/tests/finding-list.test.tsx`
- Modify: `packages/review-app/src/pages/review-session-page.tsx`

- [ ] **Step 1: 先写失败测试，锁定卡片点击选中行为**

```ts
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FindingList } from "../src/components/session/finding-list";

describe("FindingList", () => {
  it("calls onSelect when a finding is clicked", () => {
    const onSelect = vi.fn();
    render(
      <FindingList
        findings={[
          {
            id: "f_1",
            severity: "high",
            category: "bug-risk",
            summary: "空值保护缺失",
            explanation: "调用链可能传入 undefined",
            file: "src/a.ts",
            confidenceSignals: [],
            status: "file-level"
          }
        ]}
        selectedFindingId={null}
        onSelect={onSelect}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /空值保护缺失/ }));
    expect(onSelect).toHaveBeenCalledWith("f_1");
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm --filter @app/review-app test packages/review-app/tests/finding-list.test.tsx`
Expected: FAIL，提示 `FindingList` 未定义

- [ ] **Step 3: 实现摘要与 finding 组件**

```ts
export const severityTone = {
  high: "bg-red-50 text-red-700 border-red-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  low: "bg-slate-50 text-slate-700 border-slate-200"
} as const;
```

```ts
type ReviewSummaryPanelProps = {
  changedFilesCount: number;
  findingsCount: number;
  highSeverityCount: number;
};

export function ReviewSummaryPanel(props: ReviewSummaryPanelProps) {
  return (
    <div className="grid gap-3 rounded-3xl border border-[rgb(var(--border))] bg-[rgb(var(--panel))] p-4">
      <div className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">Summary</div>
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl bg-stone-100 p-3 text-sm">变更文件 {props.changedFilesCount}</div>
        <div className="rounded-2xl bg-stone-100 p-3 text-sm">问题总数 {props.findingsCount}</div>
        <div className="rounded-2xl bg-stone-100 p-3 text-sm">高风险 {props.highSeverityCount}</div>
      </div>
    </div>
  );
}
```

```ts
type RiskFileListProps = {
  files: string[];
};

export function RiskFileList({ files }: RiskFileListProps) {
  return (
    <div className="grid gap-2">
      {files.map((file) => (
        <div key={file} className="rounded-2xl border border-[rgb(var(--border))] px-3 py-2 text-sm">
          {file}
        </div>
      ))}
    </div>
  );
}
```

```ts
import { severityTone } from "@/lib/severity";
import type { ReviewSessionDetail } from "@/lib/review-model";

type FindingCardProps = {
  finding: ReviewSessionDetail["findings"][number];
  active: boolean;
  onSelect(id: string): void;
};

export function FindingCard({ finding, active, onSelect }: FindingCardProps) {
  return (
    <button
      className={`grid gap-2 rounded-3xl border p-4 text-left ${severityTone[finding.severity]} ${active ? "ring-2 ring-[rgb(var(--accent))]" : ""}`}
      onClick={() => onSelect(finding.id)}
    >
      <div className="flex items-center justify-between text-xs uppercase">
        <span>{finding.severity}</span>
        <span>{finding.file}</span>
      </div>
      <div className="font-medium">{finding.summary}</div>
      <div className="text-sm opacity-80">{finding.explanation}</div>
    </button>
  );
}
```

```ts
import type { ReviewSessionDetail } from "@/lib/review-model";
import { FindingCard } from "./finding-card";

type FindingListProps = {
  findings: ReviewSessionDetail["findings"];
  selectedFindingId: string | null;
  onSelect(id: string): void;
};

export function FindingList({ findings, selectedFindingId, onSelect }: FindingListProps) {
  return (
    <div className="grid gap-3">
      {findings.map((finding) => (
        <FindingCard key={finding.id} finding={finding} active={finding.id === selectedFindingId} onSelect={onSelect} />
      ))}
    </div>
  );
}
```

- [ ] **Step 4: 把左栏接到会话详情页**

```ts
import { ReviewSummaryPanel } from "@/components/session/review-summary-panel";
import { RiskFileList } from "@/components/session/risk-file-list";
import { FindingList } from "@/components/session/finding-list";
import { useReviewSessionStore } from "@/store/review-session-store";

const selectedFindingId = useReviewSessionStore((state) => state.selectedFindingId);
const setSelectedFinding = useReviewSessionStore((state) => state.setSelectedFinding);

<aside className="grid gap-4 overflow-auto border-r border-[rgb(var(--border))] bg-[rgb(var(--panel))] p-4">
  <SessionProgress status={session?.status ?? "idle"} />
  {session ? (
    <>
      <ReviewSummaryPanel
        changedFilesCount={session.summary.changedFilesCount}
        findingsCount={session.summary.findingsCount}
        highSeverityCount={session.summary.highSeverityCount}
      />
      <RiskFileList files={session.summary.files} />
      <FindingList findings={session.findings} selectedFindingId={selectedFindingId} onSelect={setSelectedFinding} />
    </>
  ) : null}
</aside>
```

- [ ] **Step 5: 运行测试**

Run: `pnpm --filter @app/review-app test packages/review-app/tests/finding-list.test.tsx packages/review-app/tests/review-session-page.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/review-app/src/lib/severity.ts packages/review-app/src/components/session packages/review-app/src/pages/review-session-page.tsx packages/review-app/tests/finding-list.test.tsx
git commit -m "feat: add finding list and summary sidebar"
```

### Task 6: 实现右侧 Monaco Diff Viewer 与 finding 定位

**Files:**
- Create: `packages/review-app/src/components/diff/monaco-diff-viewer.tsx`
- Create: `packages/review-app/src/components/diff/finding-decorations.ts`
- Create: `packages/review-app/src/components/diff/line-range.ts`
- Create: `packages/review-app/src/hooks/use-selected-finding.ts`
- Create: `packages/review-app/src/hooks/use-monaco-reveal.ts`
- Modify: `packages/review-app/src/pages/review-session-page.tsx`

- [ ] **Step 1: 先写失败测试，锁定 line range 计算**

```ts
import { describe, expect, it } from "vitest";
import { toLineRange } from "../src/components/diff/line-range";

describe("toLineRange", () => {
  it("uses file-level fallback when no startLine exists", () => {
    expect(toLineRange({ status: "file-level" })).toEqual({ startLine: 1, endLine: 1 });
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm --filter @app/review-app test packages/review-app/tests/review-session-page.test.tsx`
Expected: FAIL，提示 `toLineRange` 未定义

- [ ] **Step 3: 实现 line range 和 finding 选择 hook**

```ts
type FindingLike = {
  startLine?: number;
  endLine?: number;
  status: "line-level" | "file-level";
};

export function toLineRange(finding: FindingLike) {
  if (finding.status === "file-level" || !finding.startLine) {
    return { startLine: 1, endLine: 1 };
  }

  return {
    startLine: finding.startLine,
    endLine: finding.endLine ?? finding.startLine
  };
}
```

```ts
import { useReviewSessionStore } from "@/store/review-session-store";

export function useSelectedFinding() {
  return useReviewSessionStore((state) =>
    state.session?.findings.find((finding) => finding.id === state.selectedFindingId) ?? null
  );
}
```

- [ ] **Step 4: 实现 Monaco Diff Viewer**

```ts
import Editor from "@monaco-editor/react";
import { useMemo } from "react";
import { toLineRange } from "./line-range";

type MonacoDiffViewerProps = {
  original: string;
  modified: string;
  finding: { startLine?: number; endLine?: number; status: "line-level" | "file-level" } | null;
};

export function MonacoDiffViewer({ original, modified, finding }: MonacoDiffViewerProps) {
  const range = useMemo(() => (finding ? toLineRange(finding) : null), [finding]);

  return (
    <div className="h-full">
      <Editor
        height="100%"
        defaultLanguage="typescript"
        options={{ readOnly: true, minimap: { enabled: false } }}
        value={modified}
        beforeMount={(monaco) => {
          monaco.editor.defineTheme("review-workbench", {
            base: "vs",
            inherit: true,
            rules: [],
            colors: {
              "editor.background": "#fffdfa"
            }
          });
        }}
        onMount={(editor, monaco) => {
          monaco.editor.setTheme("review-workbench");
          if (range) {
            editor.revealLineInCenter(range.startLine);
            editor.createDecorationsCollection([
              {
                range: new monaco.Range(range.startLine, 1, range.endLine, 1),
                options: {
                  isWholeLine: true,
                  className: "review-finding-line"
                }
              }
            ]);
          }
        }}
      />
    </div>
  );
}
```

- [ ] **Step 5: 把右侧接入会话页**

```ts
import { MonacoDiffViewer } from "@/components/diff/monaco-diff-viewer";
import { useSelectedFinding } from "@/hooks/use-selected-finding";

const selectedFinding = useSelectedFinding();

<section className="min-w-0">
  {selectedFinding ? (
    <MonacoDiffViewer original="" modified={selectedFinding.evidence ?? selectedFinding.explanation} finding={selectedFinding} />
  ) : (
    <DiffEmptyState />
  )}
</section>
```

- [ ] **Step 6: 运行测试与构建**

Run: `pnpm --filter @app/review-app test`
Expected: PASS

Run: `pnpm --filter @app/review-app build`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add packages/review-app/src/components/diff packages/review-app/src/hooks/use-selected-finding.ts packages/review-app/src/hooks/use-monaco-reveal.ts packages/review-app/src/pages/review-session-page.tsx
git commit -m "feat: add diff viewer and finding reveal"
```

### Task 7: 实现设置页、Provider 配置表单与隐私说明

**Files:**
- Create: `packages/review-app/src/pages/settings-page.tsx`
- Create: `packages/review-app/src/components/settings/provider-profile-form.tsx`
- Create: `packages/review-app/src/components/settings/privacy-settings-form.tsx`
- Modify: `packages/review-app/src/app/router.tsx`

- [ ] **Step 1: 先写失败测试，锁定设置页的核心说明**

```ts
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SettingsPage } from "../src/pages/settings-page";

describe("SettingsPage", () => {
  it("explains what data will be sent to the provider", () => {
    render(<SettingsPage />);
    expect(screen.getByText("会发送到模型的内容")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm --filter @app/review-app test packages/review-app/tests/review-session-page.test.tsx`
Expected: FAIL，提示 `SettingsPage` 未定义

- [ ] **Step 3: 实现设置页和表单**

```ts
export function ProviderProfileForm() {
  return (
    <section className="grid gap-3 rounded-3xl border border-[rgb(var(--border))] bg-[rgb(var(--panel))] p-5">
      <h2 className="text-lg font-semibold">Provider 配置</h2>
      <label className="grid gap-2 text-sm">
        <span>模型地址</span>
        <input aria-label="模型地址" className="h-10 rounded-2xl border px-3" />
      </label>
      <label className="grid gap-2 text-sm">
        <span>模型名称</span>
        <input aria-label="模型名称" className="h-10 rounded-2xl border px-3" />
      </label>
    </section>
  );
}
```

```ts
export function PrivacySettingsForm() {
  return (
    <section className="grid gap-3 rounded-3xl border border-[rgb(var(--border))] bg-[rgb(var(--panel))] p-5">
      <h2 className="text-lg font-semibold">会发送到模型的内容</h2>
      <ul className="list-disc pl-5 text-sm text-[rgb(var(--muted))]">
        <li>分支 diff</li>
        <li>必要代码片段</li>
        <li>补充上下文文件内容</li>
      </ul>
    </section>
  );
}
```

```ts
import { AppShell } from "@/components/layout/app-shell";
import { PrivacySettingsForm } from "@/components/settings/privacy-settings-form";
import { ProviderProfileForm } from "@/components/settings/provider-profile-form";

export function SettingsPage() {
  return (
    <AppShell>
      <div className="mx-auto grid max-w-4xl gap-6 p-10">
        <ProviderProfileForm />
        <PrivacySettingsForm />
      </div>
    </AppShell>
  );
}
```

- [ ] **Step 4: 运行测试**

Run: `pnpm --filter @app/review-app test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/review-app/src/pages/settings-page.tsx packages/review-app/src/components/settings packages/review-app/src/app/router.tsx
git commit -m "feat: add settings and privacy page"
```

### Task 8: 增加 E2E 流程与桌面场景验证

**Files:**
- Create: `packages/review-app/tests/app.e2e.spec.ts`
- Modify: `packages/review-app/package.json`
- Modify: `packages/review-app/src/test/setup.ts`

- [ ] **Step 1: 先写 E2E 场景脚本**

```ts
import { test, expect } from "@playwright/test";

test("launches a session and opens the detail workbench", async ({ page }) => {
  await page.goto("http://127.0.0.1:4173");
  await page.getByLabel("仓库").selectOption("/repo");
  await page.getByLabel("Base 分支").selectOption("main");
  await page.getByLabel("Target 分支").selectOption("feature");
  await page.getByRole("button", { name: "开始审查" }).click();
  await expect(page.getByText("当前状态")).toBeVisible();
});
```

- [ ] **Step 2: 提供测试态 mock API 注入**

```ts
if (!window.reviewWorkbenchApi) {
  window.reviewWorkbenchApi = {
    listRepositories: async () => ["/repo"],
    listBranches: async () => ["main", "feature"],
    createSession: async () => ({ sessionId: "s_1" }),
    getSession: async () => ({
      sessionId: "s_1",
      status: "finished",
      repositoryPath: "/repo",
      baseRef: "main",
      targetRef: "feature",
      summary: {
        changedFilesCount: 1,
        findingsCount: 1,
        highSeverityCount: 1,
        files: ["src/a.ts"]
      },
      findings: [
        {
          id: "f_1",
          severity: "high",
          category: "bug-risk",
          summary: "空值保护缺失",
          explanation: "调用链可能传入 undefined",
          file: "src/a.ts",
          confidenceSignals: [],
          status: "file-level"
        }
      ]
    }),
    listSessions: async () => [],
    subscribeSession: () => () => {}
  };
}
```

- [ ] **Step 3: 运行前端完整验证**

Run: `pnpm --filter @app/review-app test`
Expected: PASS

Run: `pnpm --filter @app/review-app build`
Expected: PASS

Run: `pnpm --filter @app/review-app test:e2e`
Expected: PASS，至少 1 个场景通过

- [ ] **Step 4: Commit**

```bash
git add packages/review-app/tests/app.e2e.spec.ts packages/review-app/package.json packages/review-app/src/test/setup.ts
git commit -m "test: add renderer e2e coverage"
```

## 自检结果

### 1. Spec 覆盖检查

已覆盖的设计文档要求：

1. 双栏混合布局：Task 3、Task 4、Task 5、Task 6
2. 左侧摘要、风险文件、问题卡片流：Task 5
3. 右侧 diff 详情与定位：Task 6
4. 渐进式展示与 session 状态：Task 4
5. 本地仓库和分支选择入口：Task 3
6. 会话可回看和列表数据模型基础：Task 2、Task 4
7. 隐私边界展示：Task 7

当前未覆盖内容：

1. Electron preload 暴露 `window.reviewWorkbenchApi` 的实现细节
2. 后端真实 session 持久化读取逻辑
3. Monaco 基于真实前后版本文本的完整 diff 显示

这些依赖主进程或后端计划，不属于本前端计划范围。

### 2. Placeholder 扫描

已检查本计划，正文任务中没有保留未细化的空白步骤或模糊指令。

### 3. 类型一致性检查

1. `ReviewSessionDetail` 在 Task 2 定义，在 Task 4、Task 5、Task 6 复用。
2. `selectedFindingId` 与 `setSelectedFinding` 在 Task 4 定义，在 Task 5、Task 6 中保持一致。
3. `window.reviewWorkbenchApi` 的方法名在 Task 2、Task 3、Task 4、Task 8 中保持一致。

## 执行前备注

1. 第一版右侧 Monaco 先优先保证“定位到相关片段”，不强求一开始就做完整 unified diff 合并渲染。
2. 如果实现阶段发现 Monaco Diff Editor 与 Electron 打包集成复杂，可以先保留 Monaco 普通只读编辑器，再在后续迭代切换到真正 diff 模式。
3. renderer 的 mock API 只用于测试环境，生产环境必须由 preload 注入真实实现，不能在运行时悄悄回退。

Plan complete and saved to `docs/superpowers/plans/2026-06-06-review-frontend-workbench.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
