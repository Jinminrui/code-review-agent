# 导航栏和历史记录管理功能实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现全局导航栏和历史审查记录管理功能（查看、删除、导出）

**Architecture:** 
- 复用现有的 `AppShell` 和 `ActivityBar` 组件实现全局导航
- 在 `ReviewSessionPage` 侧边栏顶部添加返回首页按钮
- 扩展 `FileSessionStore` 支持删除和导出功能
- 前端通过 IPC 调用后端新功能

**Tech Stack:** React 19, React Router 7, Zustand 5, Vitest, Testing Library

---

## 文件结构

### 后端（review-backend）

| 文件 | 职责 |
|------|------|
| `src/infrastructure/storage/file-session-store.ts` | 添加 `deleteSession()` 和 `exportSessionToMarkdown()` 方法 |
| `tests/file-session-store.test.ts` | 添加删除和导出功能的测试 |
| `src/contracts/ipc.ts` | 添加新的 IPC 契约（可选，当前已有 listSessions） |

### 前端 Shell（review-shell）

| 文件 | 职责 |
|------|------|
| `src/preload.cts` | 添加 `deleteSession` 和 `exportSession` 方法 |
| `src/ipc/review-workbench-handlers.ts` | 添加删除和导出的 handler |
| `tests/review-workbench-handlers.test.ts` | 添加 handler 测试 |

### 前端 App（review-app）

| 文件 | 职责 |
|------|------|
| `src/app/router.tsx` | 集成 `AppShell` 作为布局组件 |
| `src/lib/ipc-client.ts` | 添加 `deleteSession` 和 `exportSession` 方法 |
| `src/lib/review-model.ts` | 添加 `SessionSummary` 类型（用于历史列表） |
| `src/store/session-history-store.ts` | 创建历史记录状态管理 |
| `src/components/session/sidebar-header.tsx` | 创建侧边栏头部组件（返回按钮） |
| `src/components/session/session-card.tsx` | 创建会话卡片组件 |
| `src/components/session/delete-confirm-dialog.tsx` | 创建删除确认对话框 |
| `src/pages/review-session-page.tsx` | 集成 SidebarHeader |
| `src/pages/session-history-page.tsx` | 实现历史记录页面 |
| `tests/sidebar-header.test.tsx` | 侧边栏头部测试 |
| `tests/session-card.test.tsx` | 会话卡片测试 |
| `tests/session-history-page.test.tsx` | 历史记录页面测试（更新现有） |

---

## Task 1: 后端 - 添加删除会话功能

**Files:**
- Modify: `packages/review-backend/src/infrastructure/storage/file-session-store.ts`
- Test: `packages/review-backend/tests/file-session-store.test.ts`

- [ ] **Step 1: 编写删除会话的失败测试**

```typescript
// packages/review-backend/tests/file-session-store.test.ts
import { mkdtemp, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FileSessionStore } from "../src/infrastructure/storage/file-session-store.js";

describe("FileSessionStore", () => {
  // ... 现有测试 ...

  it("deletes a session and its directory", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "review-store-"));
    const store = new FileSessionStore(rootDir);

    const session = await store.createSession({
      repositoryPath: "/repo",
      baseRef: "main",
      targetRef: "feature"
    });

    // 确认会话存在
    await expect(store.getSession(session.sessionId)).resolves.toBeDefined();

    // 删除会话
    await store.deleteSession(session.sessionId);

    // 确认会话已删除
    await expect(store.getSession(session.sessionId)).rejects.toThrow();
  });

  it("throws error when deleting non-existent session", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "review-store-"));
    const store = new FileSessionStore(rootDir);

    await expect(store.deleteSession("non-existent-id")).rejects.toThrow();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
pnpm --filter @app/review-backend test
```

预期：测试失败，`deleteSession` 方法不存在

- [ ] **Step 3: 实现删除会话方法**

```typescript
// packages/review-backend/src/infrastructure/storage/file-session-store.ts
import { appendFile, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
// ... 其他导入 ...

export class FileSessionStore {
  // ... 现有方法 ...

  async deleteSession(sessionId: string): Promise<void> {
    const sessionDir = join(this.rootDir, sessionId);
    
    // 检查目录是否存在
    try {
      await readFile(join(sessionDir, "session.json"), "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        throw new Error(`Session ${sessionId} not found`);
      }
      throw error;
    }

    // 删除整个会话目录
    await rm(sessionDir, { recursive: true, force: true });
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
pnpm --filter @app/review-backend test
```

预期：所有测试通过

- [ ] **Step 5: 提交代码**

```bash
git add packages/review-backend/src/infrastructure/storage/file-session-store.ts packages/review-backend/tests/file-session-store.test.ts
git commit -m "feat(backend): add deleteSession method to FileSessionStore"
```

---

## Task 2: 后端 - 添加导出 Markdown 功能

**Files:**
- Modify: `packages/review-backend/src/infrastructure/storage/file-session-store.ts`
- Test: `packages/review-backend/tests/file-session-store.test.ts`

- [ ] **Step 1: 编写导出 Markdown 的失败测试**

```typescript
// packages/review-backend/tests/file-session-store.test.ts
describe("FileSessionStore", () => {
  // ... 现有测试 ...

  it("exports session to markdown format", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "review-store-"));
    const store = new FileSessionStore(rootDir);

    const session = await store.createSession({
      repositoryPath: "/repo",
      baseRef: "main",
      targetRef: "feature"
    });

    await store.completeSession(session.sessionId, {
      sessionId: session.sessionId,
      status: "finished",
      summary: {
        changedFilesCount: 2,
        findingsCount: 1,
        highSeverityCount: 1,
        files: ["src/a.ts"]
      },
      findings: [
        {
          id: "f_1",
          severity: "high",
          category: "security",
          summary: "SQL injection vulnerability",
          explanation: "User input is not sanitized",
          file: "src/a.ts",
          startLine: 10,
          endLine: 15,
          status: "line-level",
          confidenceSignals: ["direct-input"]
        }
      ],
      diffByFile: {}
    });

    const markdown = await store.exportSessionToMarkdown(session.sessionId);

    expect(markdown).toContain("# 代码审查报告");
    expect(markdown).toContain("## 基本信息");
    expect(markdown).toContain(`**会话 ID**：${session.sessionId}`);
    expect(markdown).toContain("## 审查摘要");
    expect(markdown).toContain("## 问题列表");
    expect(markdown).toContain("SQL injection vulnerability");
  });

  it("throws error when exporting non-existent session", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "review-store-"));
    const store = new FileSessionStore(rootDir);

    await expect(store.exportSessionToMarkdown("non-existent-id")).rejects.toThrow();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
pnpm --filter @app/review-backend test
```

预期：测试失败，`exportSessionToMarkdown` 方法不存在

- [ ] **Step 3: 实现导出 Markdown 方法**

```typescript
// packages/review-backend/src/infrastructure/storage/file-session-store.ts
export class FileSessionStore {
  // ... 现有方法 ...

  async exportSessionToMarkdown(sessionId: string): Promise<string> {
    const session = await this.getSession(sessionId);

    const lines: string[] = [];
    lines.push("# 代码审查报告");
    lines.push("");
    lines.push("## 基本信息");
    lines.push(`- **会话 ID**：${sessionId}`);
    lines.push(`- **仓库路径**：${session.repositoryPath}`);
    lines.push(`- **分支对比**：${session.baseRef} → ${session.targetRef}`);
    lines.push(`- **状态**：${session.status}`);
    lines.push("");
    lines.push("## 审查摘要");
    lines.push(`- **变更文件**：${session.summary.changedFilesCount} 个`);
    lines.push(`- **发现问题**：${session.summary.findingsCount} 个`);
    lines.push(`- **高风险**：${session.summary.highSeverityCount} 个`);
    lines.push("");
    lines.push("## 问题列表");

    if (session.findings.length === 0) {
      lines.push("");
      lines.push("暂无问题");
    } else {
      for (const finding of session.findings) {
        lines.push("");
        lines.push(`### ${finding.summary}`);
        lines.push("");
        lines.push(`- **文件**：${finding.file}`);
        if (finding.startLine) {
          lines.push(`- **行号**：${finding.startLine}${finding.endLine ? `-${finding.endLine}` : ""}`);
        }
        lines.push(`- **严重程度**：${finding.severity}`);
        lines.push(`- **类别**：${finding.category}`);
        lines.push(`- **说明**：${finding.explanation}`);
        if (finding.suggestion) {
          lines.push(`- **建议**：${finding.suggestion}`);
        }
      }
    }

    return lines.join("\n");
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
pnpm --filter @app/review-backend test
```

预期：所有测试通过

- [ ] **Step 5: 提交代码**

```bash
git add packages/review-backend/src/infrastructure/storage/file-session-store.ts packages/review-backend/tests/file-session-store.test.ts
git commit -m "feat(backend): add exportSessionToMarkdown method to FileSessionStore"
```

---

## Task 3: Shell - 添加删除和导出的 IPC Handler

**Files:**
- Modify: `packages/review-shell/src/preload.cts`
- Modify: `packages/review-shell/src/ipc/review-workbench-handlers.ts`
- Test: `packages/review-shell/tests/review-workbench-handlers.test.ts`

- [ ] **Step 1: 编写 IPC handler 的失败测试**

```typescript
// packages/review-shell/tests/review-workbench-handlers.test.ts
import { describe, expect, it, vi } from "vitest";
import { createReviewWorkbenchHandlers } from "../src/ipc/review-workbench-handlers";

describe("createReviewWorkbenchHandlers", () => {
  // ... 现有测试 ...

  it("delegates deleteSession to backend", async () => {
    const backend = {
      listRepositories: vi.fn(),
      listBranches: vi.fn(),
      createSession: vi.fn(),
      getSession: vi.fn(),
      listSessions: vi.fn(),
      deleteSession: vi.fn().mockResolvedValue(undefined),
      exportSessionToMarkdown: vi.fn()
    };

    const handlers = createReviewWorkbenchHandlers({ backend });

    await handlers.deleteSession("session-123");

    expect(backend.deleteSession).toHaveBeenCalledWith("session-123");
  });

  it("delegates exportSession to backend", async () => {
    const backend = {
      listRepositories: vi.fn(),
      listBranches: vi.fn(),
      createSession: vi.fn(),
      getSession: vi.fn(),
      listSessions: vi.fn(),
      deleteSession: vi.fn(),
      exportSessionToMarkdown: vi.fn().mockResolvedValue("# Report")
    };

    const handlers = createReviewWorkbenchHandlers({ backend });

    const result = await handlers.exportSession("session-123");

    expect(backend.exportSessionToMarkdown).toHaveBeenCalledWith("session-123");
    expect(result).toEqual({
      markdown: "# Report",
      filename: "review-session-123.md"
    });
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
pnpm --filter @app/review-shell test
```

预期：测试失败，`deleteSession` 和 `exportSession` 方法不存在

- [ ] **Step 3: 更新 ReviewWorkbenchBackend 类型和 handlers**

```typescript
// packages/review-shell/src/ipc/review-workbench-handlers.ts
import type { CreateReviewSessionRequest } from "@app/review-backend";
import { createReviewSessionRequestSchema } from "@app/review-backend";

type ReviewWorkbenchBackend = {
  listRepositories(): Promise<string[]>;
  listBranches(repositoryPath: string): Promise<string[]>;
  createSession(request: CreateReviewSessionRequest): Promise<{ sessionId: string }>;
  getSession(sessionId: string): Promise<unknown>;
  listSessions(): Promise<unknown[]>;
  deleteSession(sessionId: string): Promise<void>;
  exportSessionToMarkdown(sessionId: string): Promise<string>;
};

export function createReviewWorkbenchHandlers(input: {
  backend: ReviewWorkbenchBackend;
}) {
  return {
    listRepositories: () => input.backend.listRepositories(),
    listBranches: (repositoryPath: string) => input.backend.listBranches(repositoryPath),
    createSession: (request: unknown) =>
      input.backend.createSession(createReviewSessionRequestSchema.parse(request)),
    getSession: (sessionId: string) => input.backend.getSession(sessionId),
    listSessions: () => input.backend.listSessions(),
    deleteSession: (sessionId: string) => input.backend.deleteSession(sessionId),
    exportSession: async (sessionId: string) => {
      const markdown = await input.backend.exportSessionToMarkdown(sessionId);
      return {
        markdown,
        filename: `review-${sessionId}.md`
      };
    }
  };
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
pnpm --filter @app/review-shell test
```

预期：所有测试通过

- [ ] **Step 5: 更新 preload.cts**

```typescript
// packages/review-shell/src/preload.cts
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("reviewWorkbenchApi", {
  listRepositories: () => ipcRenderer.invoke("review:listRepositories"),
  listBranches: (repositoryPath: string) =>
    ipcRenderer.invoke("review:listBranches", repositoryPath),
  createSession: (input: unknown) => ipcRenderer.invoke("review:createSession", input),
  getSession: (sessionId: string) => ipcRenderer.invoke("review:getSession", sessionId),
  listSessions: () => ipcRenderer.invoke("review:listSessions"),
  deleteSession: (sessionId: string) => ipcRenderer.invoke("review:deleteSession", sessionId),
  exportSession: (sessionId: string) => ipcRenderer.invoke("review:exportSession", sessionId),
  subscribeSession: (sessionId: string, onEvent: (event: unknown) => void) => {
    const channel = `review:session:${sessionId}`;
    const listener = (_event: unknown, payload: unknown) => onEvent(payload);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  }
});
```

- [ ] **Step 6: 提交代码**

```bash
git add packages/review-shell/src/preload.cts packages/review-shell/src/ipc/review-workbench-handlers.ts packages/review-shell/tests/review-workbench-handlers.test.ts
git commit -m "feat(shell): add deleteSession and exportSession IPC handlers"
```

---

## Task 4: 前端 - 更新 IPC Client 和类型定义

**Files:**
- Modify: `packages/review-app/src/lib/ipc-client.ts`
- Modify: `packages/review-app/src/lib/review-model.ts`

- [ ] **Step 1: 添加 SessionSummary 类型**

```typescript
// packages/review-app/src/lib/review-model.ts
import { z } from "zod";

// ... 现有 schema ...

export const sessionSummarySchema = z.object({
  sessionId: z.string(),
  repositoryPath: z.string(),
  baseRef: z.string(),
  targetRef: z.string(),
  status: z.enum(["running", "finished", "failed"]),
  summary: z.object({
    changedFilesCount: z.number(),
    findingsCount: z.number(),
    highSeverityCount: z.number(),
    files: z.array(z.string())
  })
});

export type SessionSummary = z.infer<typeof sessionSummarySchema>;

// ... 现有类型 ...
```

- [ ] **Step 2: 更新 IPC Client 类型和方法**

```typescript
// packages/review-app/src/lib/ipc-client.ts
import type { ReviewSessionDetail, SessionSummary } from "./review-model";

export type CreateSessionInput = {
  repositoryPath: string;
  baseRef: string;
  targetRef: string;
};

export type ReviewWorkbenchApi = {
  listRepositories(): Promise<string[]>;
  listBranches(repositoryPath: string): Promise<string[]>;
  createSession(input: CreateSessionInput): Promise<{ sessionId: string }>;
  getSession(sessionId: string): Promise<ReviewSessionDetail>;
  listSessions(): Promise<SessionSummary[]>;
  deleteSession(sessionId: string): Promise<void>;
  exportSession(sessionId: string): Promise<{ markdown: string; filename: string }>;
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
  deleteSession: (sessionId: string) => window.reviewWorkbenchApi.deleteSession(sessionId),
  exportSession: (sessionId: string) => window.reviewWorkbenchApi.exportSession(sessionId),
  subscribeSession: (sessionId: string, onEvent: (event: unknown) => void) =>
    window.reviewWorkbenchApi.subscribeSession(sessionId, onEvent)
};
```

- [ ] **Step 3: 提交代码**

```bash
git add packages/review-app/src/lib/ipc-client.ts packages/review-app/src/lib/review-model.ts
git commit -m "feat(app): add deleteSession and exportSession to IPC client"
```

---

## Task 5: 前端 - 集成 AppShell 到路由

**Files:**
- Modify: `packages/review-app/src/app/router.tsx`

- [ ] **Step 1: 更新路由使用 AppShell**

```typescript
// packages/review-app/src/app/router.tsx
import { createHashRouter, RouterProvider } from "react-router-dom";
import { AppShell } from "@/components/layout/app-shell";
import { ReviewLaunchPage } from "@/pages/review-launch-page";
import { ReviewSessionPage } from "@/pages/review-session-page";
import { SessionHistoryPage } from "@/pages/session-history-page";

const router = createHashRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <ReviewLaunchPage /> },
      { path: "sessions", element: <SessionHistoryPage /> },
      { path: "sessions/:sessionId", element: <ReviewSessionPage /> }
    ]
  }
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
```

- [ ] **Step 2: 运行前端开发服务器测试**

```bash
pnpm dev:web
```

预期：应用正常启动，ActivityBar 显示在左侧，导航正常工作

- [ ] **Step 3: 提交代码**

```bash
git add packages/review-app/src/app/router.tsx
git commit -m "feat(app): integrate AppShell into router for global navigation"
```

---

## Task 6: 前端 - 创建 SidebarHeader 组件

**Files:**
- Create: `packages/review-app/src/components/session/sidebar-header.tsx`
- Test: `packages/review-app/tests/sidebar-header.test.tsx`

- [ ] **Step 1: 编写 SidebarHeader 的失败测试**

```typescript
// packages/review-app/tests/sidebar-header.test.tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { SidebarHeader } from "../src/components/session/sidebar-header";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate
  };
});

describe("SidebarHeader", () => {
  it("renders back button and navigates to home on click", () => {
    render(
      <MemoryRouter>
        <SidebarHeader status="finished" />
      </MemoryRouter>
    );

    const backButton = screen.getByRole("button", { name: /返回首页/i });
    expect(backButton).toBeInTheDocument();

    fireEvent.click(backButton);

    expect(mockNavigate).toHaveBeenCalledWith("/");
  });

  it("displays session status", () => {
    render(
      <MemoryRouter>
        <SidebarHeader status="running" />
      </MemoryRouter>
    );

    expect(screen.getByText("审查中...")).toBeInTheDocument();
  });

  it("does not display status when idle", () => {
    render(
      <MemoryRouter>
        <SidebarHeader status="idle" />
      </MemoryRouter>
    );

    expect(screen.queryByText("审查中...")).not.toBeInTheDocument();
    expect(screen.queryByText("已完成")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
pnpm --filter @app/review-app test
```

预期：测试失败，`SidebarHeader` 组件不存在

- [ ] **Step 3: 实现 SidebarHeader 组件**

```typescript
// packages/review-app/src/components/session/sidebar-header.tsx
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";

interface SidebarHeaderProps {
  status: "idle" | "running" | "partial" | "finished" | "failed";
}

const statusConfig = {
  idle: null,
  running: { label: "审查中...", status: "running" as const },
  partial: { label: "部分完成", status: "running" as const },
  finished: { label: "已完成", status: "finished" as const },
  failed: { label: "失败", status: "failed" as const }
};

export function SidebarHeader({ status }: SidebarHeaderProps) {
  const navigate = useNavigate();
  const config = statusConfig[status];

  return (
    <div className="flex items-center justify-between p-3 border-b border-border-default">
      <button
        onClick={() => navigate("/")}
        className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors"
      >
        <ArrowLeft size={16} />
        <span className="text-sm">返回首页</span>
      </button>
      {config && (
        <StatusBadge status={config.status} label={config.label} />
      )}
    </div>
  );
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
pnpm --filter @app/review-app test
```

预期：所有测试通过

- [ ] **Step 5: 提交代码**

```bash
git add packages/review-app/src/components/session/sidebar-header.tsx packages/review-app/tests/sidebar-header.test.tsx
git commit -m "feat(app): add SidebarHeader component with back button"
```

---

## Task 7: 前端 - 集成 SidebarHeader 到 ReviewSessionPage

**Files:**
- Modify: `packages/review-app/src/pages/review-session-page.tsx`
- Test: `packages/review-app/tests/review-session-page.test.tsx`

- [ ] **Step 1: 更新 ReviewSessionPage 集成 SidebarHeader**

```typescript
// packages/review-app/src/pages/review-session-page.tsx
import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useReviewSessionStore } from '@/store/review-session-store'
import { useReviewSessionStream } from '@/hooks/use-review-session-stream'
import { useSelectedFinding } from '@/hooks/use-selected-finding'
import { SidebarHeader } from '@/components/session/sidebar-header'
import { SessionProgress } from '@/components/session/session-progress'
import { ReviewSummaryPanel } from '@/components/session/review-summary-panel'
import { RiskFileList } from '@/components/session/risk-file-list'
import { FindingList } from '@/components/session/finding-list'
import { MonacoDiffViewer } from '@/components/diff/monaco-diff-viewer'
import { DiffEmptyState } from '@/components/session/diff-empty-state'

export function ReviewSessionPage() {
  const { sessionId = '' } = useParams()
  useReviewSessionStream(sessionId)

  const session = useReviewSessionStore((state) => state.session)
  const selectedFindingId = useReviewSessionStore((state) => state.selectedFindingId)
  const setSelectedFinding = useReviewSessionStore((state) => state.setSelectedFinding)
  const selectedFinding = useSelectedFinding()
  const selectedDiff = selectedFinding ? session?.diffByFile[selectedFinding.file] : null

  useEffect(() => {
    if (!session) {
      return
    }

    if (session.findings.length === 0) {
      setSelectedFinding(null)
      return
    }

    if (!selectedFindingId) {
      setSelectedFinding(session.findings[0]?.id ?? null)
    }
  }, [selectedFindingId, session, setSelectedFinding])

  return (
    <div className="h-screen flex overflow-hidden">
      {/* 侧边栏 */}
      <aside className="w-80 h-full bg-bg-surface border-r border-border-default flex flex-col overflow-hidden">
        {/* 侧边栏头部 - 返回按钮和状态 */}
        <SidebarHeader status={session?.status ?? 'idle'} />

        {/* 会话进度 */}
        <SessionProgress
          status={session?.status ?? 'idle'}
        />

        {/* 审查摘要 */}
        {session ? (
          <>
            <ReviewSummaryPanel
              changedFiles={session.summary.changedFilesCount}
              findings={session.summary.findingsCount}
              highRisk={session.summary.highSeverityCount}
            />

            {/* 风险文件列表 */}
            <RiskFileList files={session.summary.files} />

            {/* Finding 列表 */}
            <FindingList
              findings={session.findings}
              selectedFindingId={selectedFindingId}
              onSelectFinding={setSelectedFinding}
            />
          </>
        ) : null}
      </aside>

      {/* 主内容区 */}
      <main className="flex-1 min-w-0 overflow-hidden">
        {selectedFinding ? (
          <MonacoDiffViewer
            original={selectedDiff?.original ?? ''}
            modified={selectedDiff?.modified ?? ''}
            finding={selectedFinding}
          />
        ) : (
          <DiffEmptyState />
        )}
      </main>
    </div>
  )
}
```

- [ ] **Step 2: 运行测试确认通过**

```bash
pnpm --filter @app/review-app test
```

预期：所有测试通过

- [ ] **Step 3: 提交代码**

```bash
git add packages/review-app/src/pages/review-session-page.tsx
git commit -m "feat(app): integrate SidebarHeader into ReviewSessionPage"
```

---

## Task 8: 前端 - 创建 SessionHistoryStore

**Files:**
- Create: `packages/review-app/src/store/session-history-store.ts`

- [ ] **Step 1: 创建 SessionHistoryStore**

```typescript
// packages/review-app/src/store/session-history-store.ts
import { create } from 'zustand';
import type { SessionSummary } from '@/lib/review-model';
import { ipcClient } from '@/lib/ipc-client';

type SessionHistoryStore = {
  sessions: SessionSummary[];
  isLoading: boolean;
  error: string | null;

  fetchSessions(): Promise<void>;
  deleteSession(sessionId: string): Promise<void>;
  exportSession(sessionId: string): Promise<void>;
  clearError(): void;
};

export const useSessionHistoryStore = create<SessionHistoryStore>((set, get) => ({
  sessions: [],
  isLoading: false,
  error: null,

  fetchSessions: async () => {
    set({ isLoading: true, error: null });
    try {
      const sessions = await ipcClient.listSessions();
      set({ sessions, isLoading: false });
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
      set({ error: '加载历史记录失败', isLoading: false });
    }
  },

  deleteSession: async (sessionId: string) => {
    try {
      await ipcClient.deleteSession(sessionId);
      const sessions = get().sessions.filter(s => s.sessionId !== sessionId);
      set({ sessions });
    } catch (error) {
      console.error('Failed to delete session:', error);
      set({ error: '删除会话失败' });
    }
  },

  exportSession: async (sessionId: string) => {
    try {
      const { markdown, filename } = await ipcClient.exportSession(sessionId);
      const blob = new Blob([markdown], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export session:', error);
      set({ error: '导出会话报告失败' });
    }
  },

  clearError: () => set({ error: null })
}));
```

- [ ] **Step 2: 提交代码**

```bash
git add packages/review-app/src/store/session-history-store.ts
git commit -m "feat(app): add SessionHistoryStore for history management"
```

---

## Task 9: 前端 - 创建 SessionCard 组件

**Files:**
- Create: `packages/review-app/src/components/session/session-card.tsx`
- Test: `packages/review-app/tests/session-card.test.tsx`

- [ ] **Step 1: 编写 SessionCard 的失败测试**

```typescript
// packages/review-app/tests/session-card.test.tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { SessionCard } from "../src/components/session/session-card";

describe("SessionCard", () => {
  const mockSession = {
    sessionId: "s_1",
    repositoryPath: "/Users/test/repo",
    baseRef: "main",
    targetRef: "feature",
    status: "finished" as const,
    summary: {
      changedFilesCount: 3,
      findingsCount: 2,
      highSeverityCount: 1,
      files: ["src/a.ts"]
    }
  };

  it("renders session information", () => {
    render(
      <MemoryRouter>
        <SessionCard session={mockSession} onDelete={vi.fn()} onExport={vi.fn()} />
      </MemoryRouter>
    );

    expect(screen.getByText("main → feature")).toBeInTheDocument();
    expect(screen.getByText("/Users/test/repo")).toBeInTheDocument();
    expect(screen.getByText("3 files")).toBeInTheDocument();
    expect(screen.getByText("2 findings")).toBeInTheDocument();
    expect(screen.getByText("1 high")).toBeInTheDocument();
  });

  it("calls onDelete when delete button is clicked", () => {
    const onDelete = vi.fn();

    render(
      <MemoryRouter>
        <SessionCard session={mockSession} onDelete={onDelete} onExport={vi.fn()} />
      </MemoryRouter>
    );

    const deleteButton = screen.getByRole("button", { name: /删除/i });
    fireEvent.click(deleteButton);

    expect(onDelete).toHaveBeenCalledWith("s_1");
  });

  it("calls onExport when export button is clicked", () => {
    const onExport = vi.fn();

    render(
      <MemoryRouter>
        <SessionCard session={mockSession} onDelete={vi.fn()} onExport={onExport} />
      </MemoryRouter>
    );

    const exportButton = screen.getByRole("button", { name: /导出/i });
    fireEvent.click(exportButton);

    expect(onExport).toHaveBeenCalledWith("s_1");
  });

  it("links to session detail page", () => {
    render(
      <MemoryRouter>
        <SessionCard session={mockSession} onDelete={vi.fn()} onExport={vi.fn()} />
      </MemoryRouter>
    );

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/sessions/s_1");
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
pnpm --filter @app/review-app test
```

预期：测试失败，`SessionCard` 组件不存在

- [ ] **Step 3: 实现 SessionCard 组件**

```typescript
// packages/review-app/src/components/session/session-card.tsx
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { Icon } from '@/components/ui/icon'
import { StatusBadge } from '@/components/ui/status-badge'
import { GitBranch, Folder, FileText, AlertTriangle, Trash2, Download } from 'lucide-react'
import type { SessionSummary } from '@/lib/review-model'

interface SessionCardProps {
  session: SessionSummary;
  onDelete: (sessionId: string) => void;
  onExport: (sessionId: string) => void;
}

export function SessionCard({ session, onDelete, onExport }: SessionCardProps) {
  return (
    <div
      className={cn(
        'block p-4 rounded-lg border border-border-default bg-bg-surface',
        'hover:bg-bg-elevated hover:border-border-accent hover:shadow-glow-cyan',
        'transition-all duration-150'
      )}
    >
      {/* 分支信息 */}
      <div className="flex items-center gap-2 mb-2">
        <Icon icon={GitBranch} size="sm" variant="accent" />
        <Link
          to={`/sessions/${session.sessionId}`}
          className="font-mono text-sm text-text-primary hover:text-accent-cyan transition-colors"
        >
          {session.baseRef} → {session.targetRef}
        </Link>
      </div>

      {/* 仓库路径 */}
      <div className="flex items-center gap-2 mb-2">
        <Icon icon={Folder} size="sm" variant="muted" />
        <span className="font-mono text-xs text-text-tertiary">
          {session.repositoryPath}
        </span>
      </div>

      {/* 状态 */}
      <div className="flex items-center justify-between mb-3">
        <StatusBadge
          status={session.status === 'running' ? 'running' : session.status === 'finished' ? 'finished' : 'failed'}
          label={session.status.toUpperCase()}
        />
      </div>

      {/* 分隔线 */}
      <div className="h-px bg-border-muted mb-3" />

      {/* 统计信息 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <Icon icon={FileText} size="xs" variant="muted" />
            <span className="text-text-secondary">{session.summary.changedFilesCount} files</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Icon icon={AlertTriangle} size="xs" variant="warning" />
            <span className="text-text-secondary">{session.summary.findingsCount} findings</span>
          </div>
          {session.summary.highSeverityCount > 0 && (
            <div className="flex items-center gap-1.5">
              <Icon icon={AlertTriangle} size="xs" variant="danger" />
              <span className="text-accent-red">{session.summary.highSeverityCount} high</span>
            </div>
          )}
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.preventDefault();
              onExport(session.sessionId);
            }}
            className="p-1.5 text-text-tertiary hover:text-text-secondary hover:bg-bg-elevated rounded transition-colors"
            title="导出"
          >
            <Download size={14} />
          </button>
          <button
            onClick={(e) => {
              e.preventDefault();
              onDelete(session.sessionId);
            }}
            className="p-1.5 text-text-tertiary hover:text-accent-red hover:bg-bg-elevated rounded transition-colors"
            title="删除"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
pnpm --filter @app/review-app test
```

预期：所有测试通过

- [ ] **Step 5: 提交代码**

```bash
git add packages/review-app/src/components/session/session-card.tsx packages/review-app/tests/session-card.test.tsx
git commit -m "feat(app): add SessionCard component for history list"
```

---

## Task 10: 前端 - 创建 DeleteConfirmDialog 组件

**Files:**
- Create: `packages/review-app/src/components/session/delete-confirm-dialog.tsx`

- [ ] **Step 1: 实现 DeleteConfirmDialog 组件**

```typescript
// packages/review-app/src/components/session/delete-confirm-dialog.tsx
import { cn } from '@/lib/utils'

interface DeleteConfirmDialogProps {
  isOpen: boolean;
  sessionId: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteConfirmDialog({ isOpen, sessionId, onConfirm, onCancel }: DeleteConfirmDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 背景遮罩 */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* 对话框 */}
      <div
        className={cn(
          'relative z-10 w-full max-w-md p-6 rounded-lg',
          'bg-bg-surface border border-border-default shadow-xl'
        )}
      >
        <h3 className="text-lg font-semibold text-text-primary mb-2">
          确认删除
        </h3>
        <p className="text-text-secondary mb-1">
          确定要删除这条审查记录吗？
        </p>
        <p className="text-sm text-text-tertiary mb-6">
          会话 ID: {sessionId}
        </p>
        <p className="text-sm text-accent-red mb-6">
          此操作不可撤销。
        </p>

        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium',
              'bg-bg-elevated text-text-secondary',
              'hover:bg-bg-surface hover:text-text-primary',
              'transition-colors'
            )}
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium',
              'bg-accent-red text-white',
              'hover:bg-accent-red/90',
              'transition-colors'
            )}
          >
            删除
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 提交代码**

```bash
git add packages/review-app/src/components/session/delete-confirm-dialog.tsx
git commit -m "feat(app): add DeleteConfirmDialog component"
```

---

## Task 11: 前端 - 实现 SessionHistoryPage

**Files:**
- Modify: `packages/review-app/src/pages/session-history-page.tsx`
- Test: `packages/review-app/tests/session-history-page.test.tsx`

- [ ] **Step 1: 更新 SessionHistoryPage 测试**

```typescript
// packages/review-app/tests/session-history-page.test.tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { SessionHistoryPage } from "../src/pages/session-history-page";

const mockDeleteSession = vi.fn();
const mockExportSession = vi.fn();
const mockFetchSessions = vi.fn();

vi.mock("@/store/session-history-store", () => ({
  useSessionHistoryStore: () => ({
    sessions: [
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
        }
      }
    ],
    isLoading: false,
    error: null,
    fetchSessions: mockFetchSessions,
    deleteSession: mockDeleteSession,
    exportSession: mockExportSession,
    clearError: vi.fn()
  })
}));

describe("SessionHistoryPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders session cards", async () => {
    render(
      <MemoryRouter initialEntries={["/sessions"]}>
        <Routes>
          <Route path="/sessions" element={<SessionHistoryPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("审查历史")).toBeInTheDocument();
    expect(screen.getByText("main → feature")).toBeInTheDocument();
    expect(screen.getByText("3 files")).toBeInTheDocument();
    expect(screen.getByText("2 findings")).toBeInTheDocument();
  });

  it("calls deleteSession when delete is confirmed", async () => {
    render(
      <MemoryRouter initialEntries={["/sessions"]}>
        <Routes>
          <Route path="/sessions" element={<SessionHistoryPage />} />
        </Routes>
      </MemoryRouter>
    );

    const deleteButton = screen.getByRole("button", { name: /删除/i });
    fireEvent.click(deleteButton);

    // 确认对话框出现
    expect(screen.getByText("确认删除")).toBeInTheDocument();

    // 点击确认删除
    const confirmButton = screen.getByRole("button", { name: "删除" });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(mockDeleteSession).toHaveBeenCalledWith("s_1");
    });
  });

  it("calls exportSession when export is clicked", async () => {
    render(
      <MemoryRouter initialEntries={["/sessions"]}>
        <Routes>
          <Route path="/sessions" element={<SessionHistoryPage />} />
        </Routes>
      </MemoryRouter>
    );

    const exportButton = screen.getByRole("button", { name: /导出/i });
    fireEvent.click(exportButton);

    await waitFor(() => {
      expect(mockExportSession).toHaveBeenCalledWith("s_1");
    });
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
pnpm --filter @app/review-app test
```

预期：测试失败，需要更新 SessionHistoryPage

- [ ] **Step 3: 实现 SessionHistoryPage**

```typescript
// packages/review-app/src/pages/session-history-page.tsx
import { useEffect, useState } from 'react'
import { useSessionHistoryStore } from '@/store/session-history-store'
import { SessionCard } from '@/components/session/session-card'
import { DeleteConfirmDialog } from '@/components/session/delete-confirm-dialog'
import { Icon } from '@/components/ui/icon'
import { Clock } from 'lucide-react'

export function SessionHistoryPage() {
  const {
    sessions,
    isLoading,
    error,
    fetchSessions,
    deleteSession,
    exportSession,
    clearError
  } = useSessionHistoryStore();

  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleDelete = (sessionId: string) => {
    setDeleteTarget(sessionId);
  };

  const handleConfirmDelete = async () => {
    if (deleteTarget) {
      await deleteSession(deleteTarget);
      setDeleteTarget(null);
    }
  };

  const handleExport = (sessionId: string) => {
    exportSession(sessionId);
  };

  return (
    <div className="min-h-screen bg-bg-base p-8">
      <div className="max-w-3xl mx-auto">
        {/* 标题 */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-text-primary mb-2">审查历史</h1>
          <p className="text-text-secondary">
            共 {sessions.length} 条记录
          </p>
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="mb-4 p-4 bg-accent-red/10 border border-accent-red/20 rounded-lg">
            <p className="text-accent-red text-sm">{error}</p>
            <button
              onClick={clearError}
              className="text-xs text-accent-red/70 hover:text-accent-red mt-1"
            >
              关闭
            </button>
          </div>
        )}

        {/* 加载状态 */}
        {isLoading && (
          <div className="text-center py-12">
            <p className="text-text-tertiary">加载中...</p>
          </div>
        )}

        {/* 会话列表 */}
        {!isLoading && sessions.length === 0 ? (
          <div className="empty-state-terminal">
            <div className="text-center">
              <Icon icon={Clock} size="xl" variant="muted" className="mx-auto mb-4" />
              <p className="text-text-tertiary">暂无审查记录</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((session) => (
              <SessionCard
                key={session.sessionId}
                session={session}
                onDelete={handleDelete}
                onExport={handleExport}
              />
            ))}
          </div>
        )}
      </div>

      {/* 删除确认对话框 */}
      <DeleteConfirmDialog
        isOpen={deleteTarget !== null}
        sessionId={deleteTarget ?? ''}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
pnpm --filter @app/review-app test
```

预期：所有测试通过

- [ ] **Step 5: 提交代码**

```bash
git add packages/review-app/src/pages/session-history-page.tsx packages/review-app/tests/session-history-page.test.tsx
git commit -m "feat(app): implement SessionHistoryPage with delete and export"
```

---

## Task 12: 集成测试和最终验证

**Files:**
- Test: `packages/review-app/tests/app.e2e.spec.ts`

- [ ] **Step 1: 运行所有单元测试**

```bash
pnpm test
```

预期：所有测试通过

- [ ] **Step 2: 运行 TypeScript 类型检查**

```bash
pnpm typecheck
```

预期：无类型错误

- [ ] **Step 3: 启动开发服务器手动测试**

```bash
pnpm dev:web
```

手动验证：
1. 左侧 ActivityBar 显示导航图标
2. 点击"历史记录"图标进入历史页面
3. 历史页面显示会话列表
4. 可以删除会话（弹出确认对话框）
5. 可以导出会话（下载 Markdown 文件）
6. 进入审查详情页，侧边栏顶部显示"返回首页"按钮
7. 点击"返回首页"按钮跳转到首页

- [ ] **Step 4: 构建项目确认无错误**

```bash
pnpm build
```

预期：构建成功

- [ ] **Step 5: 提交最终代码**

```bash
git add -A
git commit -m "feat: complete navigation and history management features"
```

---

## 总结

本计划实现了以下功能：
1. ✅ 全局导航栏（复用现有 ActivityBar）
2. ✅ 侧边栏返回首页按钮（SidebarHeader 组件）
3. ✅ 历史记录查看（SessionCard 组件）
4. ✅ 历史记录删除（DeleteConfirmDialog 组件）
5. ✅ 历史记录导出（Markdown 格式）

预计完成时间：5-7 天
