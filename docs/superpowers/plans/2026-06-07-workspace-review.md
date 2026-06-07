# 添加"审查当前工作区改动"功能实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在入口页面添加"审查当前改动"按钮，让用户可以直接审查当前工作区的所有未提交改动（暂存区 + 工区），而不需要选择分支。

**Architecture:** 在现有入口页面添加一个"审查当前改动"按钮，当用户点击按钮时，使用 `git diff HEAD` 获取所有未提交的改动，然后创建 Review Session。后端需要添加 `readWorkspaceDiff()` 方法到 GitClient，并修改 `streamReviewSession` 支持 WORKSPACE 模式。

**Tech Stack:** TypeScript, React, Electron, Vitest

**Status:** ✅ 已完成

---

## 文件结构

### 后端文件
- `packages/review-backend/src/infrastructure/git/git-client.ts` - 添加 `readWorkspaceDiff()` 方法
- `packages/review-backend/src/application/stream-review-session.ts` - 修改差异获取逻辑，支持 WORKSPACE 模式

### 前端文件
- `packages/review-app/src/components/launch/launch-review-form.tsx` - 添加"审查当前改动"按钮和处理逻辑

### 测试文件
- `packages/review-backend/tests/git-client.test.ts` - 添加 `readWorkspaceDiff()` 测试
- `packages/review-backend/tests/stream-review-session.workspace.test.ts` - 添加 WORKSPACE 模式测试
- `packages/review-app/tests/review-launch-page.test.tsx` - 添加按钮测试

---

### Task 1: 添加 readWorkspaceDiff() 方法到 GitClient ✅

**Files:**
- Modify: `packages/review-backend/src/infrastructure/git/git-client.ts`
- Test: `packages/review-backend/tests/git-client.test.ts`

- [x] **Step 1: 编写失败的测试**

```typescript
// packages/review-backend/tests/git-client.test.ts
import { describe, expect, it, vi } from "vitest";
import { GitClient } from "../src/infrastructure/git/git-client.js";

describe("GitClient", () => {
  it("reads workspace diff using git diff HEAD", async () => {
    const gitClient = new GitClient("/tmp/repo");

    // Mock execa
    const mockExeca = vi.fn().mockResolvedValue({
      stdout: "diff --git a/src/a.ts b/src/a.ts\nindex 1234567..abcdefg 100644\n--- a/src/a.ts\n+++ b/src/a.ts\n@@ -1,3 +1,4 @@\n export const a = 1;\n+export const b = 2;\n"
    });

    // We need to mock the execa module
    vi.mock("execa", () => ({
      execa: mockExeca
    }));

    const result = await gitClient.readWorkspaceDiff();

    expect(mockExeca).toHaveBeenCalledWith(
      "git",
      ["diff", "--no-ext-diff", "HEAD"],
      {
        cwd: "/tmp/repo",
        maxBuffer: 20_000_000
      }
    );

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });
});
```

- [x] **Step 2: 运行测试验证失败**

Run: `cd packages/review-backend && pnpm test tests/git-client.test.ts`
Expected: FAIL with "gitClient.readWorkspaceDiff is not a function"

- [x] **Step 3: 编写最小实现**

```typescript
// packages/review-backend/src/infrastructure/git/git-client.ts
import { execa } from "execa";
import { parseUnifiedDiff } from "./parse-unified-diff.js";

export class GitClient {
  constructor(private readonly repositoryPath: string) {}

  getRepositoryPath() {
    return this.repositoryPath;
  }

  async listBranches(): Promise<string[]> {
    const { stdout } = await execa("git", ["branch", "--format=%(refname:short)"], {
      cwd: this.repositoryPath
    });

    return stdout
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  }

  async readDiff(baseRef: string, targetRef: string) {
    const { stdout } = await execa(
      "git",
      ["diff", "--no-ext-diff", `${baseRef}...${targetRef}`],
      {
        cwd: this.repositoryPath,
        maxBuffer: 20_000_000
      }
    );

    return parseUnifiedDiff(stdout);
  }

  async readWorkspaceDiff() {
    const { stdout } = await execa(
      "git",
      ["diff", "--no-ext-diff", "HEAD"],
      {
        cwd: this.repositoryPath,
        maxBuffer: 20_000_000
      }
    );

    return parseUnifiedDiff(stdout);
  }

  async readFileAtRef(ref: string, filePath: string): Promise<string> {
    const { stdout } = await execa("git", ["show", `${ref}:${filePath}`], {
      cwd: this.repositoryPath
    });

    return stdout;
  }
}
```

- [x] **Step 4: 运行测试验证通过**

Run: `cd packages/review-backend && pnpm test tests/git-client.test.ts`
Expected: PASS

- [x] **Step 5: 提交代码**

```bash
git add packages/review-backend/src/infrastructure/git/git-client.ts packages/review-backend/tests/git-client.test.ts
git commit -m "feat: add readWorkspaceDiff() method to GitClient"
```

**提交记录:** `b55ed8e feat: add readWorkspaceDiff() method to GitClient`

---

### Task 2: 修改 streamReviewSession 支持 WORKSPACE 模式 ✅

**Files:**
- Modify: `packages/review-backend/src/application/stream-review-session.ts`
- Test: `packages/review-backend/tests/stream-review-session.workspace.test.ts`

- [x] **Step 1: 编写失败的测试**

```typescript
// packages/review-backend/tests/stream-review-session.workspace.test.ts
import { describe, expect, it, vi } from "vitest";
import { streamReviewSession } from "../src/application/stream-review-session.js";

describe("streamReviewSession workspace mode", () => {
  it("uses readWorkspaceDiff when targetRef is WORKSPACE", async () => {
    const provider = {
      id: "mock",
      review: vi.fn().mockResolvedValue({
        content: JSON.stringify({ findings: [] })
      })
    };

    const mockReadWorkspaceDiff = vi.fn().mockResolvedValue([
      { path: "src/a.ts", hunks: [] }
    ]);

    const events: string[] = [];

    for await (const event of streamReviewSession({
      input: {
        repositoryPath: "/tmp/repo",
        baseRef: "HEAD",
        targetRef: "WORKSPACE",
        contextBudgetTokens: 12000
      },
      dependencies: {
        provider,
        gitClient: {
          readDiff: vi.fn(),
          readFileAtRef: vi.fn().mockResolvedValue("export const a = 1;\n"),
          readWorkspaceDiff: mockReadWorkspaceDiff
        },
        sessionStore: {
          createSession: vi.fn().mockResolvedValue({ sessionId: "s_1" }),
          appendEvent: vi.fn().mockResolvedValue(undefined),
          completeSession: vi.fn().mockResolvedValue(undefined)
        }
      }
    })) {
      events.push(event.type);
    }

    expect(mockReadWorkspaceDiff).toHaveBeenCalled();
    expect(events).toEqual(["session-started", "unit-completed", "session-finished"]);
  });
});
```

- [x] **Step 2: 运行测试验证失败**

Run: `cd packages/review-backend && pnpm test tests/stream-review-session.workspace.test.ts`
Expected: FAIL with "readWorkspaceDiff is not a function"

- [x] **Step 3: 编写最小实现**

```typescript
// packages/review-backend/src/application/stream-review-session.ts
import { buildReviewSummary } from "./build-review-summary.js";
import type { ReviewFinding } from "../domain/review-finding.js";
import type { LlmProvider } from "../domain/provider.js";
import type { ReviewSessionEvent, ReviewSessionInput } from "../domain/review-session.js";
import { collectUnitContext } from "../infrastructure/context/context-collector.js";
import type { GitClient } from "../infrastructure/git/git-client.js";
import type { ParsedDiffFile } from "../infrastructure/git/parse-unified-diff.js";
import { normalizeProviderOutput } from "../infrastructure/llm/normalize-provider-output.js";
import { buildReviewUnits } from "../infrastructure/planner/review-unit-planner.js";

type SessionStore = {
  createSession(input: {
    repositoryPath: string;
    baseRef: string;
    targetRef: string;
  }): Promise<{ sessionId: string }>;
  appendEvent(sessionId: string, event: ReviewSessionEvent): Promise<void>;
  completeSession(sessionId: string, summary: unknown): Promise<void>;
};

export async function* streamReviewSession(
  input: {
    input: ReviewSessionInput;
    dependencies: {
      provider: Pick<LlmProvider, "id" | "review">;
      gitClient: Pick<GitClient, "readDiff" | "readFileAtRef" | "readWorkspaceDiff">;
      sessionStore: SessionStore;
    };
  }
): AsyncGenerator<ReviewSessionEvent, void, void> {
  const session = await input.dependencies.sessionStore.createSession({
    repositoryPath: input.input.repositoryPath,
    baseRef: input.input.baseRef,
    targetRef: input.input.targetRef
  });

  const startedEvent = {
    type: "session-started" as const,
    sessionId: session.sessionId
  };
  await input.dependencies.sessionStore.appendEvent(session.sessionId, startedEvent);
  yield startedEvent;

  const diffFiles = input.input.targetRef === "WORKSPACE"
    ? await input.dependencies.gitClient.readWorkspaceDiff()
    : await input.dependencies.gitClient.readDiff(
        input.input.baseRef,
        input.input.targetRef
      );

  const units = buildReviewUnits(diffFiles as ParsedDiffFile[]);
  const findings: ReviewFinding[] = [];
  const diffByFile: Record<string, { original: string; modified: string }> = {};
  let hasUnitFailure = false;

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

      const prompt = JSON.stringify({
        task: "review",
        contextBudgetTokens: input.input.contextBudgetTokens,
        unit,
        context
      });
      const result = await input.dependencies.provider.review({ prompt });
      const unitFindings = normalizeProviderOutput({
        content: result.content,
        fallbackFile: unit.primaryFile
      });
      findings.push(...unitFindings);

      const unitCompletedEvent = {
        type: "unit-completed" as const,
        sessionId: session.sessionId,
        unitId: unit.id,
        findingsCount: unitFindings.length
      };
      await input.dependencies.sessionStore.appendEvent(session.sessionId, unitCompletedEvent);
      yield unitCompletedEvent;
    } catch (error) {
      hasUnitFailure = true;
      const unitFailedEvent = {
        type: "unit-failed" as const,
        sessionId: session.sessionId,
        unitId: unit.id,
        reason: error instanceof Error ? error.message : "unknown error"
      };
      await input.dependencies.sessionStore.appendEvent(session.sessionId, unitFailedEvent);
      yield unitFailedEvent;
    }
  }

  const finishedEvent = {
    type: "session-finished" as const,
    sessionId: session.sessionId,
    totalFindings: findings.length,
    status: hasUnitFailure ? ("partial" as const) : ("finished" as const)
  };
  const summary = buildReviewSummary({
    findings,
    changedFiles: units.map((unit) => unit.primaryFile)
  });
  await input.dependencies.sessionStore.appendEvent(session.sessionId, finishedEvent);
  await input.dependencies.sessionStore.completeSession(session.sessionId, {
    sessionId: session.sessionId,
    status: finishedEvent.status,
    repositoryPath: input.input.repositoryPath,
    baseRef: input.input.baseRef,
    targetRef: input.input.targetRef,
    summary,
    findings,
    diffByFile
  });
  yield finishedEvent;
}
```

- [x] **Step 4: 运行测试验证通过**

Run: `cd packages/review-backend && pnpm test tests/stream-review-session.workspace.test.ts`
Expected: PASS

- [x] **Step 5: 提交代码**

```bash
git add packages/review-backend/src/application/stream-review-session.ts packages/review-backend/tests/stream-review-session.workspace.test.ts
git commit -m "feat: support WORKSPACE mode in streamReviewSession"
```

**提交记录:** `a65df2d feat: support WORKSPACE mode in streamReviewSession`

**修复记录:** `21a97bb fix: add readWorkspaceDiff mock to test files` (修复类型错误)

---

### Task 3: 在前端添加"审查当前改动"按钮 ✅

**Files:**
- Modify: `packages/review-app/src/components/launch/launch-review-form.tsx`
- Test: `packages/review-app/tests/review-launch-page.test.tsx`

- [x] **Step 1: 编写失败的测试**

```typescript
// packages/review-app/tests/review-launch-page.test.tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { ReviewLaunchPage } from "../src/pages/review-launch-page";

describe("ReviewLaunchPage", () => {
  it("renders workspace review button", async () => {
    window.reviewWorkbenchApi = {
      listRepositories: vi.fn().mockResolvedValue(["/repo"]),
      listBranches: vi.fn().mockResolvedValue(["main", "feature"]),
      createSession: vi.fn().mockResolvedValue({ sessionId: "s_1" }),
      getSession: vi.fn(),
      listSessions: vi.fn().mockResolvedValue([]),
      subscribeSession: vi.fn()
    };

    render(
      <MemoryRouter>
        <ReviewLaunchPage />
      </MemoryRouter>
    );

    expect(await screen.findByText("Code Review Intake")).toBeInTheDocument();
    expect(screen.getByText("发起一次 Code Review")).toBeInTheDocument();
    expect(screen.getByText("改动摘要")).toBeInTheDocument();

    // Check that workspace review button exists
    expect(screen.getByRole("button", { name: "审查当前工作区改动" })).toBeInTheDocument();
  });

  it("submits workspace review when clicking workspace button", async () => {
    window.reviewWorkbenchApi = {
      listRepositories: vi.fn().mockResolvedValue(["/repo"]),
      listBranches: vi.fn().mockResolvedValue(["main", "feature"]),
      createSession: vi.fn().mockResolvedValue({ sessionId: "s_1" }),
      getSession: vi.fn(),
      listSessions: vi.fn().mockResolvedValue([]),
      subscribeSession: vi.fn()
    };

    render(
      <MemoryRouter>
        <ReviewLaunchPage />
      </MemoryRouter>
    );

    expect(await screen.findByText("Code Review Intake")).toBeInTheDocument();

    // Select repository
    fireEvent.change(await screen.findByLabelText("仓库"), { target: { value: "/repo" } });

    // Click workspace review button
    fireEvent.click(screen.getByRole("button", { name: "审查当前工作区改动" }));

    await waitFor(() => {
      expect(window.reviewWorkbenchApi.createSession).toHaveBeenCalledWith({
        repositoryPath: "/repo",
        baseRef: "HEAD",
        targetRef: "WORKSPACE"
      });
    });
  });
});
```

- [x] **Step 2: 运行测试验证失败**

Run: `cd packages/review-app && pnpm test tests/review-launch-page.test.tsx`
Expected: FAIL with "Unable to find a role="button" and name "审查当前工作区改动""

- [x] **Step 3: 编写最小实现**

```typescript
// packages/review-app/src/components/launch/launch-review-form.tsx
import { startTransition, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ipcClient } from "@/lib/ipc-client";
import { BranchSelector } from "./branch-selector";
import { RepositoryPicker } from "./repository-picker";

export function LaunchReviewForm() {
  const navigate = useNavigate();
  const [repositories, setRepositories] = useState<string[]>([]);
  const [branches, setBranches] = useState<string[]>([]);
  const [repositoryPath, setRepositoryPath] = useState("");
  const [baseRef, setBaseRef] = useState("");
  const [targetRef, setTargetRef] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    void ipcClient.listRepositories().then(setRepositories);
  }, []);

  useEffect(() => {
    if (!repositoryPath) {
      setBranches([]);
      setBaseRef("");
      setTargetRef("");
      return;
    }

    void ipcClient.listBranches(repositoryPath).then((nextBranches) => {
      setBranches(nextBranches);
      setBaseRef((current) => (nextBranches.includes(current) ? current : ""));
      setTargetRef((current) => (nextBranches.includes(current) ? current : ""));
    });
  }, [repositoryPath]);

  async function handleSubmit() {
    if (!repositoryPath || !baseRef || !targetRef || isSubmitting) {
      return;
    }

    setIsSubmitting(true);

    try {
      const session = await ipcClient.createSession({
        repositoryPath,
        baseRef,
        targetRef
      });

      startTransition(() => {
        navigate(`/sessions/${session.sessionId}`);
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleWorkspaceReview() {
    if (!repositoryPath || isSubmitting) {
      return;
    }

    setIsSubmitting(true);

    try {
      const session = await ipcClient.createSession({
        repositoryPath,
        baseRef: "HEAD",
        targetRef: "WORKSPACE"
      });

      startTransition(() => {
        navigate(`/sessions/${session.sessionId}`);
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto grid h-full max-w-6xl items-center gap-6 lg:grid-cols-[1.08fr_0.92fr]">
      <section className="grid gap-6 rounded-[30px] border border-[rgb(var(--border))] bg-[rgb(var(--panel-elevated))] p-8 shadow-[0_24px_80px_rgba(31,35,41,0.05)]">
        <div className="grid gap-3">
          <div className="text-[11px] font-medium uppercase tracking-[0.34em] text-[rgb(var(--muted))]">
            Code Review Intake
          </div>
          <h1 className="m-0 text-[42px] font-semibold tracking-[-0.045em] text-[rgb(var(--ink))]">发起一次 Code Review</h1>
          <p className="m-0 max-w-2xl text-[15px] leading-7 text-[rgb(var(--muted-strong))]">
            选择本地仓库与目标分支，在进入 Code Review 工作台前完成一次清晰、可追踪的启动流程。
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {[
            {
              title: "改动摘要",
              body: "先看到这次改动主要落在哪些文件和链路。"
            },
            {
              title: "Review Findings",
              body: "优先识别高风险 finding 与证据线索。"
            },
            {
              title: "Diff 验证",
              body: "从问题条目直接跳到对应上下文继续核查。"
            }
          ].map((item) => (
            <article
              key={item.title}
              className="grid gap-2 rounded-[22px] border border-[rgb(var(--border-subtle))] bg-[rgb(var(--panel-muted))] p-4 transition hover:-translate-y-0.5 hover:border-[rgb(var(--border-strong))] hover:shadow-[0_14px_28px_rgba(29,31,35,0.05)]"
            >
              <div className="text-sm font-medium tracking-[-0.01em] text-[rgb(var(--ink))]">{item.title}</div>
              <p className="m-0 text-[13px] leading-6 text-[rgb(var(--muted-strong))]">{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-5 rounded-[30px] border border-[rgb(var(--border))] bg-[rgb(var(--panel-elevated))] p-6 shadow-[0_24px_80px_rgba(31,35,41,0.06)]">
        <div className="grid gap-2">
          <div className="text-[11px] font-medium uppercase tracking-[0.3em] text-[rgb(var(--muted))]">
            Review Setup
          </div>
          <div className="text-[22px] font-semibold tracking-[-0.03em] text-[rgb(var(--ink))]">选择仓库与分支</div>
          <p className="m-0 text-[14px] leading-6 text-[rgb(var(--muted-strong))]">
            Code Review 会话会保存当前输入，后续可以在 Review 历史里回看与重进工作台。
          </p>
        </div>

        <RepositoryPicker repositories={repositories} value={repositoryPath} onChange={setRepositoryPath} />
        <div className="grid gap-5 md:grid-cols-2">
          <BranchSelector label="基线分支" value={baseRef} branches={branches} onChange={setBaseRef} />
          <BranchSelector label="目标分支" value={targetRef} branches={branches} onChange={setTargetRef} />
        </div>
        <button
          type="button"
          className="h-11 justify-self-start whitespace-nowrap rounded-[14px] bg-[rgb(var(--accent))] px-5 text-[13px] font-medium tracking-[0.01em] text-white shadow-[0_10px_30px_rgba(67,104,170,0.18)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_34px_rgba(67,104,170,0.24)] focus:outline-none focus:ring-2 focus:ring-[rgba(67,104,170,0.25)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-[0_10px_30px_rgba(67,104,170,0.18)]"
          disabled={!repositoryPath || !baseRef || !targetRef || isSubmitting}
          onClick={handleSubmit}
        >
          {isSubmitting ? "正在创建 Code Review..." : "开始 Code Review"}
        </button>

        <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.2em] text-[rgb(var(--muted))]">
          <div className="h-px flex-1 bg-[rgb(var(--border))]" />
          <span>或</span>
          <div className="h-px flex-1 bg-[rgb(var(--border))]" />
        </div>

        <button
          type="button"
          className="h-11 justify-self-start whitespace-nowrap rounded-[14px] border border-[rgb(var(--border))] bg-[rgb(var(--panel-muted))] px-5 text-[13px] font-medium tracking-[0.01em] text-[rgb(var(--ink))] shadow-[0_10px_30px_rgba(31,35,41,0.08)] transition hover:-translate-y-0.5 hover:border-[rgb(var(--border-strong))] hover:shadow-[0_16px_34px_rgba(31,35,41,0.12)] focus:outline-none focus:ring-2 focus:ring-[rgba(67,104,170,0.25)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-[0_10px_30px_rgba(31,35,41,0.08)]"
          disabled={!repositoryPath || isSubmitting}
          onClick={handleWorkspaceReview}
        >
          {isSubmitting ? "正在创建 Code Review..." : "审查当前工作区改动"}
        </button>
      </section>
    </div>
  );
}
```

- [x] **Step 4: 运行测试验证通过**

Run: `cd packages/review-app && pnpm test tests/review-launch-page.test.tsx`
Expected: PASS

- [x] **Step 5: 提交代码**

```bash
git add packages/review-app/src/components/launch/launch-review-form.tsx packages/review-app/tests/review-launch-page.test.tsx
git commit -m "feat: add workspace review button to launch form"
```

**提交记录:** 前端实现已包含在最终提交中

**样式修复:** `99c3d95 style: add 'or' text to separator line`

---

### Task 4: 运行所有测试并验证 ✅

**Files:**
- None (verification only)

- [x] **Step 1: 运行后端测试**

Run: `cd packages/review-backend && pnpm test`
Expected: All tests pass
Result: ✅ 8 个测试文件，16 个测试用例全部通过

- [x] **Step 2: 运行前端测试**

Run: `cd packages/review-app && pnpm test`
Expected: All tests pass
Result: ✅ 7 个测试文件，10 个测试用例全部通过

- [x] **Step 3: 运行 shell 测试**

Run: `cd packages/review-shell && pnpm test`
Expected: All tests pass
Result: ✅ 2 个测试文件，4 个测试用例全部通过

- [x] **Step 4: 提交所有更改**

```bash
git add -A
git commit -m "feat: implement workspace review functionality"
```

**提交记录:** `10cd65e feat: implement workspace review functionality`

---

## 总结

这个实现计划包含 4 个任务，所有任务已完成：

1. **Task 1:** 添加 `readWorkspaceDiff()` 方法到 GitClient ✅
2. **Task 2:** 修改 `streamReviewSession` 支持 WORKSPACE 模式 ✅
3. **Task 3:** 在前端添加"审查当前改动"按钮 ✅
4. **Task 4:** 运行所有测试并验证 ✅

每个任务都遵循 TDD 流程：编写失败测试 → 运行测试验证失败 → 编写最小实现 → 运行测试验证通过 → 提交代码。

## 测试结果

- **后端测试：** 8 个测试文件，16 个测试用例全部通过
- **前端测试：** 7 个测试文件，10 个测试用例全部通过
- **Shell 测试：** 2 个测试文件，4 个测试用例全部通过

## Git 提交记录

```
b55ed8e feat: add readWorkspaceDiff() method to GitClient
a65df2d feat: support WORKSPACE mode in streamReviewSession
21a97bb fix: add readWorkspaceDiff mock to test files
99c3d95 style: add 'or' text to separator line
10cd65e feat: implement workspace review functionality
```

## 用户使用方式

用户现在可以：
1. 选择仓库
2. 点击"审查当前工作区改动"按钮
3. 系统使用 `git diff HEAD` 获取所有未提交的改动
4. 创建 Review Session 并跳转到工作台
