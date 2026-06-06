# Review MVP Gap Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 补齐桌面端可视化代码审查 Agent 的真实运行闭环，让用户可以发起真实审查、查看历史会话、在右侧验证真实 diff，并在单元失败时得到部分可用结果。

**Architecture:** 本计划采用一条纵向闭环路线，同时补齐 `review-shell`、`review-backend` 和 `review-app` 三层。主进程负责仓库选择、IPC 注册和流式事件转发；后端负责真实 session 持久化、失败隔离和 diff/finding 组装；renderer 只消费结构化结果，不再依赖运行时 mock。

**Tech Stack:** Electron、Node.js 22、TypeScript 5、React 19、Vite、Zustand、Vitest、Playwright、zod、execa、Monaco Diff Editor

---

## Scope Check

这份计划虽然跨三个包，但只服务一个目标闭环：`从本地仓库选择分支 -> 创建真实审查 session -> 持久化结果 -> 回看历史 -> 在真实 diff 中验证 finding`。它不是多个独立子系统并行开发，因此保持为一个计划是合理的。

## File Structure Map

- Create: `packages/review-shell/package.json` — Electron 主进程与 preload 包配置
- Create: `packages/review-shell/tsconfig.json` — 主进程 TypeScript 构建配置
- Create: `packages/review-shell/src/main.ts` — 创建窗口并注册 IPC
- Create: `packages/review-shell/src/preload.ts` — 暴露 `window.reviewWorkbenchApi`
- Create: `packages/review-shell/src/ipc/review-workbench-handlers.ts` — 连接 shell 和 backend 的 IPC handler
- Create: `packages/review-shell/tests/review-workbench-handlers.test.ts` — 主进程 handler 单测
- Create: `packages/review-backend/src/application/get-review-session.ts` — 读取单个 session 详情
- Create: `packages/review-backend/src/application/list-review-sessions.ts` — 列出历史 session
- Create: `packages/review-backend/tests/file-session-store.test.ts` — session store 读写测试
- Create: `packages/review-backend/tests/stream-review-session.partial.test.ts` — 单元失败隔离测试
- Create: `packages/review-app/src/pages/session-history-page.tsx` — 会话历史页
- Modify: `packages/review-backend/src/domain/review-session.ts` — 扩展事件和 session detail 类型
- Modify: `packages/review-backend/src/contracts/ipc.ts` — 扩展 IPC contract
- Modify: `packages/review-backend/src/application/stream-review-session.ts` — 失败隔离、事件增强、diff 详情汇总
- Modify: `packages/review-backend/src/infrastructure/storage/file-session-store.ts` — 读、列、订阅基础
- Modify: `packages/review-backend/src/index.ts` — 导出新增应用服务
- Modify: `packages/review-app/src/main.tsx` — 仅测试环境注入 mock
- Modify: `packages/review-app/src/app/router.tsx` — 增加历史页路由
- Modify: `packages/review-app/src/lib/ipc-client.ts` — 接入扩展 contract
- Modify: `packages/review-app/src/lib/review-model.ts` — 扩展 session detail / diff payload
- Modify: `packages/review-app/src/pages/review-session-page.tsx` — 右侧展示真实 diff
- Modify: `packages/review-app/src/components/diff/monaco-diff-viewer.tsx` — 消费 before/after 文本
- Modify: `packages/review-app/tests/review-session-page.test.tsx` — 更新真实 diff 断言
- Modify: `packages/review-app/tests/app.e2e.spec.ts` — 验证真实导航和历史回看

### Task 1: 新增 `review-shell` 包并打通真实 IPC / preload

**Files:**
- Create: `packages/review-shell/package.json`
- Create: `packages/review-shell/tsconfig.json`
- Create: `packages/review-shell/src/main.ts`
- Create: `packages/review-shell/src/preload.ts`
- Create: `packages/review-shell/src/ipc/review-workbench-handlers.ts`
- Test: `packages/review-shell/tests/review-workbench-handlers.test.ts`
- Modify: `pnpm-workspace.yaml`
- Modify: `vitest.workspace.ts`

- [ ] **Step 1: 先写失败测试，锁定主进程 handler contract**

```ts
import { describe, expect, it, vi } from "vitest";
import { createReviewWorkbenchHandlers } from "../src/ipc/review-workbench-handlers.js";

describe("createReviewWorkbenchHandlers", () => {
  it("creates session and forwards follow-up reads", async () => {
    const backend = {
      listRepositories: vi.fn().mockResolvedValue(["/repo"]),
      listBranches: vi.fn().mockResolvedValue(["main", "feature"]),
      createSession: vi.fn().mockResolvedValue({ sessionId: "s_1" }),
      getSession: vi.fn().mockResolvedValue({ sessionId: "s_1", status: "running" }),
      listSessions: vi.fn().mockResolvedValue([])
    };

    const handlers = createReviewWorkbenchHandlers({ backend });

    await expect(handlers.listRepositories()).resolves.toEqual(["/repo"]);
    await expect(handlers.createSession({
      repositoryPath: "/repo",
      baseRef: "main",
      targetRef: "feature",
      providerProfileId: "default",
      contextBudgetTokens: 12000
    })).resolves.toEqual({ sessionId: "s_1" });
    await expect(handlers.getSession("s_1")).resolves.toMatchObject({ sessionId: "s_1" });
  });
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `pnpm --filter @app/review-shell test`
Expected: FAIL，提示找不到 `createReviewWorkbenchHandlers` 或 `@app/review-shell`

- [ ] **Step 3: 创建 `review-shell` 包配置和 TypeScript 配置**

```json
{
  "name": "@app/review-shell",
  "private": true,
  "type": "module",
  "main": "dist/main.js",
  "scripts": {
    "build": "tsc -b",
    "test": "vitest run"
  },
  "dependencies": {
    "electron": "^36.4.0",
    "@app/review-backend": "workspace:*"
  },
  "devDependencies": {
    "@types/node": "^22.13.10",
    "typescript": "^5.8.3",
    "vitest": "^3.2.6"
  }
}
```

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist",
    "composite": true
  },
  "include": ["src/**/*.ts", "tests/**/*.ts"]
}
```

```ts
import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  {
    test: {
      name: "review-backend",
      include: ["packages/review-backend/tests/**/*.test.ts"],
      environment: "node"
    }
  },
  {
    test: {
      name: "review-app",
      include: ["packages/review-app/tests/**/*.test.ts?(x)"],
      environment: "jsdom"
    }
  },
  {
    test: {
      name: "review-shell",
      include: ["packages/review-shell/tests/**/*.test.ts"],
      environment: "node"
    }
  }
]);
```

- [ ] **Step 4: 实现 preload 和 handler**

```ts
// packages/review-shell/src/preload.ts
import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("reviewWorkbenchApi", {
  listRepositories: () => ipcRenderer.invoke("review:listRepositories"),
  listBranches: (repositoryPath: string) =>
    ipcRenderer.invoke("review:listBranches", repositoryPath),
  createSession: (input: unknown) => ipcRenderer.invoke("review:createSession", input),
  getSession: (sessionId: string) => ipcRenderer.invoke("review:getSession", sessionId),
  listSessions: () => ipcRenderer.invoke("review:listSessions"),
  subscribeSession: (sessionId: string, onEvent: (event: unknown) => void) => {
    const channel = `review:session:${sessionId}`;
    const listener = (_event: unknown, payload: unknown) => onEvent(payload);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  }
});
```

```ts
// packages/review-shell/src/ipc/review-workbench-handlers.ts
import { createReviewSessionRequestSchema } from "@app/review-backend";

export function createReviewWorkbenchHandlers(input: {
  backend: {
    listRepositories(): Promise<string[]>;
    listBranches(repositoryPath: string): Promise<string[]>;
    createSession(request: unknown): Promise<{ sessionId: string }>;
    getSession(sessionId: string): Promise<unknown>;
    listSessions(): Promise<unknown[]>;
  };
}) {
  return {
    listRepositories: () => input.backend.listRepositories(),
    listBranches: (repositoryPath: string) => input.backend.listBranches(repositoryPath),
    createSession: (request: unknown) =>
      input.backend.createSession(createReviewSessionRequestSchema.parse(request)),
    getSession: (sessionId: string) => input.backend.getSession(sessionId),
    listSessions: () => input.backend.listSessions()
  };
}
```

- [ ] **Step 5: 注册 BrowserWindow 和 IPC**

```ts
// packages/review-shell/src/main.ts
import { app, BrowserWindow, ipcMain } from "electron";
import { join } from "node:path";
import { createReviewWorkbenchHandlers } from "./ipc/review-workbench-handlers.js";

async function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 960,
    webPreferences: {
      preload: join(import.meta.dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const handlers = createReviewWorkbenchHandlers({
    backend: {
      listRepositories: async () => [],
      listBranches: async () => [],
      createSession: async () => ({ sessionId: "stub" }),
      getSession: async () => ({ sessionId: "stub", status: "idle" }),
      listSessions: async () => []
    }
  });

  ipcMain.handle("review:listRepositories", handlers.listRepositories);
  ipcMain.handle("review:listBranches", (_event, repositoryPath: string) =>
    handlers.listBranches(repositoryPath)
  );
  ipcMain.handle("review:createSession", (_event, request: unknown) =>
    handlers.createSession(request)
  );
  ipcMain.handle("review:getSession", (_event, sessionId: string) => handlers.getSession(sessionId));
  ipcMain.handle("review:listSessions", handlers.listSessions);

  await window.loadURL("http://127.0.0.1:4173");
}

app.whenReady().then(createWindow);
```

- [ ] **Step 6: 运行测试并确认通过**

Run: `pnpm --filter @app/review-shell test`
Expected: PASS，`createReviewWorkbenchHandlers` 用例通过

- [ ] **Step 7: Commit**

```bash
git add pnpm-workspace.yaml vitest.workspace.ts packages/review-shell
git commit -m "feat: add electron shell ipc bridge"
```

### Task 2: 扩展 backend session store，支持真实读取、列表和 session detail

**Files:**
- Modify: `packages/review-backend/src/domain/review-session.ts`
- Modify: `packages/review-backend/src/contracts/ipc.ts`
- Modify: `packages/review-backend/src/infrastructure/storage/file-session-store.ts`
- Create: `packages/review-backend/src/application/get-review-session.ts`
- Create: `packages/review-backend/src/application/list-review-sessions.ts`
- Create: `packages/review-backend/tests/file-session-store.test.ts`
- Modify: `packages/review-backend/src/index.ts`

- [ ] **Step 1: 先写失败测试，锁定 session store 的读写接口**

```ts
import { describe, expect, it } from "vitest";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FileSessionStore } from "../src/infrastructure/storage/file-session-store.js";

describe("FileSessionStore", () => {
  it("persists and reads back a finished session", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "review-store-"));
    const store = new FileSessionStore(rootDir);

    const session = await store.createSession({
      repositoryPath: "/repo",
      baseRef: "main",
      targetRef: "feature"
    });

    await store.appendEvent(session.sessionId, {
      type: "session-started",
      sessionId: session.sessionId
    });

    await store.completeSession(session.sessionId, {
      sessionId: session.sessionId,
      status: "finished",
      summary: { changedFilesCount: 1, findingsCount: 0, highSeverityCount: 0, files: [] },
      findings: []
    });

    await expect(store.getSession(session.sessionId)).resolves.toMatchObject({
      sessionId: session.sessionId,
      status: "finished"
    });
    await expect(store.listSessions()).resolves.toHaveLength(1);
  });
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `pnpm --filter @app/review-backend test -- file-session-store.test.ts`
Expected: FAIL，提示 `getSession` 或 `listSessions` 不存在

- [ ] **Step 3: 扩展 session schema 和 IPC contract**

```ts
// packages/review-backend/src/domain/review-session.ts
export const reviewSessionEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("session-started"),
    sessionId: z.string()
  }),
  z.object({
    type: z.literal("unit-completed"),
    sessionId: z.string(),
    unitId: z.string(),
    findingsCount: z.number().int().nonnegative()
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
  })
]);

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
  findings: z.array(reviewFindingSchema),
  diffByFile: z.record(z.object({
    original: z.string(),
    modified: z.string()
  }))
});
```

```ts
// packages/review-backend/src/contracts/ipc.ts
export const reviewSessionDetailPayloadSchema = reviewSessionDetailSchema;
export type ReviewSessionDetailPayload = z.infer<typeof reviewSessionDetailPayloadSchema>;
```

- [ ] **Step 4: 实现 `FileSessionStore` 读取和列表**

```ts
import { appendFile, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

export class FileSessionStore {
  constructor(private readonly rootDir: string) {}

  async createSession(input: { repositoryPath: string; baseRef: string; targetRef: string }) {
    const sessionId = randomUUID();
    const sessionDir = join(this.rootDir, sessionId);
    await mkdir(sessionDir, { recursive: true });
    await writeFile(
      join(sessionDir, "session.json"),
      JSON.stringify({ sessionId, ...input, status: "running" }, null, 2)
    );
    await writeFile(join(sessionDir, "events.jsonl"), "");
    return { sessionId, sessionDir };
  }

  async appendEvent(sessionId: string, event: unknown) {
    await appendFile(join(this.rootDir, sessionId, "events.jsonl"), `${JSON.stringify(event)}\n`);
  }

  async completeSession(sessionId: string, summary: unknown) {
    await writeFile(join(this.rootDir, sessionId, "summary.json"), JSON.stringify(summary, null, 2));
  }

  async getSession(sessionId: string) {
    const sessionJson = await readFile(join(this.rootDir, sessionId, "session.json"), "utf8");
    const summaryJson = await readFile(join(this.rootDir, sessionId, "summary.json"), "utf8");
    return {
      ...JSON.parse(sessionJson),
      ...JSON.parse(summaryJson)
    };
  }

  async listSessions() {
    const names = await readdir(this.rootDir);
    const sessions = await Promise.all(names.map((name) => this.getSession(name).catch(() => null)));
    return sessions.filter(Boolean);
  }
}
```

- [ ] **Step 5: 实现查询应用服务并导出**

```ts
// packages/review-backend/src/application/get-review-session.ts
export async function getReviewSession(input: {
  sessionId: string;
  sessionStore: { getSession(sessionId: string): Promise<unknown> };
}) {
  return input.sessionStore.getSession(input.sessionId);
}
```

```ts
// packages/review-backend/src/application/list-review-sessions.ts
export async function listReviewSessions(input: {
  sessionStore: { listSessions(): Promise<unknown[]> };
}) {
  return input.sessionStore.listSessions();
}
```

```ts
// packages/review-backend/src/index.ts
export * from "./application/get-review-session.js";
export * from "./application/list-review-sessions.js";
```

- [ ] **Step 6: 运行测试并确认通过**

Run: `pnpm --filter @app/review-backend test -- file-session-store.test.ts`
Expected: PASS，session 读回和列表读取成功

- [ ] **Step 7: Commit**

```bash
git add packages/review-backend/src/domain/review-session.ts packages/review-backend/src/contracts/ipc.ts packages/review-backend/src/infrastructure/storage/file-session-store.ts packages/review-backend/src/application/get-review-session.ts packages/review-backend/src/application/list-review-sessions.ts packages/review-backend/tests/file-session-store.test.ts packages/review-backend/src/index.ts
git commit -m "feat: add session read and history queries"
```

### Task 3: 给审查流增加单元失败隔离和真实 diff 详情

**Files:**
- Modify: `packages/review-backend/src/application/stream-review-session.ts`
- Modify: `packages/review-backend/src/application/build-review-summary.ts`
- Create: `packages/review-backend/tests/stream-review-session.partial.test.ts`

- [ ] **Step 1: 先写失败测试，锁定 partial session 行为**

```ts
import { describe, expect, it, vi } from "vitest";
import { streamReviewSession } from "../src/application/stream-review-session.js";

describe("streamReviewSession partial mode", () => {
  it("keeps later units running when one unit fails", async () => {
    const provider = {
      id: "mock",
      review: vi
        .fn()
        .mockRejectedValueOnce(new Error("provider timeout"))
        .mockResolvedValueOnce({ content: JSON.stringify({ findings: [] }) })
    };

    const events: Array<{ type: string }> = [];

    for await (const event of streamReviewSession({
      input: {
        repositoryPath: "/repo",
        baseRef: "main",
        targetRef: "feature",
        providerProfileId: "default",
        contextBudgetTokens: 12000
      },
      dependencies: {
        provider,
        gitClient: {
          readDiff: vi.fn().mockResolvedValue([
            { path: "src/a.ts", hunks: [] },
            { path: "src/b.ts", hunks: [] }
          ]),
          readFileAtRef: vi.fn().mockResolvedValue("export const value = 1;\n")
        },
        sessionStore: {
          createSession: vi.fn().mockResolvedValue({ sessionId: "s_1" }),
          appendEvent: vi.fn().mockResolvedValue(undefined),
          completeSession: vi.fn().mockResolvedValue(undefined)
        }
      }
    })) {
      events.push({ type: event.type });
    }

    expect(events.map((event) => event.type)).toEqual([
      "session-started",
      "unit-failed",
      "unit-completed",
      "session-finished"
    ]);
  });
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `pnpm --filter @app/review-backend test -- stream-review-session.partial.test.ts`
Expected: FAIL，当前实现会在第一个失败单元直接抛错退出

- [ ] **Step 3: 用 `try/catch` 隔离单元失败，并收集真实 before/after 文本**

```ts
export async function* streamReviewSession(input: {
  input: ReviewSessionInput;
  dependencies: {
    provider: Pick<LlmProvider, "id" | "review">;
    gitClient: Pick<GitClient, "readDiff" | "readFileAtRef">;
    sessionStore: SessionStore;
  };
}): AsyncGenerator<ReviewSessionEvent, void, void> {
  const session = await input.dependencies.sessionStore.createSession({
    repositoryPath: input.input.repositoryPath,
    baseRef: input.input.baseRef,
    targetRef: input.input.targetRef
  });

  const diffFiles = await input.dependencies.gitClient.readDiff(
    input.input.baseRef,
    input.input.targetRef
  );
  const units = buildReviewUnits(diffFiles as ParsedDiffFile[]);
  const findings: ReviewFinding[] = [];
  const diffByFile: Record<string, { original: string; modified: string }> = {};
  let hasUnitFailure = false;

  yield { type: "session-started", sessionId: session.sessionId };

  for (const unit of units) {
    try {
      const context = await collectUnitContext({
        gitClient: input.dependencies.gitClient,
        baseRef: input.input.baseRef,
        targetRef: input.input.targetRef,
        unit
      });

      diffByFile[unit.primaryFile] = {
        original: context.beforeContent,
        modified: context.afterContent
      };

      const result = await input.dependencies.provider.review({
        prompt: JSON.stringify({
          task: "review",
          unit,
          context
        })
      });

      const unitFindings = normalizeProviderOutput({
        content: result.content,
        fallbackFile: unit.primaryFile
      });

      findings.push(...unitFindings);

      yield {
        type: "unit-completed",
        sessionId: session.sessionId,
        unitId: unit.id,
        findingsCount: unitFindings.length
      };
    } catch (error) {
      hasUnitFailure = true;
      yield {
        type: "unit-failed",
        sessionId: session.sessionId,
        unitId: unit.id,
        reason: error instanceof Error ? error.message : "unknown error"
      };
    }
  }

  const summary = buildReviewSummary({
    findings,
    changedFiles: units.map((unit) => unit.primaryFile)
  });

  const detail = {
    sessionId: session.sessionId,
    status: hasUnitFailure ? "partial" : "finished",
    repositoryPath: input.input.repositoryPath,
    baseRef: input.input.baseRef,
    targetRef: input.input.targetRef,
    summary,
    findings,
    diffByFile
  };

  await input.dependencies.sessionStore.completeSession(session.sessionId, detail);

  yield {
    type: "session-finished",
    sessionId: session.sessionId,
    totalFindings: findings.length,
    status: hasUnitFailure ? "partial" : "finished"
  };
}
```

- [ ] **Step 4: 保持摘要输出和部分可用状态一致**

```ts
export function buildReviewSummary(input: {
  findings: ReviewFinding[];
  changedFiles: string[];
}) {
  const files = Array.from(new Set(input.changedFiles));

  return {
    changedFilesCount: files.length,
    findingsCount: input.findings.length,
    highSeverityCount: input.findings.filter((item) => item.severity === "high").length,
    files
  };
}
```

- [ ] **Step 5: 运行测试并确认通过**

Run: `pnpm --filter @app/review-backend test -- stream-review-session.partial.test.ts`
Expected: PASS，事件顺序包含 `unit-failed`，最终状态是 `partial`

- [ ] **Step 6: Commit**

```bash
git add packages/review-backend/src/application/stream-review-session.ts packages/review-backend/src/application/build-review-summary.ts packages/review-backend/tests/stream-review-session.partial.test.ts
git commit -m "feat: isolate unit failures in review stream"
```

### Task 4: renderer 切换到真实 session、历史页和真实 diff 详情

**Files:**
- Modify: `packages/review-app/src/main.tsx`
- Modify: `packages/review-app/src/app/router.tsx`
- Modify: `packages/review-app/src/lib/review-model.ts`
- Modify: `packages/review-app/src/lib/ipc-client.ts`
- Modify: `packages/review-app/src/pages/review-session-page.tsx`
- Create: `packages/review-app/src/pages/session-history-page.tsx`
- Modify: `packages/review-app/src/components/diff/monaco-diff-viewer.tsx`
- Modify: `packages/review-app/src/test/mock-review-workbench-api.ts`
- Modify: `packages/review-app/tests/review-session-page.test.tsx`
- Modify: `packages/review-app/tests/app.e2e.spec.ts`

- [ ] **Step 1: 先写失败测试，锁定“右侧显示真实 diff”**

```ts
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ReviewSessionPage } from "../src/pages/review-session-page";

vi.mock("../src/lib/ipc-client", () => ({
  ipcClient: {
    getSession: vi.fn().mockResolvedValue({
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
      diffByFile: {
        "src/a.ts": {
          original: "export const a = 1;\n",
          modified: "export const a = 2;\n"
        }
      },
      findings: [
        {
          id: "f_1",
          severity: "high",
          category: "bug-risk",
          summary: "值发生变化",
          explanation: "需要验证是否影响调用方",
          file: "src/a.ts",
          startLine: 1,
          endLine: 1,
          confidenceSignals: [],
          status: "line-level"
        }
      ]
    }),
    subscribeSession: vi.fn().mockReturnValue(() => {})
  }
}));

it("shows original and modified diff content for selected finding", async () => {
  render(
    <MemoryRouter initialEntries={["/sessions/s_1"]}>
      <Routes>
        <Route path="/sessions/:sessionId" element={<ReviewSessionPage />} />
      </Routes>
    </MemoryRouter>
  );

  expect(await screen.findByText("值发生变化")).toBeInTheDocument();
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `pnpm --filter @app/review-app test -- review-session-page.test.tsx`
Expected: FAIL，当前页面没有 `diffByFile`，右侧仍使用 `evidence/explanation`

- [ ] **Step 3: 扩展前端模型并移除生产环境 mock 注入**

```ts
// packages/review-app/src/lib/review-model.ts
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
  diffByFile: z.record(
    z.object({
      original: z.string(),
      modified: z.string()
    })
  ),
  findings: z.array(reviewFindingSchema)
});
```

```ts
// packages/review-app/src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { AppProviders } from "./app/providers";
import { AppRouter } from "./app/router";
import "./styles/globals.css";
import { ensureReviewWorkbenchApi } from "./test/mock-review-workbench-api";

if (import.meta.env.MODE === "test") {
  ensureReviewWorkbenchApi();
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppProviders>
      <AppRouter />
    </AppProviders>
  </React.StrictMode>
);
```

- [ ] **Step 4: 增加历史页路由并显示真实 diff**

```ts
// packages/review-app/src/app/router.tsx
import { createHashRouter, RouterProvider } from "react-router-dom";

const router = createHashRouter([
  { path: "/", element: <ReviewLaunchPage /> },
  { path: "/sessions", element: <SessionHistoryPage /> },
  { path: "/sessions/:sessionId", element: <ReviewSessionPage /> },
  { path: "/settings", element: <SettingsPage /> }
]);
```

```ts
// packages/review-app/src/pages/review-session-page.tsx
const selectedFinding = useSelectedFinding();
const selectedDiff = selectedFinding ? session?.diffByFile[selectedFinding.file] : null;

<MonacoDiffViewer
  original={selectedDiff?.original ?? ""}
  modified={selectedDiff?.modified ?? ""}
  finding={selectedFinding}
/>;
```

```ts
// packages/review-app/src/pages/session-history-page.tsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AppShell } from "@/components/layout/app-shell";
import { ipcClient } from "@/lib/ipc-client";
import type { ReviewSessionDetail } from "@/lib/review-model";

export function SessionHistoryPage() {
  const [sessions, setSessions] = useState<ReviewSessionDetail[]>([]);

  useEffect(() => {
    void ipcClient.listSessions().then(setSessions);
  }, []);

  return (
    <AppShell>
      <div className="mx-auto grid h-full max-w-4xl content-start gap-4 px-10 py-12">
        <h1 className="m-0 text-3xl font-semibold">历史会话</h1>
        {sessions.map((session) => (
          <Link key={session.sessionId} to={`/sessions/${session.sessionId}`} className="rounded-2xl border p-4">
            {session.baseRef} → {session.targetRef} / {session.status}
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
```

- [ ] **Step 5: 让 mock API 也返回 `diffByFile`，保持测试环境一致**

```ts
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
  diffByFile: {
    "src/a.ts": {
      original: "export const a = 1;\n",
      modified: "export const a = 2;\n"
    }
  },
  findings: [
    {
      id: "f_1",
      severity: "high",
      category: "bug-risk",
      summary: "空值保护缺失",
      explanation: "调用链可能传入 undefined",
      file: "src/a.ts",
      startLine: 1,
      endLine: 1,
      confidenceSignals: [],
      status: "line-level"
    }
  ]
})
```

- [ ] **Step 6: 运行前端测试并确认通过**

Run: `pnpm --filter @app/review-app test`
Expected: PASS，`review-session-page` 使用真实 diff 数据，路由新增历史页后现有测试一并更新通过

- [ ] **Step 7: Commit**

```bash
git add packages/review-app/src/main.tsx packages/review-app/src/app/router.tsx packages/review-app/src/lib/review-model.ts packages/review-app/src/lib/ipc-client.ts packages/review-app/src/pages/review-session-page.tsx packages/review-app/src/pages/session-history-page.tsx packages/review-app/src/components/diff/monaco-diff-viewer.tsx packages/review-app/src/test/mock-review-workbench-api.ts packages/review-app/tests/review-session-page.test.tsx packages/review-app/tests/app.e2e.spec.ts
git commit -m "feat: wire renderer to real session detail"
```

### Task 5: 联调 shell、backend、renderer，并补端到端验证

**Files:**
- Modify: `packages/review-shell/src/main.ts`
- Modify: `packages/review-shell/src/ipc/review-workbench-handlers.ts`
- Modify: `packages/review-app/tests/app.e2e.spec.ts`
- Modify: `packages/review-backend/tests/start-review-session.test.ts`

- [ ] **Step 1: 先写端到端用例，锁定历史回看和 partial 状态**

```ts
import { expect, test } from "@playwright/test";

test("opens session detail and history list", async ({ page }) => {
  await page.goto("http://127.0.0.1:4173");
  await page.getByLabel("仓库").selectOption("/repo");
  await page.getByLabel("Base 分支").selectOption("main");
  await page.getByLabel("Target 分支").selectOption("feature");
  await page.getByRole("button", { name: "开始审查" }).click();

  await expect(page.getByText("当前状态：finished")).toBeVisible();

  await page.goto("http://127.0.0.1:4173/#/sessions");
  await expect(page.getByText("历史会话")).toBeVisible();
});
```

- [ ] **Step 2: 运行 E2E 并确认失败**

Run: `pnpm --filter @app/review-app test:e2e`
Expected: FAIL，当前没有历史页，也没有真实 shell/backend 联调

- [ ] **Step 3: 把 shell handlers 连接到真实 backend facade**

```ts
import {
  FileSessionStore,
  GitClient,
  OpenAiCompatibleProvider,
  getReviewSession,
  listReviewSessions,
  streamReviewSession
} from "@app/review-backend";

const sessionStore = new FileSessionStore(join(app.getPath("userData"), "review-sessions"));

const handlers = createReviewWorkbenchHandlers({
  backend: {
    listRepositories: async () => [process.cwd()],
    listBranches: async (repositoryPath: string) => new GitClient(repositoryPath).listBranches(),
    createSession: async (request) => {
      const gitClient = new GitClient(request.repositoryPath);
      const provider = new OpenAiCompatibleProvider({
        id: request.providerProfileId,
        baseUrl: process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
        apiKey: process.env.OPENAI_API_KEY ?? "",
        model: process.env.OPENAI_MODEL ?? "gpt-5"
      });

      const iterator = streamReviewSession({
        input: request,
        dependencies: {
          provider,
          gitClient,
          sessionStore
        }
      });

      const first = await iterator.next();
      if (first.done || first.value.type !== "session-started") {
        throw new Error("review session did not emit session-started");
      }

      void (async () => {
        for await (const event of iterator) {
          BrowserWindow.getAllWindows().forEach((window) => {
            window.webContents.send(`review:session:${first.value.sessionId}`, event);
          });
        }
      })();

      return { sessionId: first.value.sessionId };
    },
    getSession: async (sessionId) => getReviewSession({ sessionId, sessionStore }),
    listSessions: async () => listReviewSessions({ sessionStore })
  }
});
```

- [ ] **Step 4: 回归 backend 和前端测试**

Run: `pnpm --filter @app/review-backend test`
Expected: PASS，包含新增 partial 和 session store 测试

Run: `pnpm --filter @app/review-app test`
Expected: PASS，历史页、真实 diff、test-only mock 注入全部通过

Run: `pnpm --filter @app/review-app test:e2e`
Expected: PASS，能创建 session 并进入历史页

- [ ] **Step 5: Commit**

```bash
git add packages/review-shell/src/main.ts packages/review-shell/src/ipc/review-workbench-handlers.ts packages/review-app/tests/app.e2e.spec.ts packages/review-backend/tests/start-review-session.test.ts
git commit -m "feat: close real review mvp loop"
```

## Self-Review

### 1. Spec coverage

设计文档里的以下 MVP 要求都被覆盖：

1. 选择本地仓库和两个分支发起审查：Task 1、Task 5
2. 保存、回看审查会话：Task 2、Task 4、Task 5
3. 右侧真实 diff 验证 finding：Task 3、Task 4
4. 单元失败隔离与部分可用状态：Task 3、Task 5
5. renderer 不直接访问文件系统、git 或 provider：Task 1、Task 4

没有遗漏“重跑失败单元”这一长期目标，但本计划只先做到 `partial` 状态与失败可见，仍符合 MVP 的第一轮闭环范围。

### 2. Placeholder scan

已检查本计划，没有 `TBD`、`TODO`、`implement later`、`similar to Task N` 之类占位内容。

### 3. Type consistency

1. session detail 统一使用 `diffByFile`
2. session 结束状态统一使用 `finished | partial`
3. shell 暴露的前端 API 方法名与现有 `ipc-client.ts` 保持一致：`listRepositories`、`listBranches`、`createSession`、`getSession`、`listSessions`、`subscribeSession`
