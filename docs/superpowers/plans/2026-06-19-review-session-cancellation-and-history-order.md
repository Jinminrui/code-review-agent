# 审查历史排序与中止审查 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现会话历史按创建时间倒序展示，并支持用户中止运行中的审查会话，保留中止前已提交结果。

**Architecture:** 后端把 `cancelled` 建模为用户可见终态，`AbortSignal` 只作为执行机制。Electron shell 维护运行中会话的 `AbortController`，renderer 通过 IPC 发起中止请求并等待 `session-cancelled` 事件收敛。历史排序由后端 `FileSessionStore.listSessions` 统一保证，前端只消费结构化结果。

**Tech Stack:** Electron, TypeScript, React, Zustand, Vitest, Testing Library, zod, pnpm workspace.

---

## 执行状态

更新时间：2026-06-20

- [x] Task 1：后端领域模型支持 `createdAt`、`cancelled` 和 `session-cancelled`
  - 实现完成。
  - 规格符合性审查通过。
  - 代码质量审查通过。
- [x] Task 2：`FileSessionStore` 写入创建时间并按创建时间倒序
  - 实现完成。
  - 规格符合性审查通过。
  - 代码质量审查通过。
- [x] Task 3：`streamReviewSession` 支持取消并持久化 `cancelled`
  - 实现完成。
  - 规格符合性复审通过。
  - 代码质量复审通过。
  - 已修正终态事件语义：`session-finished` 写入后不再追加 `session-cancelled`。
- [ ] Task 4：Shell IPC 支持中止运行中的审查
  - 实现完成。
  - 规格符合性复审通过。
  - 待代码质量审查通过后标记完成。
- [ ] Task 5：Renderer 模型、IPC 和流式 hook 支持中止
- [ ] Task 6：审查页头部显示中止审查并隐藏返回首页
- [ ] Task 7：历史排序与 `cancelled` 展示的端到端验证
- [ ] 最终全量验证与收尾

---

## File Structure

- Modify: `packages/review-backend/src/domain/review-session.ts`
  - 增加 `createdAt`、`cancelled` 状态、`session-cancelled` 事件。
- Modify: `packages/review-backend/src/infrastructure/storage/file-session-store.ts`
  - 创建会话时写入 `createdAt`，读取旧会话时兼容缺失字段，列表按 `createdAt` 倒序。
- Modify: `packages/review-backend/src/application/stream-review-session.ts`
  - 接收 `signal?: AbortSignal`，在检查点收敛为 `session-cancelled`，并在取消后停止追加新 findings。
- Modify: `packages/review-backend/src/application/start-review-session.ts`
  - 透传新的 `signal` 参数。
- Modify: `packages/review-shell/src/ipc/review-workbench-handlers.ts`
  - 扩展 backend 接口和 handler，暴露 `cancelSession`。
- Modify: `packages/review-shell/src/main.ts`
  - 维护运行中 controller map，注册 `review:cancelSession`。
- Modify: `packages/review-shell/src/preload.cts`
  - 暴露 `cancelSession`。
- Modify: `packages/review-app/src/lib/review-model.ts`
  - 扩展 renderer 模型和事件类型。
- Modify: `packages/review-app/src/lib/ipc-client.ts`
  - 增加 `cancelSession` 客户端方法。
- Modify: `packages/review-app/src/lib/review-copy.ts`
  - 增加 `cancelled` 文案“已中止”。
- Modify: `packages/review-app/src/components/ui/status-badge.tsx`
  - 增加 `cancelled` 状态样式。
- Modify: `packages/review-app/src/components/session/session-card.tsx`
  - 支持 `cancelled` badge。
- Modify: `packages/review-app/src/components/session/sidebar-header.tsx`
  - 运行中显示“中止审查”，完成/中止后显示“返回首页”。
- Modify: `packages/review-app/src/pages/review-session-page.tsx`
  - 管理中止确认、调用 IPC、展示中止错误。
- Modify: `packages/review-app/src/hooks/use-review-session-stream.ts`
  - 处理 `session-cancelled` 事件。
- Tests:
  - `packages/review-backend/tests/review-session-types.test.ts`
  - `packages/review-backend/tests/file-session-store.test.ts`
  - `packages/review-backend/tests/stream-review-session.cancel.test.ts`
  - `packages/review-shell/tests/review-workbench-handlers.test.ts`
  - `packages/review-app/tests/review-model.test.ts`
  - `packages/review-app/tests/use-review-session-stream.test.tsx`
  - `packages/review-app/tests/sidebar-header.test.tsx`
  - `packages/review-app/tests/session-card.test.tsx`

---

### Task 1: 后端领域模型支持 `createdAt`、`cancelled` 和 `session-cancelled`

**Files:**
- Modify: `packages/review-backend/src/domain/review-session.ts`
- Test: `packages/review-backend/tests/review-session-types.test.ts`

- [ ] **Step 1: 写失败测试**

在 `packages/review-backend/tests/review-session-types.test.ts` 增加：

```ts
import { describe, expect, it } from "vitest";
import { reviewSessionDetailSchema, reviewSessionEventSchema } from "../src/domain/review-session.js";

describe("review session schemas cancellation", () => {
  it("accepts cancelled session details with createdAt", () => {
    const parsed = reviewSessionDetailSchema.parse({
      sessionId: "s_1",
      status: "cancelled",
      createdAt: "2026-06-19T00:00:00.000Z",
      repositoryPath: "/repo",
      baseRef: "main",
      targetRef: "feature",
      summary: {
        changedFilesCount: 2,
        findingsCount: 0,
        highSeverityCount: 0,
        files: ["src/a.ts", "src/b.ts"]
      },
      findings: [],
      diffByFile: {}
    });

    expect(parsed.status).toBe("cancelled");
    expect(parsed.createdAt).toBe("2026-06-19T00:00:00.000Z");
  });

  it("accepts session-cancelled events", () => {
    const parsed = reviewSessionEventSchema.parse({
      type: "session-cancelled",
      sessionId: "s_1",
      totalFindings: 3
    });

    expect(parsed.type).toBe("session-cancelled");
    expect(parsed.totalFindings).toBe(3);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm --filter @app/review-backend test -- tests/review-session-types.test.ts`

Expected: FAIL，错误包含 `Invalid enum value` 或 discriminated union 不接受 `session-cancelled`。

- [ ] **Step 3: 实现 schema**

在 `packages/review-backend/src/domain/review-session.ts` 中：

```ts
export const reviewSessionEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("session-started"),
    sessionId: z.string()
  }),
  z.object({
    type: z.literal("unit-completed"),
    sessionId: z.string(),
    unitId: z.string(),
    findingsCount: z.number().int().nonnegative(),
    findings: z.array(reviewFindingSchema)
  }),
  z.object({
    type: z.literal("unit-failed"),
    sessionId: z.string(),
    unitId: z.string(),
    reason: z.string()
  }),
  z.object({
    type: z.literal("session-finished"),
    sessionId: z.string(),
    totalFindings: z.number().int().nonnegative(),
    status: z.enum(["finished", "partial"])
  }),
  z.object({
    type: z.literal("session-cancelled"),
    sessionId: z.string(),
    totalFindings: z.number().int().nonnegative()
  })
]);

export const reviewSessionDetailSchema = z.object({
  sessionId: z.string(),
  status: z.enum(["idle", "running", "partial", "finished", "failed", "cancelled"]),
  createdAt: z.string().optional(),
  repositoryPath: z.string(),
  baseRef: z.string(),
  targetRef: z.string(),
  summary: z.object({
    changedFilesCount: z.number(),
    findingsCount: z.number(),
    highSeverityCount: z.number(),
    files: z.array(z.string())
  }),
  findings: z.array(reviewFindingSchema),
  diffByFile: z.record(
    z.object({
      original: z.string(),
      modified: z.string()
    })
  )
});
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm --filter @app/review-backend test -- tests/review-session-types.test.ts`

Expected: PASS。

---

### Task 2: FileSessionStore 写入创建时间并按创建时间倒序

**Files:**
- Modify: `packages/review-backend/src/infrastructure/storage/file-session-store.ts`
- Test: `packages/review-backend/tests/file-session-store.test.ts`

- [ ] **Step 1: 写失败测试**

在 `packages/review-backend/tests/file-session-store.test.ts` 增加：

```ts
it("stores createdAt and lists newest sessions first", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "review-store-"));
  const store = new FileSessionStore(rootDir);

  const first = await store.createSession({
    repositoryPath: "/repo",
    baseRef: "main",
    targetRef: "feature-a"
  });
  await new Promise((resolve) => setTimeout(resolve, 5));
  const second = await store.createSession({
    repositoryPath: "/repo",
    baseRef: "main",
    targetRef: "feature-b"
  });

  const firstDetail = await store.getSession(first.sessionId);
  const sessions = await store.listSessions();

  expect(firstDetail.createdAt).toEqual(expect.any(String));
  expect(sessions.map((session) => session.sessionId)).toEqual([
    second.sessionId,
    first.sessionId
  ]);
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm --filter @app/review-backend test -- tests/file-session-store.test.ts`

Expected: FAIL，`createdAt` 为 `undefined` 或排序不稳定。

- [ ] **Step 3: 实现 createdAt 与排序**

修改 `createSession` 写入 `createdAt`：

```ts
const createdAt = new Date().toISOString();
await writeFile(
  join(sessionDir, "session.json"),
  JSON.stringify({ sessionId, ...input, status: "running", createdAt }, null, 2)
);
```

修改 `getSession` 的 session 类型包含 `createdAt?: string`：

```ts
const session = JSON.parse(sessionJson) as {
  sessionId: string;
  status: string;
  createdAt?: string;
  repositoryPath: string;
  baseRef: string;
  targetRef: string;
};
```

修改 `listSessions`：

```ts
async listSessions() {
  const names = await readdir(this.rootDir);
  const sessions = await Promise.all(names.map((name) => this.getSession(name).catch(() => null)));
  return sessions
    .filter((session): session is NonNullable<typeof session> => session !== null)
    .sort((a, b) => {
      if (a.createdAt && b.createdAt) {
        return b.createdAt.localeCompare(a.createdAt);
      }
      if (a.createdAt) return -1;
      if (b.createdAt) return 1;
      return 0;
    });
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm --filter @app/review-backend test -- tests/file-session-store.test.ts`

Expected: PASS。

---

### Task 3: streamReviewSession 支持取消并持久化 `cancelled`

**Files:**
- Modify: `packages/review-backend/src/application/stream-review-session.ts`
- Modify: `packages/review-backend/src/application/start-review-session.ts`
- Create: `packages/review-backend/tests/stream-review-session.cancel.test.ts`

- [ ] **Step 1: 写失败测试**

新建 `packages/review-backend/tests/stream-review-session.cancel.test.ts`：

```ts
import { describe, expect, it, vi } from "vitest";
import { streamReviewSession } from "../src/application/stream-review-session.js";

describe("streamReviewSession cancellation", () => {
  it("cancels before starting the next unit and persists committed results", async () => {
    const abortController = new AbortController();
    const completeSession = vi.fn().mockResolvedValue(undefined);

    const provider = {
      id: "mock",
      review: vi.fn().mockResolvedValue({
        content: JSON.stringify({
          findings: [
            {
              severity: "high",
              category: "bug",
              summary: "已提交的问题",
              explanation: "第一个 unit 完成前产生的问题"
            }
          ]
        })
      })
    };

    const events: Array<{ type: string }> = [];

    for await (const event of streamReviewSession({
      input: {
        repositoryPath: "/repo",
        baseRef: "main",
        targetRef: "feature",
        contextBudgetTokens: 12000
      },
      signal: abortController.signal,
      dependencies: {
        provider,
        gitClient: {
          readDiff: vi.fn().mockResolvedValue([
            { path: "src/a.ts", isNew: false, isDeleted: false, isBinary: false, insertions: 1, deletions: 0, hunks: [] },
            { path: "src/b.ts", isNew: false, isDeleted: false, isBinary: false, insertions: 1, deletions: 0, hunks: [] }
          ]),
          readFileAtRef: vi.fn().mockResolvedValue("export const value = 1;\n"),
          readWorkspaceDiff: vi.fn().mockResolvedValue([]),
          lsFiles: vi.fn().mockResolvedValue([]),
          grep: vi.fn().mockResolvedValue([])
        },
        sessionStore: {
          createSession: vi.fn().mockResolvedValue({ sessionId: "s_1" }),
          appendEvent: vi.fn().mockImplementation(async (_sessionId, event) => {
            if (event.type === "unit-completed") {
              abortController.abort();
            }
          }),
          completeSession
        }
      }
    })) {
      events.push({ type: event.type });
    }

    expect(events.map((event) => event.type)).toEqual([
      "session-started",
      "unit-completed",
      "session-cancelled"
    ]);
    expect(provider.review).toHaveBeenCalledTimes(1);
    expect(completeSession).toHaveBeenCalledWith("s_1", expect.objectContaining({
      status: "cancelled",
      findings: expect.arrayContaining([expect.objectContaining({ summary: "已提交的问题" })]),
      summary: expect.objectContaining({
        changedFilesCount: 2,
        findingsCount: 1
      })
    }));
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm --filter @app/review-backend test -- tests/stream-review-session.cancel.test.ts`

Expected: FAIL，`streamReviewSession` 不接受 `signal` 或最终事件仍为 `session-finished`。

- [ ] **Step 3: 修改函数签名**

在 `stream-review-session.ts` 的输入类型中增加：

```ts
signal?: AbortSignal;
```

在函数开头解构：

```ts
const signal = input.signal;
```

在 `start-review-session.ts` 允许透传同样的参数：

```ts
export async function startReviewSession(input: {
  input: ReviewSessionInput;
  signal?: AbortSignal;
  dependencies: Parameters<typeof streamReviewSession>[0]["dependencies"];
}) {
  const events: ReviewSessionEvent[] = [];

  for await (const event of streamReviewSession(input)) {
    events.push(event);
  }
```

- [ ] **Step 4: 增加取消收敛 helper**

在 `stream-review-session.ts` 中，在主函数内部 `findings`、`diffByFile` 声明后增加：

```ts
const finishCancelled = async () => {
  const cancelledEvent = {
    type: "session-cancelled" as const,
    sessionId: session.sessionId,
    totalFindings: findings.length
  };
  const summary = buildReviewSummary({
    findings,
    changedFiles: diffFiles.map((file) => file.path)
  });
  await input.dependencies.sessionStore.appendEvent(session.sessionId, cancelledEvent);
  await input.dependencies.sessionStore.completeSession(session.sessionId, {
    sessionId: session.sessionId,
    status: "cancelled",
    repositoryPath,
    baseRef,
    targetRef,
    summary,
    findings,
    diffByFile
  });
  log.info(`审查中止: ${findings.length} 个问题`);
  return cancelledEvent;
};
```

- [ ] **Step 5: 增加检查点**

在读取 diff 前增加：

```ts
if (signal?.aborted) {
  const cancelledEvent = {
    type: "session-cancelled" as const,
    sessionId: session.sessionId,
    totalFindings: 0
  };
  await input.dependencies.sessionStore.appendEvent(session.sessionId, cancelledEvent);
  await input.dependencies.sessionStore.completeSession(session.sessionId, {
    sessionId: session.sessionId,
    status: "cancelled",
    repositoryPath,
    baseRef,
    targetRef,
    summary: buildReviewSummary({ findings: [], changedFiles: [] }),
    findings: [],
    diffByFile: {}
  });
  yield cancelledEvent;
  return;
}
```

在 `for (const unit of units)` 的开头增加：

```ts
if (signal?.aborted) {
  yield await finishCancelled();
  return;
}
```

在 `runToolUseLoop` 调用中传入：

```ts
signal,
```

在 `unitFindings = await Promise.all(...)` 后、`findings.push(...unitFindings)` 前增加：

```ts
if (signal?.aborted) {
  yield await finishCancelled();
  return;
}
```

在构造 `finishedEvent` 前增加：

```ts
if (signal?.aborted) {
  yield await finishCancelled();
  return;
}
```

- [ ] **Step 6: 运行测试确认通过**

Run: `pnpm --filter @app/review-backend test -- tests/stream-review-session.cancel.test.ts`

Expected: PASS。

---

### Task 4: Shell IPC 支持中止运行中的审查

**Files:**
- Modify: `packages/review-shell/src/ipc/review-workbench-handlers.ts`
- Modify: `packages/review-shell/src/main.ts`
- Modify: `packages/review-shell/src/preload.cts`
- Test: `packages/review-shell/tests/review-workbench-handlers.test.ts`

- [ ] **Step 1: 写 handler 失败测试**

在 `packages/review-shell/tests/review-workbench-handlers.test.ts` 增加：

```ts
it("delegates cancelSession to backend", async () => {
  const backend = {
    listRepositories: vi.fn(),
    selectRepository: vi.fn(),
    listBranches: vi.fn(),
    createSession: vi.fn(),
    getSession: vi.fn(),
    listSessions: vi.fn(),
    deleteSession: vi.fn(),
    exportSessionToMarkdown: vi.fn(),
    cancelSession: vi.fn().mockResolvedValue(undefined)
  };

  const handlers = createReviewWorkbenchHandlers({ backend });

  await handlers.cancelSession("session-123");

  expect(backend.cancelSession).toHaveBeenCalledWith("session-123");
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm --filter @app/review-shell test -- tests/review-workbench-handlers.test.ts`

Expected: FAIL，`cancelSession` 不存在。

- [ ] **Step 3: 扩展 handler**

在 `ReviewWorkbenchBackend` 中增加：

```ts
cancelSession(sessionId: string): Promise<void>;
```

在 return object 中增加：

```ts
cancelSession: (sessionId: string) => input.backend.cancelSession(sessionId),
```

- [ ] **Step 4: 更新 main 任务表**

在 `createWindow` 内，创建 handlers 前增加：

```ts
const runningSessions = new Map<string, AbortController>();
```

在 `createSession` 中创建 controller：

```ts
const abortController = new AbortController();
const iterator = streamReviewSession({
  input: request,
  signal: abortController.signal,
  dependencies: {
    provider,
    gitClient,
    sessionStore
  }
});
```

在获得 `session-started` 后：

```ts
runningSessions.set(first.value.sessionId, abortController);
```

在后台消费中使用 `try/finally` 清理：

```ts
void (async () => {
  try {
    for await (const event of iterator) {
      BrowserWindow.getAllWindows().forEach((nextWindow) => {
        nextWindow.webContents.send(`review:session:${first.value.sessionId}`, event);
      });
    }
  } finally {
    runningSessions.delete(first.value.sessionId);
  }
})();
```

在 backend 对象中增加：

```ts
cancelSession: async (sessionId: string) => {
  runningSessions.get(sessionId)?.abort();
}
```

注册 IPC：

```ts
ipcMain.handle("review:cancelSession", (_event, sessionId: string) =>
  handlers.cancelSession(sessionId)
);
```

- [ ] **Step 5: 更新 preload**

在 `contextBridge.exposeInMainWorld` 中增加：

```ts
cancelSession: (sessionId: string) => ipcRenderer.invoke("review:cancelSession", sessionId),
```

- [ ] **Step 6: 运行 shell 测试**

Run: `pnpm --filter @app/review-shell test`

Expected: PASS。

---

### Task 5: Renderer 模型、IPC 和流式 hook 支持中止

**Files:**
- Modify: `packages/review-app/src/lib/review-model.ts`
- Modify: `packages/review-app/src/lib/ipc-client.ts`
- Modify: `packages/review-app/src/lib/review-copy.ts`
- Modify: `packages/review-app/src/hooks/use-review-session-stream.ts`
- Test: `packages/review-app/tests/review-model.test.ts`
- Test: `packages/review-app/tests/use-review-session-stream.test.tsx`

- [ ] **Step 1: 写模型失败测试**

在 `packages/review-app/tests/review-model.test.ts` 增加：

```ts
import { describe, expect, it } from "vitest";
import { reviewSessionDetailSchema, sessionSummarySchema } from "../src/lib/review-model";

describe("review model cancellation", () => {
  it("accepts cancelled sessions and createdAt", () => {
    const detail = reviewSessionDetailSchema.parse({
      sessionId: "s_1",
      status: "cancelled",
      createdAt: "2026-06-19T00:00:00.000Z",
      repositoryPath: "/repo",
      baseRef: "main",
      targetRef: "feature",
      summary: {
        changedFilesCount: 1,
        findingsCount: 0,
        highSeverityCount: 0,
        files: ["src/a.ts"]
      },
      diffByFile: {},
      findings: []
    });

    const summary = sessionSummarySchema.parse({
      sessionId: "s_1",
      status: "cancelled",
      createdAt: "2026-06-19T00:00:00.000Z",
      repositoryPath: "/repo",
      baseRef: "main",
      targetRef: "feature",
      summary: {
        changedFilesCount: 1,
        findingsCount: 0,
        highSeverityCount: 0,
        files: ["src/a.ts"]
      }
    });

    expect(detail.status).toBe("cancelled");
    expect(summary.createdAt).toBe("2026-06-19T00:00:00.000Z");
  });
});
```

- [ ] **Step 2: 运行模型测试确认失败**

Run: `pnpm --filter @app/review-app test -- tests/review-model.test.ts`

Expected: FAIL，schema 不接受 `cancelled`。

- [ ] **Step 3: 更新 renderer 模型**

在 `review-model.ts` 中：

```ts
export type ReviewSessionEvent =
  | { type: "session-started"; sessionId: string }
  | { type: "unit-completed"; sessionId: string; unitId: string; findingsCount: number; findings: ReviewFinding[] }
  | { type: "unit-failed"; sessionId: string; unitId: string; reason: string }
  | { type: "session-finished"; sessionId: string; totalFindings: number; status: "finished" | "partial" }
  | { type: "session-cancelled"; sessionId: string; totalFindings: number };
```

更新状态 schema：

```ts
status: z.enum(["idle", "running", "partial", "finished", "failed", "cancelled"]),
createdAt: z.string().optional(),
```

更新 summary schema：

```ts
status: z.enum(["running", "finished", "failed", "partial", "cancelled"]),
createdAt: z.string().optional(),
```

- [ ] **Step 4: 更新 IPC client**

在 `ReviewWorkbenchApi` 增加：

```ts
cancelSession(sessionId: string): Promise<void>;
```

在 `ipcClient` 增加：

```ts
cancelSession: (sessionId: string) => window.reviewWorkbenchApi.cancelSession(sessionId),
```

- [ ] **Step 5: 更新 hook**

在 `use-review-session-stream.ts` 的 switch 中增加：

```ts
case "session-cancelled":
  updateSessionStatus("cancelled");
  void ipcClient.getSession(sessionId).then(
    (nextSession) => {
      if (active) {
        setSession(nextSession);
      }
    },
    (err) => {
      if (active) {
        console.error("Failed to refresh cancelled session:", err);
      }
    }
  );
  break;
```

- [ ] **Step 6: 更新 copy**

在 `packages/review-app/src/lib/review-copy.ts` 中确认或增加：

```ts
cancelled: "已中止"
```

- [ ] **Step 7: 运行测试**

Run: `pnpm --filter @app/review-app test -- tests/review-model.test.ts tests/use-review-session-stream.test.tsx`

Expected: PASS。

---

### Task 6: 审查页头部显示中止审查并隐藏返回首页

**Files:**
- Modify: `packages/review-app/src/components/ui/status-badge.tsx`
- Modify: `packages/review-app/src/components/session/session-card.tsx`
- Modify: `packages/review-app/src/components/session/sidebar-header.tsx`
- Modify: `packages/review-app/src/pages/review-session-page.tsx`
- Test: `packages/review-app/tests/sidebar-header.test.tsx`
- Test: `packages/review-app/tests/session-card.test.tsx`

- [ ] **Step 1: 写 SidebarHeader 失败测试**

在 `packages/review-app/tests/sidebar-header.test.tsx` 增加：

```tsx
it("shows cancel action instead of back button while running", () => {
  const onCancel = vi.fn();

  render(
    <MemoryRouter>
      <SidebarHeader status="running" onCancel={onCancel} isCancelling={false} />
    </MemoryRouter>
  );

  expect(screen.queryByRole("button", { name: /返回首页/i })).not.toBeInTheDocument();

  const cancelButton = screen.getByRole("button", { name: /中止审查/i });
  fireEvent.click(cancelButton);

  expect(onCancel).toHaveBeenCalledTimes(1);
});

it("shows cancelling transition label", () => {
  render(
    <MemoryRouter>
      <SidebarHeader status="running" onCancel={vi.fn()} isCancelling />
    </MemoryRouter>
  );

  expect(screen.getByRole("button", { name: /正在中止/i })).toBeDisabled();
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm --filter @app/review-app test -- tests/sidebar-header.test.tsx`

Expected: FAIL，`SidebarHeader` 还不接受 `onCancel/isCancelling`。

- [ ] **Step 3: 更新 StatusBadge 和 SessionCard**

在 `status-badge.tsx` 中：

```ts
export type Status = 'finished' | 'failed' | 'running' | 'pending' | 'idle' | 'streaming' | 'partial' | 'cancelled'
```

在 `statusConfig` 增加：

```ts
cancelled: {
  background: 'bg-[rgba(110,118,129,0.1)]',
  text: 'text-text-tertiary',
  icon: XCircle as LucideIcon,
},
```

在 `session-card.tsx` 的 `getStatusBadgeStatus` 增加：

```ts
case 'cancelled': return 'cancelled'
```

- [ ] **Step 4: 更新 SidebarHeader**

替换 props：

```tsx
interface SidebarHeaderProps {
  status: Status;
  onCancel?: () => void;
  isCancelling?: boolean;
}
```

增加运行状态判断：

```tsx
const isRunning = status === "running" || status === "streaming" || status === "pending";
```

在按钮位置渲染：

```tsx
{isRunning ? (
  <button
    onClick={onCancel}
    disabled={isCancelling}
    className="flex items-center gap-2 text-accent-red hover:text-accent-red/80 disabled:text-text-disabled transition-colors"
  >
    <XCircle size={16} />
    <span className="text-sm">{isCancelling ? "正在中止..." : "中止审查"}</span>
  </button>
) : (
  <button
    onClick={() => navigate("/")}
    className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors"
  >
    <ArrowLeft size={16} />
    <span className="text-sm">返回首页</span>
  </button>
)}
```

同时从 lucide-react 引入 `XCircle`。

- [ ] **Step 5: 更新 ReviewSessionPage**

增加状态和 handler：

```tsx
const [isCancelConfirmOpen, setCancelConfirmOpen] = useState(false)
const [isCancelling, setIsCancelling] = useState(false)
const [cancelError, setCancelError] = useState<string | null>(null)

const handleCancelReview = async () => {
  setIsCancelling(true)
  setCancelError(null)
  try {
    await ipcClient.cancelSession(sessionId)
  } catch (err) {
    setCancelError(err instanceof Error ? err.message : '中止审查失败')
    setIsCancelling(false)
  }
}
```

传给 header：

```tsx
<SidebarHeader
  status={session?.status ?? 'idle'}
  onCancel={() => setCancelConfirmOpen(true)}
  isCancelling={isCancelling}
/>
```

在错误区域合并展示：

```tsx
{(error || cancelError) && (
  <div className="p-3 bg-[rgba(248,81,73,0.1)] border-b border-border-muted flex items-center gap-2">
    <AlertTriangle size={14} className="text-accent-red flex-shrink-0" />
    <span className="text-xs text-accent-red">{cancelError ?? error}</span>
  </div>
)}
```

在 JSX 末尾加入确认弹层：

```tsx
{isCancelConfirmOpen && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" role="dialog" aria-modal="true">
    <div className="bg-bg-surface border border-border-default rounded-lg p-5 w-[360px]">
      <h2 className="text-base font-semibold text-text-primary mb-2">中止审查</h2>
      <p className="text-sm text-text-secondary mb-4">
        中止后会保留当前已产生的审查结果。确定要中止这次审查吗？
      </p>
      <div className="flex justify-end gap-2">
        <button
          className="px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary"
          onClick={() => setCancelConfirmOpen(false)}
        >
          继续审查
        </button>
        <button
          className="px-3 py-1.5 text-sm bg-accent-red text-white rounded"
          onClick={() => {
            setCancelConfirmOpen(false)
            void handleCancelReview()
          }}
        >
          中止审查
        </button>
      </div>
    </div>
  </div>
)}
```

增加 effect 在终态清除 `isCancelling`：

```tsx
useEffect(() => {
  if (session?.status === 'cancelled' || session?.status === 'finished' || session?.status === 'partial' || session?.status === 'failed') {
    setIsCancelling(false)
  }
}, [session?.status])
```

- [ ] **Step 6: 运行相关前端测试**

Run: `pnpm --filter @app/review-app test -- tests/sidebar-header.test.tsx tests/session-card.test.tsx`

Expected: PASS。

---

### Task 7: 历史排序与 cancelled 展示的端到端验证

**Files:**
- Modify: `packages/review-app/tests/session-history-page.test.tsx`
- Modify: `packages/review-backend/tests/file-session-store.test.ts`

- [ ] **Step 1: 增加历史页面展示 cancelled 的测试**

在 mocked `sessions` 中加入一条 `cancelled` session：

```ts
{
  sessionId: "s_2",
  status: "cancelled",
  createdAt: "2026-06-19T00:00:00.000Z",
  repositoryPath: "/repo",
  baseRef: "main",
  targetRef: "workspace",
  summary: {
    changedFilesCount: 0,
    findingsCount: 0,
    highSeverityCount: 0,
    files: []
  }
}
```

新增测试：

```tsx
it("renders cancelled session status", () => {
  render(
    <MemoryRouter initialEntries={["/sessions"]}>
      <Routes>
        <Route path="/sessions" element={<SessionHistoryPage />} />
      </Routes>
    </MemoryRouter>
  );

  expect(screen.getByText("已中止")).toBeInTheDocument();
});
```

- [ ] **Step 2: 运行测试**

Run: `pnpm --filter @app/review-app test -- tests/session-history-page.test.tsx`

Expected: PASS。

- [ ] **Step 3: 全量验证**

Run: `pnpm typecheck`

Expected: PASS。

Run: `pnpm test`

Expected: PASS。

---

## Self-Review

**Spec coverage:**
- 历史按 `createdAt` 倒序：Task 2。
- 中止审查并保留历史：Task 1、Task 3、Task 4。
- 中止请求后 finding 不入库：Task 3 在 `findings.push` 前检查 signal。
- 运行中侧边栏不提供返回首页入口：Task 6。
- `cancelled` 中文展示和按钮文案：Task 5、Task 6。
- 找不到运行中任务幂等成功且不改持久化状态：Task 4 的 `runningSessions.get(sessionId)?.abort()`。

**Placeholder scan:** 计划中没有待补全占位；每个任务包含目标文件、测试、实现片段和验证命令。

**Type consistency:** 后端与前端状态值统一为 `cancelled`；事件名统一为 `session-cancelled`；IPC 方法统一为 `cancelSession(sessionId)`。
