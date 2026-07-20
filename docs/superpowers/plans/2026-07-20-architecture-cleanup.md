# 架构清理实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 消除 6 项架构设计冗余：Schema 前后端重复、LlmProvider 接口冗余、ReviewUnit 空抽象、过滤配置不一致、stream-review-session 职责过多、barrel export 泄露内部实现。

**Architecture:** 按依赖顺序执行：先清理 barrel export（Task 1），再消除 Schema 重复（Task 2），然后合并 Provider 接口（Task 3）、移除空抽象（Task 4）、修复配置引用（Task 5），最后拆分大函数（Task 6）。每个 Task 独立可验证，全部完成后运行 `pnpm typecheck && pnpm test` 确认无回归。

**Tech Stack:** TypeScript 5 strict, Zod, Vitest, pnpm workspace

## Global Constraints

- 所有测试必须通过：`pnpm test`
- TypeScript 类型检查必须通过：`pnpm typecheck`
- 不修改任何测试的断言逻辑，只调整导入路径
- 不引入新依赖
- 每个 Task 结束时独立可编译、可测试

---

### Task 1: 清理 Barrel Export

**目标:** `review-backend/src/index.ts` 不再导出 infrastructure 内部实现，只暴露 domain 类型和 application 函数。为 Task 2（前端导入后端 schema）做准备。

**Files:**
- Modify: `packages/review-backend/src/index.ts`
- Modify: `packages/review-shell/src/main.ts`
- Modify: `packages/review-shell/src/ipc/review-workbench-handlers.ts`
- Modify: `packages/review-backend/package.json`（添加 subpath export）

**Interfaces:**
- 消费：当前 `index.ts` 的所有 export
- 生产：新的 export 结构 — 主入口只导出 domain + application，infrastructure 通过 subpath 导出

- [ ] **Step 1: 确认当前 barrel export 的消费方**

运行以下命令确认哪些文件从 `@app/review-backend` 导入：

```bash
grep -r "from.*@app/review-backend" packages/review-shell/src/ --include="*.ts"
```

预期输出：
```
packages/review-shell/src/main.ts: import { FileSessionStore, GitClient, OpenAiCompatibleProvider, ... } from "@app/review-backend";
packages/review-shell/src/ipc/review-workbench-handlers.ts: import { createReviewSessionRequestSchema } from "@app/review-backend";
```

- [ ] **Step 2: 修改 `index.ts` — 移除 infrastructure 导出**

将 `packages/review-backend/src/index.ts` 修改为：

```typescript
// Application layer
export * from "./application/stream-review-session.js";
export * from "./application/build-review-summary.js";
export * from "./application/start-review-session.js";
export * from "./application/get-review-session.js";
export * from "./application/list-review-sessions.js";

// Contracts
export * from "./contracts/ipc.js";

// Domain types
export * from "./domain/provider.js";
export * from "./domain/review-finding.js";
export * from "./domain/review-session.js";
export * from "./domain/review-unit.js";
export * from "./domain/tool.js";
export * from "./domain/review-plan.js";
export * from "./domain/review-rules.js";

export const backendVersion = "0.1.0";

if (process.env.NODE_ENV !== "test") {
  console.log(`[review-backend] ${backendVersion}`);
}
```

- [ ] **Step 3: 添加 infrastructure subpath export**

修改 `packages/review-backend/package.json`，添加 `./infrastructure` subpath：

```json
{
  "name": "@app/review-backend",
  "private": true,
  "type": "module",
  "main": "dist/src/index.js",
  "types": "dist/src/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/src/index.d.ts",
      "default": "./dist/src/index.js"
    },
    "./infrastructure": {
      "types": "./dist/src/infrastructure/index.d.ts",
      "default": "./dist/src/infrastructure/index.js"
    }
  },
  "scripts": {
    "build": "tsc -b",
    "test": "vitest run",
    "dev": "tsx src/index.ts"
  },
  "dependencies": {
    "execa": "^9.6.0",
    "pino": "^9.3.2",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/node": "^22.13.10",
    "tsx": "^4.19.4",
    "typescript": "^5.8.3",
    "vitest": "^3.1.4"
  }
}
```

创建 `packages/review-backend/src/infrastructure/index.ts`：

```typescript
export * from "./context/context-collector.js";
export * from "./filter/file-filter.js";
export * from "./git/git-client.js";
export * from "./git/parse-unified-diff.js";
export * from "./llm/normalize-provider-output.js";
export * from "./llm/openai-compatible-provider.js";
export * from "./llm/line-relocator.js";
export * from "./llm/plan-generator.js";
export * from "./llm/tool-use-loop.js";
export * from "./llm/tool-executors.js";
export * from "./logging/logger.js";
export * from "./planner/review-unit-planner.js";
export * from "./storage/file-session-store.js";
export * from "./storage/paths.js";
```

- [ ] **Step 4: 更新 review-shell 的导入**

修改 `packages/review-shell/src/main.ts` 第 1-11 行：

```typescript
import { app, BrowserWindow, dialog, ipcMain } from "electron";
import { join } from "node:path";
import {
  getReviewSession,
  listReviewSessions,
  streamReviewSession
} from "@app/review-backend";
import {
  FileSessionStore,
  GitClient,
  OpenAiCompatibleProvider,
  resolveSessionsRoot
} from "@app/review-backend/infrastructure";
import { createReviewWorkbenchHandlers } from "./ipc/review-workbench-handlers.js";
import { getRendererFilePath } from "./paths.js";
import { getPreloadFilename } from "./runtime-config.js";
```

`review-workbench-handlers.ts` 的导入不变（`createReviewSessionRequestSchema` 来自 contracts，仍从主入口导出）。

- [ ] **Step 5: 运行类型检查**

```bash
pnpm typecheck
```

预期：通过，无错误。

- [ ] **Step 6: 运行全部测试**

```bash
pnpm test
```

预期：所有测试通过。

- [ ] **Step 7: 提交**

```bash
git add packages/review-backend/src/index.ts packages/review-backend/src/infrastructure/index.ts packages/review-backend/package.json packages/review-shell/src/main.ts
git commit -m "refactor(backend): clean barrel export, add infrastructure subpath"
```

---

### Task 2: 消除前端 Schema 重复

**目标:** 前端不再自行定义 `reviewFindingSchema`、`reviewSessionDetailSchema`、`ReviewSessionEvent` 等类型，统一从 `@app/review-backend` 导入。消除验证严格度不一致的风险。

**Files:**
- Modify: `packages/review-app/package.json`（添加 workspace 依赖）
- Modify: `packages/review-app/vite.config.ts`（添加 alias）
- Modify: `packages/review-app/tsconfig.json`（添加 path mapping）
- Modify: `packages/review-app/src/lib/review-model.ts`
- Modify: `packages/review-app/src/lib/ipc-client.ts`

**Interfaces:**
- 消费：`@app/review-backend` 导出的 `reviewFindingSchema`、`reviewSessionEventSchema`、`reviewSessionDetailSchema`、`reviewSessionInputSchema`
- 生产：前端 `review-model.ts` 保留 `SessionSummary` schema（后端无对应物）和 re-export 的类型

- [ ] **Step 1: 添加 workspace 依赖**

修改 `packages/review-app/package.json`，在 `dependencies` 中添加：

```json
{
  "dependencies": {
    "@app/review-backend": "workspace:*",
    ...existing deps...
  }
}
```

- [ ] **Step 2: 配置 Vite alias**

修改 `packages/review-app/vite.config.ts`：

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  base: "./",
  plugins: [react()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
      "@app/review-backend": resolve(__dirname, "../review-backend/src/index.ts")
    }
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    exclude: ["tests/app.e2e.spec.ts"]
  }
});
```

- [ ] **Step 3: 配置 TypeScript path mapping**

修改 `packages/review-app/tsconfig.json`：

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "types": ["vite/client"],
    "rootDir": ".",
    "outDir": "dist",
    "composite": true,
    "paths": {
      "@/*": ["./src/*"],
      "@app/review-backend": ["../review-backend/src/index.ts"]
    }
  },
  "include": ["src/**/*.ts", "src/**/*.tsx", "tests/**/*.ts", "tests/**/*.tsx"]
}
```

- [ ] **Step 4: 重写 `review-model.ts`**

将 `packages/review-app/src/lib/review-model.ts` 替换为：

```typescript
import { z } from "zod";
import {
  reviewFindingSchema,
  reviewSessionDetailSchema,
  reviewSessionEventSchema
} from "@app/review-backend";
import type {
  ReviewFinding,
  ReviewSessionDetail,
  ReviewSessionEvent
} from "@app/review-backend";

// Re-export 后端类型，保持前端导入路径不变
export type { ReviewFinding, ReviewSessionDetail, ReviewSessionEvent };
export { reviewFindingSchema, reviewSessionDetailSchema, reviewSessionEventSchema };

// SessionSummary 是前端独有的 schema（后端无对应物）
export const sessionSummarySchema = z.object({
  sessionId: z.string(),
  repositoryPath: z.string(),
  baseRef: z.string(),
  targetRef: z.string(),
  status: z.enum(["running", "finished", "failed", "partial", "cancelled"]),
  createdAt: z.string().optional(),
  summary: z.object({
    changedFilesCount: z.number(),
    findingsCount: z.number(),
    highSeverityCount: z.number(),
    files: z.array(z.string())
  })
});

export type SessionSummary = z.infer<typeof sessionSummarySchema>;
```

- [ ] **Step 5: 更新 `ipc-client.ts` 导入**

修改 `packages/review-app/src/lib/ipc-client.ts` 第 1 行：

```typescript
import type { ReviewSessionEvent } from "@app/review-backend";
import type { ReviewSessionDetail, SessionSummary } from "./review-model";
```

其余代码不变。

- [ ] **Step 6: 运行类型检查**

```bash
pnpm typecheck
```

预期：通过。如果出现 `ReviewSessionEvent` 类型不兼容的错误，检查后端 schema 的 discriminatedUnion 是否与前端手写类型完全一致。

- [ ] **Step 7: 运行前端测试**

```bash
pnpm --filter @app/review-app test
```

预期：所有测试通过。

- [ ] **Step 8: 提交**

```bash
git add packages/review-app/package.json packages/review-app/vite.config.ts packages/review-app/tsconfig.json packages/review-app/src/lib/review-model.ts packages/review-app/src/lib/ipc-client.ts
git commit -m "refactor(frontend): deduplicate schemas by importing from backend"
```

---

### Task 3: 合并 LlmProvider 接口

**目标:** 将 `review()` 和可选的 `chat()` 合并为统一的 `chat()` 方法，消除 `stream-review-session.ts` 中的分支逻辑。

**Files:**
- Modify: `packages/review-backend/src/domain/provider.ts`
- Modify: `packages/review-backend/src/infrastructure/llm/openai-compatible-provider.ts`
- Modify: `packages/review-backend/src/application/stream-review-session.ts`
- Modify: `packages/review-backend/src/infrastructure/llm/plan-generator.ts`
- Modify: `packages/review-backend/src/infrastructure/llm/line-relocator.ts`

**Interfaces:**
- 消费：`LlmProvider` 接口的所有实现和调用方
- 生产：统一的 `LlmProvider` 接口，只有 `chat()` 方法

- [ ] **Step 1: 运行现有测试确认基线**

```bash
pnpm --filter @app/review-backend test
```

预期：全部通过。记录测试数量作为后续对比。

- [ ] **Step 2: 修改 `provider.ts` — 统一接口**

将 `packages/review-backend/src/domain/provider.ts` 替换为：

```typescript
import type { ToolCall, ToolDefinition } from "./tool.js";

export type ChatMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | { role: "assistant"; content: string | null; toolCalls?: ToolCall[] }
  | { role: "tool"; toolCallId: string; content: string };

export type ChatResponse = {
  content: string | null;
  toolCalls: ToolCall[];
  usage?: { inputTokens: number; outputTokens: number };
};

export interface LlmProvider {
  readonly id: string;
  chat(input: {
    messages: ChatMessage[];
    tools?: ToolDefinition[];
    jsonMode?: boolean;
    signal?: AbortSignal;
  }): Promise<ChatResponse>;
}

export type ProviderProfile = {
  id: string;
  baseUrl: string;
  apiKey: string;
  model: string;
};
```

- [ ] **Step 3: 更新 `openai-compatible-provider.ts` — 移除 `review()`，增强 `chat()`**

将 `packages/review-backend/src/infrastructure/llm/openai-compatible-provider.ts` 替换为：

```typescript
import type {
  ChatMessage,
  ChatResponse,
  LlmProvider,
  ProviderProfile
} from "../../domain/provider.js";
import type { ToolDefinition } from "../../domain/tool.js";
import { logger } from "../logging/logger.js";

const log = logger.child({ component: "llm" });

export class OpenAiCompatibleProvider implements LlmProvider {
  readonly id: string;

  constructor(private readonly profile: ProviderProfile) {
    this.id = profile.id;
  }

  async chat(input: {
    messages: ChatMessage[];
    tools?: ToolDefinition[];
    jsonMode?: boolean;
    signal?: AbortSignal;
  }): Promise<ChatResponse> {
    const messages = input.messages.map((msg) => {
      if (msg.role === "assistant" && msg.toolCalls) {
        return {
          role: "assistant" as const,
          content: msg.content,
          tool_calls: msg.toolCalls.map((tc) => ({
            id: tc.id,
            type: "function" as const,
            function: { name: tc.name, arguments: JSON.stringify(tc.arguments) }
          }))
        };
      }
      if (msg.role === "tool") {
        return { role: "tool" as const, tool_call_id: msg.toolCallId, content: msg.content };
      }
      return msg;
    });

    const body: Record<string, unknown> = { model: this.profile.model, messages };
    if (input.jsonMode) {
      body.response_format = { type: "json_object" };
    }
    if (input.tools && input.tools.length > 0) {
      body.tools = input.tools.map((tool) => ({
        type: "function",
        function: { name: tool.name, description: tool.description, parameters: tool.parameters }
      }));
    }

    const t0 = Date.now();
    const response = await fetch(`${this.profile.baseUrl}/chat/completions`, {
      method: "POST",
      signal: input.signal,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.profile.apiKey}`
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      log.error(`LLM 请求失败: HTTP ${response.status}, ${Date.now() - t0}ms`);
      throw new Error(`OpenAI-compatible provider request failed: ${response.status}`);
    }

    const payload = (await response.json()) as {
      choices?: Array<{
        message?: {
          content?: string | null;
          tool_calls?: Array<{ id: string; type: string; function: { name: string; arguments: string } }>;
        };
      }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };

    const choice = payload.choices?.[0]?.message;
    const toolCalls = (choice?.tool_calls ?? []).map((tc) => ({
      id: tc.id,
      name: tc.function.name as ToolDefinition["name"],
      arguments: JSON.parse(tc.function.arguments) as Record<string, unknown>
    }));

    const tokens = payload.usage ? `${payload.usage.prompt_tokens ?? 0}+${payload.usage.completion_tokens ?? 0}` : "-";
    const tools = toolCalls.map((tc) => tc.name).join(",") || "无";
    log.info(`LLM 完成: ${Date.now() - t0}ms, tools=[${tools}], tokens=${tokens}`);

    return {
      content: choice?.content ?? null,
      toolCalls,
      usage: payload.usage
        ? { inputTokens: payload.usage.prompt_tokens ?? 0, outputTokens: payload.usage.completion_tokens ?? 0 }
        : undefined
    };
  }
}
```

- [ ] **Step 4: 更新 `stream-review-session.ts` — 移除 `if (provider.chat)` 分支**

修改 `packages/review-backend/src/application/stream-review-session.ts` 中的依赖类型和审查逻辑：

将依赖类型（第 31 行）改为：

```typescript
dependencies: {
  provider: Pick<LlmProvider, "id" | "chat">;
  gitClient: Pick<GitClient, "readDiff" | "readFileAtRef" | "readWorkspaceDiff" | "lsFiles" | "grep">;
  sessionStore: SessionStore;
};
```

将审查逻辑（第 130-178 行）替换为：

```typescript
      let unitFindings: ReviewFinding[];
      const t0 = Date.now();

      // Generate plan for large changes
      const diffText = buildDiffText(unit.primaryFile, diffFiles);
      const diffLineCount = diffText.split("\n").length;
      let planGuidance = "";

      if (diffLineCount > 50) {
        const plan = await generateReviewPlan({
          provider: input.dependencies.provider,
          diff: diffText,
          fileContent: context.afterContent,
          signal
        });
        planGuidance = `\n\nReview plan:\n- Risk points: ${plan.riskPoints.map((r) => `${r.area} (${r.riskLevel})`).join(", ") || "none identified"}\n- Strategy: ${plan.reviewStrategy}\n- Complexity: ${plan.estimatedComplexity}`;
        unitLog.info(`计划生成: ${plan.riskPoints.length} 个风险点, 复杂度=${plan.estimatedComplexity}`);
      }

      // Tool-use loop
      const systemPrompt = buildSystemPrompt(unit.primaryFile) + planGuidance;
      const initialUserMessage = buildReviewPrompt({
        filePath: unit.primaryFile,
        diff: diffText,
        beforeContent: context.beforeContent,
        afterContent: context.afterContent,
        contextBudgetTokens
      });

      const loopResult = await runToolUseLoop({
        provider: input.dependencies.provider,
        systemPrompt,
        initialUserMessage,
        signal,
        toolExecutorContext: {
          gitClient: input.dependencies.gitClient,
          baseRef,
          targetRef,
          repositoryPath,
          diffFiles
        }
      });
      unitFindings = loopResult.findings;
      unitLog.info(`审查完成: ${unitFindings.length} 个问题, ${loopResult.totalRounds} 轮, ${Date.now() - t0}ms`);
```

- [ ] **Step 5: 更新 `plan-generator.ts` — 使用 `chat` 替代 `review`**

修改 `packages/review-backend/src/infrastructure/llm/plan-generator.ts`，将函数签名和调用改为：

```typescript
export async function generateReviewPlan(input: {
  provider: Pick<LlmProvider, "id" | "chat">;
  diff: string;
  fileContent: string;
  signal?: AbortSignal;
}): Promise<ReviewPlan> {
  const prompt = PLAN_PROMPT.replace("{{diff}}", input.diff.slice(0, 30000)).replace(
    "{{fileContent}}",
    input.fileContent.slice(0, 30000)
  );

  try {
    const t0 = Date.now();
    const result = await input.provider.chat({
      messages: [{ role: "user", content: prompt }],
      jsonMode: true,
      signal: input.signal
    });
    log.info(`计划生成完成: ${Date.now() - t0}ms`);

    const parsed = JSON.parse(result.content ?? "{}");
    return reviewPlanSchema.parse(parsed);
  } catch (error) {
    log.warn(`计划生成失败，使用默认计划: ${error instanceof Error ? error.message : "未知错误"}`);
    return DEFAULT_REVIEW_PLAN;
  }
}
```

- [ ] **Step 6: 更新 `line-relocator.ts` — 使用 `chat` 替代 `review`**

修改 `packages/review-backend/src/infrastructure/llm/line-relocator.ts`，将函数签名和调用改为：

```typescript
export async function relocateFinding(input: {
  provider: Pick<LlmProvider, "id" | "chat">;
  finding: ReviewFinding;
  fileContent: string;
  signal?: AbortSignal;
}): Promise<ReviewFinding> {
  const { finding, fileContent } = input;

  if (finding.startLine && finding.status === "line-level") {
    return finding;
  }

  if (!finding.evidence && !finding.summary) {
    return { ...finding, status: "file-level" };
  }

  try {
    const t0 = Date.now();
    const prompt = RELOCATE_PROMPT.replace("{{file}}", finding.file)
      .replace("{{summary}}", finding.summary)
      .replace("{{evidence}}", finding.evidence ?? finding.summary)
      .replace("{{fileContent}}", fileContent.slice(0, 50000));

    const result = await input.provider.chat({
      messages: [{ role: "user", content: prompt }],
      jsonMode: true,
      signal: input.signal
    });
    const parsed = JSON.parse(result.content ?? "{}");

    if (parsed.startLine && parsed.endLine) {
      log.info(`行号重定位成功: ${finding.file}:${parsed.startLine}-${parsed.endLine}, ${Date.now() - t0}ms`);
      return {
        ...finding,
        startLine: parsed.startLine,
        endLine: parsed.endLine,
        status: "line-level"
      };
    }

    log.info(`行号重定位未找到精确位置: ${finding.file}, ${Date.now() - t0}ms`);
    return { ...finding, status: "file-level" };
  } catch (error) {
    log.warn(`行号重定位失败: ${finding.file}`);
    return { ...finding, status: "file-level" };
  }
}
```

- [ ] **Step 7: 运行类型检查和测试**

```bash
pnpm typecheck && pnpm --filter @app/review-backend test
```

预期：全部通过。

- [ ] **Step 8: 提交**

```bash
git add packages/review-backend/src/domain/provider.ts packages/review-backend/src/infrastructure/llm/openai-compatible-provider.ts packages/review-backend/src/application/stream-review-session.ts packages/review-backend/src/infrastructure/llm/plan-generator.ts packages/review-backend/src/infrastructure/llm/line-relocator.ts
git commit -m "refactor(provider): merge review() into unified chat() method"
```

---

### Task 4: 移除 buildReviewUnits 空抽象

**目标:** `buildReviewUnits` 只是 1:1 映射，`ReviewUnit` 的 `files` 和 `diffPaths` 永远是单元素数组。移除这个无价值的抽象层，直接遍历 `diffFiles`。

**Files:**
- Modify: `packages/review-backend/src/application/stream-review-session.ts`
- Delete: `packages/review-backend/src/infrastructure/planner/review-unit-planner.ts`
- Modify: `packages/review-backend/src/index.ts`
- Delete: `packages/review-backend/tests/review-unit-planner.test.ts`

**Interfaces:**
- 消费：`buildReviewUnits` 和 `ReviewUnit` 类型
- 生产：无（直接使用 `ParsedDiffFile`）

- [ ] **Step 1: 运行现有测试确认基线**

```bash
pnpm --filter @app/review-backend test
```

预期：全部通过。

- [ ] **Step 2: 修改 `stream-review-session.ts` — 移除 ReviewUnit 依赖**

移除文件头部的导入（第 14 行）：
```typescript
// 删除这行
import { buildReviewUnits } from "../infrastructure/planner/review-unit-planner.js";
```

移除 `ReviewUnit` 相关的导入（如果有）。

将 L103-104 的：
```typescript
const units = buildReviewUnits(diffFiles);
let hasUnitFailure = false;
```

改为：
```typescript
let hasUnitFailure = false;
```

将 L106 的 `for (const unit of units)` 改为：

```typescript
for (const diffFile of diffFiles) {
```

将循环体内所有 `unit.primaryFile` 替换为 `diffFile.path`，所有 `unit.id` 替换为 `diffFile.path`（用文件路径作为 unit ID）。

将 L115-119 的 `collectUnitContext` 调用改为：

```typescript
      const context = await collectUnitContext({
        gitClient: input.dependencies.gitClient,
        baseRef,
        targetRef,
        filePath: diffFile.path
      });
```

将 L253-255 的 `buildReviewSummary` 调用改为：

```typescript
  const summary = buildReviewSummary({
    findings,
    changedFiles: diffFiles.map((f) => f.path)
  });
```

- [ ] **Step 3: 更新 `context-collector.ts` — 使用 filePath 替代 unit**

修改 `packages/review-backend/src/infrastructure/context/context-collector.ts`：

```typescript
import type { GitClient } from "../git/git-client.js";

export async function collectUnitContext(input: {
  gitClient: Pick<GitClient, "readFileAtRef">;
  baseRef: string;
  targetRef: string;
  filePath: string;
}) {
  const [beforeContent, afterContent] = await Promise.all([
    input.gitClient.readFileAtRef(input.baseRef, input.filePath).catch(() => ""),
    input.gitClient.readFileAtRef(input.targetRef, input.filePath).catch(() => "")
  ]);

  return {
    filePath: input.filePath,
    beforeContent,
    afterContent
  };
}
```

- [ ] **Step 4: 删除 `review-unit-planner.ts`**

```bash
rm packages/review-backend/src/infrastructure/planner/review-unit-planner.ts
```

- [ ] **Step 5: 删除相关测试**

```bash
rm packages/review-backend/tests/review-unit-planner.test.ts
```

- [ ] **Step 6: 更新 `index.ts` — 移除导出**

从 `packages/review-backend/src/index.ts`（Task 1 已清理后的版本）中移除：

```typescript
// 删除这行（如果 Task 1 的 infrastructure/index.ts 中有）
// export * from "./infrastructure/planner/review-unit-planner.js";
```

同时从 `packages/review-backend/src/infrastructure/index.ts`（Task 1 创建的）中移除对应行。

如果 `domain/review-unit.ts` 仍有其他消费方，保留该文件；否则也移除。检查：

```bash
grep -r "ReviewUnit\|review-unit" packages/ --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v dist | grep -v ".test."
```

如果没有其他引用，删除 `packages/review-backend/src/domain/review-unit.ts` 并从 `index.ts` 移除导出。

- [ ] **Step 7: 运行类型检查和测试**

```bash
pnpm typecheck && pnpm test
```

预期：全部通过。

- [ ] **Step 8: 提交**

```bash
git add -A packages/review-backend/
git commit -m "refactor(backend): remove buildReviewUnits abstraction, iterate diffFiles directly"
```

---

### Task 5: 修复过滤配置引用

**目标:** `stream-review-session.ts` 中内联的过滤配置与 `review-rules.ts` 中的 `DEFAULT_FILTER_CONFIG` 不一致。统一使用 domain 层定义的默认配置。

**Files:**
- Modify: `packages/review-backend/src/application/stream-review-session.ts`

**Interfaces:**
- 消费：`DEFAULT_FILTER_CONFIG` from `domain/review-rules.ts`
- 生产：无

- [ ] **Step 1: 添加导入**

在 `packages/review-backend/src/application/stream-review-session.ts` 头部添加：

```typescript
import { DEFAULT_FILTER_CONFIG } from "../domain/review-rules.js";
```

- [ ] **Step 2: 替换内联配置**

将 L84-101 的：

```typescript
  diffFiles = filterReviewFiles({
    files: allDiffFiles as ParsedDiffFile[],
    config: {
      extensionAllowlist: [
        ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
        ".go", ".py", ".java", ".kt", ".rs", ".c", ".cpp", ".h", ".hpp",
        ".rb", ".php", ".swift", ".dart", ".lua", ".sh", ".bash",
        ".sql", ".graphql", ".proto",
        ".json", ".yaml", ".yml", ".toml", ".xml", ".html", ".css", ".scss",
        ".md", ".txt"
      ],
      excludePatterns: [
        "**/node_modules/**", "**/vendor/**", "**/*.lock",
        "**/dist/**", "**/build/**", "**/*.min.js", "**/*.min.css"
      ],
      excludeTestFiles: false
    }
  });
```

替换为：

```typescript
  diffFiles = filterReviewFiles({
    files: allDiffFiles as ParsedDiffFile[],
    config: DEFAULT_FILTER_CONFIG
  });
```

- [ ] **Step 3: 运行测试**

```bash
pnpm --filter @app/review-backend test
```

预期：全部通过。

- [ ] **Step 4: 提交**

```bash
git add packages/review-backend/src/application/stream-review-session.ts
git commit -m "refactor(backend): use DEFAULT_FILTER_CONFIG instead of inline config"
```

---

### Task 6: 拆分 stream-review-session 大函数

**目标:** 将 `stream-review-session.ts`（~400 行）中的独立关注点提取到单独模块：prompt 模板、取消处理、路径规范化。

**Files:**
- Create: `packages/review-backend/src/application/review-prompts.ts`
- Create: `packages/review-backend/src/application/cancel-session.ts`
- Create: `packages/review-backend/src/application/finding-normalize.ts`
- Modify: `packages/review-backend/src/application/stream-review-session.ts`

**Interfaces:**
- 消费：`stream-review-session.ts` 中的私有函数
- 生产：三个新模块导出的函数，供 `stream-review-session.ts` 调用

- [ ] **Step 1: 运行现有测试确认基线**

```bash
pnpm --filter @app/review-backend test
```

预期：全部通过。

- [ ] **Step 2: 创建 `review-prompts.ts` — 提取 prompt 模板**

创建 `packages/review-backend/src/application/review-prompts.ts`：

```typescript
import type { ParsedDiffFile } from "../infrastructure/git/parse-unified-diff.js";

export function buildSystemPrompt(filePath: string): string {
  return `你是一位资深代码审查专家。请仔细审查文件 "${filePath}" 的代码变更。

你的任务：
1. 分析 diff 中的潜在 bug、安全问题、性能问题和代码质量问题。
2. 需要时使用工具获取更多上下文（读取文件、搜索代码等）。
3. 使用 code_comment 工具提交发现的问题。
4. 审查完成后调用 task_done。

要求：
- 关注真实问题，不要纠结代码风格。
- 提供具体的行号引用和证据。
- 考虑边界情况和错误处理。
- 全面但避免误报。
- 所有输出必须使用中文。`;
}

export function buildReviewPrompt(input: {
  filePath: string;
  diff: string;
  beforeContent: string;
  afterContent: string;
  contextBudgetTokens: number;
}): string {
  return `请审查文件 "${input.filePath}" 的以下代码变更：

## Diff
\`\`\`diff
${input.diff}
\`\`\`

## 变更后的文件内容
\`\`\`
${input.afterContent.slice(0, 50000)}
\`\`\`

请审查这些变更并报告发现的问题。`;
}

export function buildDiffText(filePath: string, diffFiles: ParsedDiffFile[]): string {
  const file = diffFiles.find((f) => f.path === filePath);
  if (!file) return "";

  return file.hunks
    .map((h) => {
      const lines = h.lines.map((l) => {
        const prefix = l.type === "added" ? "+" : l.type === "deleted" ? "-" : " ";
        return prefix + l.content;
      });
      return `@@ -${h.oldStart},${h.oldCount} +${h.newStart},${h.newCount} @@\n${lines.join("\n")}`;
    })
    .join("\n");
}
```

- [ ] **Step 3: 创建 `cancel-session.ts` — 提取取消逻辑**

创建 `packages/review-backend/src/application/cancel-session.ts`：

```typescript
import type { ReviewFinding } from "../domain/review-finding.js";
import type { ReviewSessionEvent } from "../domain/review-session.js";
import { buildReviewSummary } from "./build-review-summary.js";

type SessionStore = {
  appendEvent(sessionId: string, event: ReviewSessionEvent): Promise<void>;
  completeSession(sessionId: string, summary: unknown): Promise<void>;
};

export async function completeCancelledSession(input: {
  sessionId: string;
  sessionStore: SessionStore;
  repositoryPath: string;
  baseRef: string;
  targetRef: string;
  findings: ReviewFinding[];
  diffByFile: Record<string, { original: string; modified: string }>;
  changedFiles: string[];
}): Promise<ReviewSessionEvent> {
  const cancelledEvent = {
    type: "session-cancelled" as const,
    sessionId: input.sessionId,
    totalFindings: input.findings.length
  };
  const summary = buildReviewSummary({
    findings: input.findings,
    changedFiles: input.changedFiles
  });

  await input.sessionStore.appendEvent(input.sessionId, cancelledEvent);
  await input.sessionStore.completeSession(input.sessionId, {
    sessionId: input.sessionId,
    status: "cancelled",
    repositoryPath: input.repositoryPath,
    baseRef: input.baseRef,
    targetRef: input.targetRef,
    summary,
    findings: input.findings,
    diffByFile: input.diffByFile
  });

  return cancelledEvent;
}
```

- [ ] **Step 4: 创建 `finding-normalize.ts` — 提取路径规范化**

创建 `packages/review-backend/src/application/finding-normalize.ts`：

```typescript
import type { ReviewFinding } from "../domain/review-finding.js";
import type { ParsedDiffFile } from "../infrastructure/git/parse-unified-diff.js";

export function normalizeFindingFiles(input: {
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

- [ ] **Step 5: 重写 `stream-review-session.ts` — 使用提取的模块**

将 `packages/review-backend/src/application/stream-review-session.ts` 替换为：

```typescript
import { buildReviewSummary } from "./build-review-summary.js";
import { completeCancelledSession } from "./cancel-session.js";
import { normalizeFindingFiles } from "./finding-normalize.js";
import { buildDiffText, buildReviewPrompt, buildSystemPrompt } from "./review-prompts.js";
import type { ReviewFinding } from "../domain/review-finding.js";
import type { LlmProvider } from "../domain/provider.js";
import type { ReviewSessionEvent, ReviewSessionInput } from "../domain/review-session.js";
import { DEFAULT_FILTER_CONFIG } from "../domain/review-rules.js";
import { collectUnitContext } from "../infrastructure/context/context-collector.js";
import { filterReviewFiles } from "../infrastructure/filter/file-filter.js";
import type { GitClient } from "../infrastructure/git/git-client.js";
import type { ParsedDiffFile } from "../infrastructure/git/parse-unified-diff.js";
import { logger } from "../infrastructure/logging/logger.js";
import { relocateFinding } from "../infrastructure/llm/line-relocator.js";
import { generateReviewPlan } from "../infrastructure/llm/plan-generator.js";
import { runToolUseLoop } from "../infrastructure/llm/tool-use-loop.js";

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
    signal?: AbortSignal;
    dependencies: {
      provider: Pick<LlmProvider, "id" | "chat">;
      gitClient: Pick<GitClient, "readDiff" | "readFileAtRef" | "readWorkspaceDiff" | "lsFiles" | "grep">;
      sessionStore: SessionStore;
    };
  }
): AsyncGenerator<ReviewSessionEvent, void, void> {
  const { repositoryPath, baseRef, targetRef, contextBudgetTokens } = input.input;
  const signal = input.signal;

  const session = await input.dependencies.sessionStore.createSession({
    repositoryPath,
    baseRef,
    targetRef
  });
  const log = logger.child({ sid: session.sessionId.slice(0, 8) });
  log.info(`${repositoryPath} [${baseRef}...${targetRef}] 开始审查`);

  const startedEvent = {
    type: "session-started" as const,
    sessionId: session.sessionId
  };
  await input.dependencies.sessionStore.appendEvent(session.sessionId, startedEvent);
  yield startedEvent;

  let diffFiles: ParsedDiffFile[] = [];
  const findings: ReviewFinding[] = [];
  const diffByFile: Record<string, { original: string; modified: string }> = {};
  const cancelSession = async () =>
    completeCancelledSession({
      sessionId: session.sessionId,
      sessionStore: input.dependencies.sessionStore,
      repositoryPath,
      baseRef,
      targetRef,
      findings,
      diffByFile,
      changedFiles: diffFiles.map((file) => file.path)
    });

  if (signal?.aborted) {
    yield await cancelSession();
    return;
  }

  // Read diff
  const diffStartTime = Date.now();
  const allDiffFiles = targetRef === "WORKSPACE"
    ? await input.dependencies.gitClient.readWorkspaceDiff()
    : await input.dependencies.gitClient.readDiff(baseRef, targetRef);
  log.info(`读取 diff 完成: ${allDiffFiles.length} 个文件, ${Date.now() - diffStartTime}ms`);

  // Filter files
  diffFiles = filterReviewFiles({
    files: allDiffFiles as ParsedDiffFile[],
    config: DEFAULT_FILTER_CONFIG
  });

  let hasUnitFailure = false;

  for (const diffFile of diffFiles) {
    if (signal?.aborted) {
      yield await cancelSession();
      return;
    }

    const unitLog = log.child({ file: diffFile.path });
    try {
      const context = await collectUnitContext({
        gitClient: input.dependencies.gitClient,
        baseRef,
        targetRef,
        filePath: diffFile.path
      });
      const unitDiff = {
        original: context.beforeContent,
        modified: context.afterContent
      };
      diffByFile[diffFile.path] = unitDiff;

      let unitFindings: ReviewFinding[];
      const t0 = Date.now();

      // Generate plan for large changes
      const diffText = buildDiffText(diffFile.path, diffFiles);
      const diffLineCount = diffText.split("\n").length;
      let planGuidance = "";

      if (diffLineCount > 50) {
        const plan = await generateReviewPlan({
          provider: input.dependencies.provider,
          diff: diffText,
          fileContent: context.afterContent,
          signal
        });
        planGuidance = `\n\nReview plan:\n- Risk points: ${plan.riskPoints.map((r) => `${r.area} (${r.riskLevel})`).join(", ") || "none identified"}\n- Strategy: ${plan.reviewStrategy}\n- Complexity: ${plan.estimatedComplexity}`;
        unitLog.info(`计划生成: ${plan.riskPoints.length} 个风险点, 复杂度=${plan.estimatedComplexity}`);
      }

      // Tool-use loop
      const systemPrompt = buildSystemPrompt(diffFile.path) + planGuidance;
      const initialUserMessage = buildReviewPrompt({
        filePath: diffFile.path,
        diff: diffText,
        beforeContent: context.beforeContent,
        afterContent: context.afterContent,
        contextBudgetTokens
      });

      const loopResult = await runToolUseLoop({
        provider: input.dependencies.provider,
        systemPrompt,
        initialUserMessage,
        signal,
        toolExecutorContext: {
          gitClient: input.dependencies.gitClient,
          baseRef,
          targetRef,
          repositoryPath,
          diffFiles
        }
      });
      unitFindings = loopResult.findings;
      unitLog.info(`审查完成: ${unitFindings.length} 个问题, ${loopResult.totalRounds} 轮, ${Date.now() - t0}ms`);

      unitFindings = normalizeFindingFiles({
        findings: unitFindings,
        primaryFile: diffFile.path,
        diffFiles,
        repositoryPath
      });

      // Relocate findings without line numbers
      unitFindings = await Promise.all(
        unitFindings.map((finding) =>
          finding.startLine
            ? Promise.resolve(finding)
            : relocateFinding({
                provider: input.dependencies.provider,
                finding,
                fileContent: context.afterContent,
                signal
              })
        )
      );

      if (signal?.aborted) {
        yield await cancelSession();
        return;
      }

      findings.push(...unitFindings);

      const unitCompletedEvent = {
        type: "unit-completed" as const,
        sessionId: session.sessionId,
        unitId: diffFile.path,
        findingsCount: unitFindings.length,
        findings: unitFindings,
        diffByFile: {
          [diffFile.path]: unitDiff
        }
      };
      await input.dependencies.sessionStore.appendEvent(session.sessionId, unitCompletedEvent);
      yield unitCompletedEvent;
    } catch (error) {
      if (signal?.aborted) {
        yield await cancelSession();
        return;
      }

      hasUnitFailure = true;
      unitLog.warn(`审查失败: ${error instanceof Error ? error.message : "未知错误"}`);
      const unitFailedEvent = {
        type: "unit-failed" as const,
        sessionId: session.sessionId,
        unitId: diffFile.path,
        reason: error instanceof Error ? error.message : "unknown error"
      };
      await input.dependencies.sessionStore.appendEvent(session.sessionId, unitFailedEvent);
      yield unitFailedEvent;
    }
  }

  if (signal?.aborted) {
    yield await cancelSession();
    return;
  }

  const finishedEvent = {
    type: "session-finished" as const,
    sessionId: session.sessionId,
    totalFindings: findings.length,
    status: hasUnitFailure ? ("partial" as const) : ("finished" as const)
  };
  const summary = buildReviewSummary({
    findings,
    changedFiles: diffFiles.map((f) => f.path)
  });
  await input.dependencies.sessionStore.appendEvent(session.sessionId, finishedEvent);
  await input.dependencies.sessionStore.completeSession(session.sessionId, {
    sessionId: session.sessionId,
    status: finishedEvent.status,
    repositoryPath,
    baseRef,
    targetRef,
    summary,
    findings,
    diffByFile
  });

  log.info(`审查结束: ${finishedEvent.status}, ${findings.length} 个问题, ${summary.highSeverityCount} 个高风险`);
  yield finishedEvent;
}
```

- [ ] **Step 6: 运行类型检查**

```bash
pnpm typecheck
```

预期：通过。如有错误，检查导入路径是否正确。

- [ ] **Step 7: 运行全部测试**

```bash
pnpm test
```

预期：所有测试通过。

- [ ] **Step 8: 提交**

```bash
git add packages/review-backend/src/application/
git commit -m "refactor(backend): extract prompts, cancel logic, and path normalization from stream-review-session"
```

---

## 验证清单

全部 Task 完成后，运行完整验证：

```bash
pnpm typecheck && pnpm test
```

预期：零错误，零失败。

检查架构改进是否到位：
- [ ] `review-backend/src/index.ts` 不包含任何 `infrastructure` 导出
- [ ] `review-app/src/lib/review-model.ts` 不包含重复的 zod schema 定义
- [ ] `domain/provider.ts` 只有 `chat()` 方法，没有 `review()`
- [ ] `review-unit-planner.ts` 文件已删除
- [ ] `stream-review-session.ts` 使用 `DEFAULT_FILTER_CONFIG` 而非内联配置
- [ ] `stream-review-session.ts` 低于 200 行，prompt/cancel/normalize 在各自模块中
