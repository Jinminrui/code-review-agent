# 流式 Findings 可查看 Diff Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让审查进行中已经流式输出的 findings 能立即显示对应 diff，而不是等会话完成后刷新完整 session。

**Architecture:** 后端把当前 unit 的 `diffByFile` 作为 `unit-completed` 事件的一部分发给 renderer。前端在处理流式事件时同时合并 findings 和 diff 上下文，右侧详情继续只依赖 `session.diffByFile[finding.file]`。额外增加 finding 文件路径归一化，避免模型返回 `./src/a.ts` 或绝对路径时无法命中 diff key。

**Tech Stack:** Electron, TypeScript, React, Zustand, Vitest, Testing Library, zod, pnpm workspace.

---

## 成功标准

1. 审查运行中收到 `unit-completed` 后，新增 finding 的文件能立即在右侧显示 diff。
2. `unit-completed` 事件通过后端 zod schema 和 renderer 类型/schema 校验。
3. 前端 store 合并流式 diff 时不覆盖已有文件 diff，不重复破坏 summary 统计。
4. 模型返回 `./src/file.ts` 时，finding.file 被归一化为 `src/file.ts`，能命中 `diffByFile`。
5. 后端、前端相关单元测试通过。

---

## File Structure

- Modify: `packages/review-backend/src/domain/review-session.ts`
  - 扩展 `unit-completed` 事件，增加 `diffByFile` 字段。
- Modify: `packages/review-backend/src/application/stream-review-session.ts`
  - 发送 `unit-completed` 时带上当前 unit 的 diff。
  - 对 tool calling 路径返回的 finding.file 做最小归一化。
- Modify: `packages/review-app/src/lib/review-model.ts`
  - 同步扩展 renderer 的 `ReviewSessionEvent` 类型。
- Modify: `packages/review-app/src/store/review-session-store.ts`
  - 让流式追加 findings 时可同时合并 `diffByFile`。
- Modify: `packages/review-app/src/hooks/use-review-session-stream.ts`
  - 处理 `unit-completed.diffByFile`。
- Tests:
  - `packages/review-backend/tests/review-session-types.test.ts`
  - `packages/review-backend/tests/stream-review-session.workspace.test.ts`
  - `packages/review-app/tests/review-model.test.ts`
  - `packages/review-app/tests/use-review-session-stream.test.tsx`

---

### Task 1: 扩展 `unit-completed` 事件 contract

**Files:**
- Modify: `packages/review-backend/src/domain/review-session.ts`
- Modify: `packages/review-app/src/lib/review-model.ts`
- Test: `packages/review-backend/tests/review-session-types.test.ts`
- Test: `packages/review-app/tests/review-model.test.ts`

- [ ] **Step 1: 写后端失败测试**

在 `packages/review-backend/tests/review-session-types.test.ts` 增加：

```ts
import { describe, expect, it } from "vitest";
import { reviewSessionEventSchema } from "../src/domain/review-session.js";

describe("review session event schemas", () => {
  it("accepts unit-completed events with streaming diff content", () => {
    const parsed = reviewSessionEventSchema.parse({
      type: "unit-completed",
      sessionId: "s_1",
      unitId: "unit:src/file.ts",
      findingsCount: 1,
      findings: [
        {
          id: "f_1",
          severity: "high",
          category: "bug",
          summary: "空值会导致崩溃",
          explanation: "新增代码没有校验 null。",
          file: "src/file.ts",
          startLine: 2,
          endLine: 2,
          confidenceSignals: [],
          status: "line-level"
        }
      ],
      diffByFile: {
        "src/file.ts": {
          original: "export const value = 1;\n",
          modified: "export const value = maybeNull.value;\n"
        }
      }
    });

    expect(parsed.diffByFile["src/file.ts"]?.modified).toContain("maybeNull");
  });
});
```

- [ ] **Step 2: 运行后端测试确认失败**

Run:

```bash
pnpm --filter @app/review-backend test packages/review-backend/tests/review-session-types.test.ts
```

Expected: FAIL，错误指向 `unit-completed` 事件不接受 `diffByFile` 字段，或测试文件需要合并现有 import。

- [ ] **Step 3: 修改后端事件 schema**

在 `packages/review-backend/src/domain/review-session.ts` 中给 `unit-completed` 分支增加：

```ts
diffByFile: z.record(
  z.object({
    original: z.string(),
    modified: z.string()
  })
)
```

目标结构：

```ts
z.object({
  type: z.literal("unit-completed"),
  sessionId: z.string(),
  unitId: z.string(),
  findingsCount: z.number().int().nonnegative(),
  findings: z.array(reviewFindingSchema),
  diffByFile: z.record(
    z.object({
      original: z.string(),
      modified: z.string()
    })
  )
})
```

- [ ] **Step 4: 写 renderer 失败测试**

在 `packages/review-app/tests/review-model.test.ts` 增加：

```ts
import { describe, expect, it } from "vitest";
import type { ReviewSessionEvent } from "../src/lib/review-model";

describe("ReviewSessionEvent", () => {
  it("types unit-completed events with streaming diff content", () => {
    const event: ReviewSessionEvent = {
      type: "unit-completed",
      sessionId: "s_1",
      unitId: "unit:src/file.ts",
      findingsCount: 0,
      findings: [],
      diffByFile: {
        "src/file.ts": {
          original: "before\n",
          modified: "after\n"
        }
      }
    };

    expect(event.diffByFile["src/file.ts"]?.modified).toBe("after\n");
  });
});
```

- [ ] **Step 5: 运行 renderer 类型相关测试确认失败**

Run:

```bash
pnpm --filter @app/review-app test packages/review-app/tests/review-model.test.ts
```

Expected: FAIL，TypeScript 报 `diffByFile` 不存在于 `unit-completed` 事件类型。

- [ ] **Step 6: 修改 renderer 事件类型**

在 `packages/review-app/src/lib/review-model.ts` 中把 `unit-completed` 类型改为：

```ts
| {
    type: "unit-completed";
    sessionId: string;
    unitId: string;
    findingsCount: number;
    findings: ReviewFinding[];
    diffByFile: Record<string, { original: string; modified: string }>;
  }
```

- [ ] **Step 7: 运行 Task 1 测试确认通过**

Run:

```bash
pnpm --filter @app/review-backend test packages/review-backend/tests/review-session-types.test.ts
pnpm --filter @app/review-app test packages/review-app/tests/review-model.test.ts
```

Expected: PASS。

---

### Task 2: 后端 `unit-completed` 实时发送当前 unit diff

**Files:**
- Modify: `packages/review-backend/src/application/stream-review-session.ts`
- Test: `packages/review-backend/tests/stream-review-session.workspace.test.ts`

- [ ] **Step 1: 写失败测试**

在 `packages/review-backend/tests/stream-review-session.workspace.test.ts` 增加：

```ts
it("emits diff content with unit-completed events", async () => {
  const readWorkspaceDiff = vi.fn().mockResolvedValue([
    {
      path: "src/file.ts",
      isNew: false,
      isDeleted: false,
      isBinary: false,
      insertions: 1,
      deletions: 1,
      hunks: [
        {
          oldStart: 1,
          oldCount: 1,
          newStart: 1,
          newCount: 1,
          lines: [{ type: "added", content: "export const value = 2;" }]
        }
      ]
    }
  ]);

  const provider = {
    id: "mock",
    review: vi.fn().mockResolvedValue({
      content: JSON.stringify({
        findings: [
          {
            severity: "high",
            category: "bug",
            summary: "测试问题",
            explanation: "测试说明",
            file: "src/file.ts",
            startLine: 1,
            endLine: 1,
            confidenceSignals: []
          }
        ]
      })
    })
  };

  const unitCompletedEvents = [];

  for await (const event of streamReviewSession({
    input: {
      repositoryPath: "/repo",
      baseRef: "HEAD",
      targetRef: "WORKSPACE",
      contextBudgetTokens: 12000
    },
    dependencies: {
      provider,
      gitClient: {
        readDiff: vi.fn(),
        readWorkspaceDiff,
        readFileAtRef: vi
          .fn()
          .mockResolvedValueOnce("export const value = 1;\n")
          .mockResolvedValueOnce("export const value = 2;\n"),
        lsFiles: vi.fn().mockResolvedValue([]),
        grep: vi.fn().mockResolvedValue([])
      },
      sessionStore: {
        createSession: vi.fn().mockResolvedValue({ sessionId: "s_1" }),
        appendEvent: vi.fn().mockResolvedValue(undefined),
        completeSession: vi.fn().mockResolvedValue(undefined)
      }
    }
  })) {
    if (event.type === "unit-completed") {
      unitCompletedEvents.push(event);
    }
  }

  expect(unitCompletedEvents).toHaveLength(1);
  expect(unitCompletedEvents[0].diffByFile).toEqual({
    "src/file.ts": {
      original: "export const value = 1;\n",
      modified: "export const value = 2;\n"
    }
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
pnpm --filter @app/review-backend test packages/review-backend/tests/stream-review-session.workspace.test.ts
```

Expected: FAIL，`unitCompletedEvents[0].diffByFile` 为 `undefined`。

- [ ] **Step 3: 修改 `streamReviewSession` 事件构造**

在 `packages/review-backend/src/application/stream-review-session.ts` 的 `unitCompletedEvent` 中增加当前 unit diff：

```ts
const unitCompletedEvent = {
  type: "unit-completed" as const,
  sessionId: session.sessionId,
  unitId: unit.id,
  findingsCount: unitFindings.length,
  findings: unitFindings,
  diffByFile: {
    [unit.primaryFile]: diffByFile[unit.primaryFile]
  }
};
```

- [ ] **Step 4: 运行 Task 2 测试确认通过**

Run:

```bash
pnpm --filter @app/review-backend test packages/review-backend/tests/stream-review-session.workspace.test.ts
```

Expected: PASS。

---

### Task 3: 前端流式合并 findings 和 diff

**Files:**
- Modify: `packages/review-app/src/store/review-session-store.ts`
- Modify: `packages/review-app/src/hooks/use-review-session-stream.ts`
- Test: `packages/review-app/tests/use-review-session-stream.test.tsx`

- [ ] **Step 1: 写失败测试**

在 `packages/review-app/tests/use-review-session-stream.test.tsx` 增加：

```tsx
it("merges diff content from unit-completed events so streamed findings can show diff", async () => {
  let eventHandler: ((event: ReviewSessionEvent) => void) | undefined;

  window.reviewWorkbenchApi = {
    listRepositories: vi.fn(),
    selectRepository: vi.fn(),
    listBranches: vi.fn(),
    createSession: vi.fn(),
    getSession: vi.fn().mockResolvedValue({
      sessionId: "s_1",
      status: "running",
      repositoryPath: "/repo",
      baseRef: "main",
      targetRef: "feature",
      summary: {
        changedFilesCount: 1,
        findingsCount: 0,
        highSeverityCount: 0,
        files: ["src/file.ts"]
      },
      findings: [],
      diffByFile: {}
    }),
    listSessions: vi.fn(),
    deleteSession: vi.fn(),
    cancelSession: vi.fn(),
    exportSession: vi.fn(),
    subscribeSession: vi.fn().mockImplementation((_sessionId: string, handler: (event: ReviewSessionEvent) => void) => {
      eventHandler = handler;
      return vi.fn();
    })
  };

  renderHook(() => useReviewSessionStream("s_1"));

  await waitFor(() => {
    expect(useReviewSessionStore.getState().session?.sessionId).toBe("s_1");
  });

  eventHandler?.({
    type: "unit-completed",
    sessionId: "s_1",
    unitId: "unit:src/file.ts",
    findingsCount: 1,
    findings: [
      {
        id: "f_1",
        severity: "high",
        category: "bug",
        summary: "测试问题",
        explanation: "测试说明",
        file: "src/file.ts",
        startLine: 1,
        endLine: 1,
        confidenceSignals: [],
        status: "line-level"
      }
    ],
    diffByFile: {
      "src/file.ts": {
        original: "before\n",
        modified: "after\n"
      }
    }
  });

  expect(useReviewSessionStore.getState().session?.findings).toHaveLength(1);
  expect(useReviewSessionStore.getState().session?.diffByFile["src/file.ts"]?.modified).toBe("after\n");
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
pnpm --filter @app/review-app test packages/review-app/tests/use-review-session-stream.test.tsx
```

Expected: FAIL，`diffByFile["src/file.ts"]` 为 `undefined`。

- [ ] **Step 3: 修改 store 方法签名和实现**

在 `packages/review-app/src/store/review-session-store.ts` 中把类型改为：

```ts
addFindings(
  findings: ReviewFinding[],
  diffByFile?: ReviewSessionDetail["diffByFile"]
): void;
```

把实现改为：

```ts
addFindings: (findings, diffByFile = {}) =>
  set((state) => {
    if (!state.session) return state;
    return {
      session: {
        ...state.session,
        findings: [...state.session.findings, ...findings],
        diffByFile: {
          ...state.session.diffByFile,
          ...diffByFile
        },
        summary: {
          ...state.session.summary,
          findingsCount: state.session.summary.findingsCount + findings.length,
          highSeverityCount:
            state.session.summary.highSeverityCount +
            findings.filter((f) => f.severity === "high").length
        }
      }
    };
  }),
```

- [ ] **Step 4: 修改流式 hook**

在 `packages/review-app/src/hooks/use-review-session-stream.ts` 中把 `unit-completed` 分支改为：

```ts
case "unit-completed":
  addFindings(event.findings, event.diffByFile);
  break;
```

- [ ] **Step 5: 运行 Task 3 测试确认通过**

Run:

```bash
pnpm --filter @app/review-app test packages/review-app/tests/use-review-session-stream.test.tsx
```

Expected: PASS。

---

### Task 4: 归一化 tool calling 返回的 finding 文件路径

**Files:**
- Modify: `packages/review-backend/src/application/stream-review-session.ts`
- Test: `packages/review-backend/tests/stream-review-session.workspace.test.ts`

- [ ] **Step 1: 写失败测试**

在 `packages/review-backend/tests/stream-review-session.workspace.test.ts` 增加：

```ts
it("normalizes streamed finding file paths to match diff keys", async () => {
  const readWorkspaceDiff = vi.fn().mockResolvedValue([
    {
      path: "src/file.ts",
      isNew: false,
      isDeleted: false,
      isBinary: false,
      insertions: 1,
      deletions: 0,
      hunks: [
        {
          oldStart: 1,
          oldCount: 1,
          newStart: 1,
          newCount: 1,
          lines: [{ type: "added", content: "export const value = 2;" }]
        }
      ]
    }
  ]);

  const provider = {
    id: "mock",
    chat: vi
      .fn()
      .mockResolvedValueOnce({
        content: null,
        toolCalls: [
          {
            id: "call_1",
            name: "code_comment",
            arguments: {
              file: "./src/file.ts",
              start_line: 1,
              end_line: 1,
              severity: "high",
              category: "bug",
              summary: "测试问题",
              explanation: "测试说明"
            }
          },
          {
            id: "call_2",
            name: "task_done",
            arguments: {}
          }
        ]
      })
  };

  const completed = [];

  for await (const event of streamReviewSession({
    input: {
      repositoryPath: "/repo",
      baseRef: "HEAD",
      targetRef: "WORKSPACE",
      contextBudgetTokens: 12000
    },
    dependencies: {
      provider,
      gitClient: {
        readDiff: vi.fn(),
        readWorkspaceDiff,
        readFileAtRef: vi
          .fn()
          .mockResolvedValueOnce("export const value = 1;\n")
          .mockResolvedValueOnce("export const value = 2;\n"),
        lsFiles: vi.fn().mockResolvedValue([]),
        grep: vi.fn().mockResolvedValue([])
      },
      sessionStore: {
        createSession: vi.fn().mockResolvedValue({ sessionId: "s_1" }),
        appendEvent: vi.fn().mockResolvedValue(undefined),
        completeSession: vi.fn().mockResolvedValue(undefined)
      }
    }
  })) {
    if (event.type === "unit-completed") {
      completed.push(event);
    }
  }

  expect(completed[0].findings[0]?.file).toBe("src/file.ts");
  expect(completed[0].diffByFile[completed[0].findings[0]!.file]?.modified).toContain("value = 2");
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
pnpm --filter @app/review-backend test packages/review-backend/tests/stream-review-session.workspace.test.ts
```

Expected: FAIL，finding.file 为 `./src/file.ts`，无法直接命中 `diffByFile["src/file.ts"]`。

- [ ] **Step 3: 增加路径归一化 helper**

在 `packages/review-backend/src/application/stream-review-session.ts` 文件底部增加：

```ts
function normalizeFindingFiles(input: {
  findings: ReviewFinding[];
  primaryFile: string;
  diffFiles: ParsedDiffFile[];
  repositoryPath: string;
}): ReviewFinding[] {
  const knownFiles = new Set(input.diffFiles.map((file) => file.path));

  return input.findings.map((finding) => {
    const normalized = normalizeFindingFile({
      file: finding.file,
      primaryFile: input.primaryFile,
      repositoryPath: input.repositoryPath,
      knownFiles
    });

    return normalized === finding.file ? finding : { ...finding, file: normalized };
  });
}

function normalizeFindingFile(input: {
  file: string;
  primaryFile: string;
  repositoryPath: string;
  knownFiles: Set<string>;
}): string {
  const candidates = [
    input.file,
    input.file.replace(/^\.\//, ""),
    input.file.startsWith(`${input.repositoryPath}/`)
      ? input.file.slice(input.repositoryPath.length + 1)
      : input.file
  ];

  for (const candidate of candidates) {
    const clean = candidate.replace(/^\.\//, "");
    if (input.knownFiles.has(clean)) {
      return clean;
    }
  }

  if (!input.file || !input.knownFiles.has(input.file)) {
    return input.primaryFile;
  }

  return input.file;
}
```

- [ ] **Step 4: 在 relocation 前调用归一化**

在 `streamReviewSession` 中，`unitFindings` 赋值完成后、`Relocate findings without line numbers` 之前插入：

```ts
unitFindings = normalizeFindingFiles({
  findings: unitFindings,
  primaryFile: unit.primaryFile,
  diffFiles,
  repositoryPath
});
```

- [ ] **Step 5: 运行 Task 4 测试确认通过**

Run:

```bash
pnpm --filter @app/review-backend test packages/review-backend/tests/stream-review-session.workspace.test.ts
```

Expected: PASS。

---

### Task 5: 回归验证和收尾

**Files:**
- No source file changes beyond Tasks 1-4.

- [ ] **Step 1: 运行后端相关测试**

Run:

```bash
pnpm --filter @app/review-backend test packages/review-backend/tests/review-session-types.test.ts packages/review-backend/tests/stream-review-session.workspace.test.ts
```

Expected: PASS。

- [ ] **Step 2: 运行前端相关测试**

Run:

```bash
pnpm --filter @app/review-app test packages/review-app/tests/review-model.test.ts packages/review-app/tests/use-review-session-stream.test.tsx
```

Expected: PASS。

- [ ] **Step 3: 运行类型检查**

Run:

```bash
pnpm typecheck
```

Expected: PASS。

- [ ] **Step 4: 运行全量测试**

Run:

```bash
pnpm test
```

Expected: PASS。

- [ ] **Step 5: 手动验证运行中 diff**

Run:

```bash
pnpm --filter @app/review-app build
```

Expected: PASS。

然后启动 Electron 开发流程，发起一次本地仓库审查。观察到第一个 finding 卡片出现后，点击该卡片，右侧 diff 面板应立即显示对应文件内容，不需要等待 `session-finished`。

---

## Self-Review

**Spec coverage:** 计划覆盖实时事件 contract、后端事件发送、前端状态合并、路径归一化和回归验证，能直接解决“已输出 findings 无法查看 diff”的根因。

**Placeholder scan:** 无 `TBD`、`TODO`、`implement later` 或“写对应测试”这类占位步骤；每个代码修改步骤都给出明确片段。

**Type consistency:** 后端和前端事件字段统一使用 `diffByFile: Record<string, { original: string; modified: string }>`；store 方法使用 `ReviewSessionDetail["diffByFile"]`，避免重复定义漂移。
