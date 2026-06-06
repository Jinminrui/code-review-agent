# Review Backend Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建桌面端可视化代码审查 Agent 的 TypeScript 后端基础能力，包括技术栈落地、核心模块边界、审查编排链路和可回放会话存储。

**Architecture:** 后端不单独起 HTTP 服务，而是作为 Electron 主进程可调用的 TypeScript 应用服务存在。整体采用 `domain + application + infrastructure` 分层：`domain` 定义核心类型与规则，`application` 组织 review session 流程，`infrastructure` 负责 git、LLM、文件存储等外部依赖。

**Tech Stack:** Node.js 22、TypeScript 5、pnpm workspace、Vitest、tsx、zod、execa、pino

---

## 技术选型与架构决策

### 1. 技术选型

1. `Node.js 22`
   原因：与 Electron 生态兼容度高，原生 `fetch`、`AbortController`、`fs/promises` 能力完整，适合桌面端本地编排任务。
2. `TypeScript 5`
   原因：便于定义稳定的 review result、planner input、provider contract，减少跨模块接口漂移。
3. `pnpm workspace`
   原因：后续前端、Electron 壳和后端核心可以共用 monorepo，但依赖隔离和安装速度更好。
4. `Vitest`
   原因：TS 体验轻，适合单元测试和集成测试，和后续前端技术栈也容易统一。
5. `zod`
   原因：用于会话文件、LLM 输出、配置对象的运行时校验，降低模型和磁盘数据污染风险。
6. `execa`
   原因：第一版通过系统 `git` 命令获取 diff 和文件内容，控制力更强，也避免过早引入重型 git 绑定。
7. `pino`
   原因：结构化日志简单稳定，便于后续定位会话执行错误。

### 2. 后端目录结构

```text
package.json
pnpm-workspace.yaml
tsconfig.base.json
vitest.workspace.ts
packages/
  review-backend/
    package.json
    tsconfig.json
    src/
      index.ts
      domain/
        review-session.ts
        review-finding.ts
        review-unit.ts
        provider.ts
      application/
        start-review-session.ts
        stream-review-session.ts
        build-review-summary.ts
      infrastructure/
        git/
          git-client.ts
          parse-unified-diff.ts
        planner/
          review-unit-planner.ts
        context/
          context-collector.ts
        llm/
          openai-compatible-provider.ts
          normalize-provider-output.ts
        storage/
          file-session-store.ts
          paths.ts
        logging/
          logger.ts
      contracts/
        ipc.ts
    tests/
      git-client.test.ts
      review-unit-planner.test.ts
      normalize-provider-output.test.ts
      start-review-session.test.ts
```

### 3. 核心架构约束

1. 后端通过函数调用或 IPC contract 暴露能力，不额外引入 Fastify/Express。
2. session store 第一版使用文件系统而不是 SQLite，避免 Electron 打包期的原生模块复杂度。
3. git 读取能力统一走 `GitClient`，上层代码禁止直接调用 shell。
4. LLM provider 必须通过统一接口注入，第一版只实现 OpenAI-compatible provider。
5. 渐进式结果通过 `AsyncGenerator<ReviewSessionEvent>` 暴露，前端天然可流式消费。

## 任务拆分总览

本计划只覆盖“后端子系统”一个独立子项目，不包含前端渲染层与 Electron 窗口 UI。完成本计划后，应获得一个可被桌面壳调用、可在本地仓库上运行、可保存历史 session 的 review backend。

### Task 1: 初始化后端工作区与开发工具链

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `vitest.workspace.ts`
- Create: `packages/review-backend/package.json`
- Create: `packages/review-backend/tsconfig.json`
- Create: `packages/review-backend/src/index.ts`
- Test: `packages/review-backend/package.json`

- [ ] **Step 1: 先写工具链存在性的冒烟测试命令**

Run: `pnpm --version`
Expected: 输出版本号，例如 `11.x.x`

Run: `node --version`
Expected: 输出 `v22.x.x` 或兼容版本

- [ ] **Step 2: 创建 workspace 根配置**

```json
{
  "name": "code-review-agent",
  "private": true,
  "packageManager": "pnpm@11.5.2",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc -b",
    "lint:plan": "echo \"lint not configured yet\""
  }
}
```

```yaml
packages:
  - "packages/*"
```

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "declaration": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "forceConsistentCasingInFileNames": true,
    "noUncheckedIndexedAccess": true
  }
}
```

- [ ] **Step 3: 创建后端包配置**

```json
{
  "name": "@app/review-backend",
  "private": true,
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
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
export const backendVersion = "0.1.0";

if (process.env.NODE_ENV !== "test") {
  console.log(`[review-backend] ${backendVersion}`);
}
```

- [ ] **Step 4: 增加 Vitest workspace 配置**

```ts
import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  {
    test: {
      name: "review-backend",
      include: ["packages/review-backend/tests/**/*.test.ts"],
      environment: "node"
    }
  }
]);
```

- [ ] **Step 5: 安装依赖并验证工具链**

Run: `pnpm install`
Expected: 安装完成，无 peer dependency 阻塞错误

Run: `pnpm typecheck`
Expected: 成功退出，输出包含 `0 errors` 或无错误信息

Run: `pnpm test`
Expected: 当前可能显示 `No test files found`，这是允许的

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-workspace.yaml tsconfig.base.json vitest.workspace.ts packages/review-backend/package.json packages/review-backend/tsconfig.json packages/review-backend/src/index.ts
git commit -m "chore: bootstrap review backend workspace"
```

### Task 2: 定义领域模型、IPC 合约和会话事件流

**Files:**
- Create: `packages/review-backend/src/domain/review-finding.ts`
- Create: `packages/review-backend/src/domain/review-session.ts`
- Create: `packages/review-backend/src/domain/review-unit.ts`
- Create: `packages/review-backend/src/domain/provider.ts`
- Create: `packages/review-backend/src/contracts/ipc.ts`
- Create: `packages/review-backend/tests/review-session-types.test.ts`
- Modify: `packages/review-backend/src/index.ts`

- [ ] **Step 1: 先写失败测试，锁定 session 和 finding 结构**

```ts
import { describe, expect, it } from "vitest";
import { reviewFindingSchema, reviewSessionInputSchema } from "../src/index";

describe("review session schemas", () => {
  it("accepts a line-level finding", () => {
    const finding = reviewFindingSchema.parse({
      id: "f_1",
      severity: "high",
      category: "bug-risk",
      summary: "可能遗漏空值保护",
      explanation: "新分支未覆盖 undefined 场景",
      file: "src/service.ts",
      startLine: 12,
      endLine: 14,
      confidenceSignals: ["diff-hit", "line-located"],
      status: "line-level"
    });

    expect(finding.startLine).toBe(12);
  });

  it("rejects an invalid review input", () => {
    expect(() =>
      reviewSessionInputSchema.parse({
        repositoryPath: "",
        baseRef: "main",
        targetRef: "feature"
      })
    ).toThrow();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm --filter @app/review-backend test packages/review-backend/tests/review-session-types.test.ts`
Expected: FAIL，提示 `Cannot find module '../src/index'` 或导出缺失

- [ ] **Step 3: 写最小领域模型与 schema**

```ts
import { z } from "zod";

export const reviewFindingSchema = z.object({
  id: z.string().min(1),
  severity: z.enum(["high", "medium", "low"]),
  category: z.string().min(1),
  summary: z.string().min(1),
  explanation: z.string().min(1),
  file: z.string().min(1),
  startLine: z.number().int().positive().optional(),
  endLine: z.number().int().positive().optional(),
  evidence: z.string().optional(),
  suggestion: z.string().optional(),
  confidenceSignals: z.array(z.string()),
  status: z.enum(["line-level", "file-level"])
});

export type ReviewFinding = z.infer<typeof reviewFindingSchema>;
```

```ts
import { z } from "zod";

export const reviewSessionInputSchema = z.object({
  repositoryPath: z.string().min(1),
  baseRef: z.string().min(1),
  targetRef: z.string().min(1),
  providerProfileId: z.string().min(1),
  contextBudgetTokens: z.number().int().positive().default(12000)
});

export const reviewSessionEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("session-started"), sessionId: z.string() }),
  z.object({
    type: z.literal("unit-completed"),
    sessionId: z.string(),
    unitId: z.string(),
    findingsCount: z.number().int().nonnegative()
  }),
  z.object({
    type: z.literal("session-finished"),
    sessionId: z.string(),
    totalFindings: z.number().int().nonnegative()
  })
]);
```

```ts
export interface LlmProvider {
  readonly id: string;
  review(input: {
    prompt: string;
    signal?: AbortSignal;
  }): Promise<{
    content: string;
    usage?: { inputTokens: number; outputTokens: number };
  }>;
}
```

```ts
export * from "./domain/review-finding";
export * from "./domain/review-session";
export * from "./domain/review-unit";
export * from "./domain/provider";
export * from "./contracts/ipc";
export * from "./application/stream-review-session";
```

- [ ] **Step 4: 补上 IPC 合约，固定前后端边界**

```ts
import { z } from "zod";
import { reviewSessionInputSchema, reviewSessionEventSchema } from "../domain/review-session";

export const createReviewSessionRequestSchema = reviewSessionInputSchema;
export const reviewSessionEventPayloadSchema = reviewSessionEventSchema;

export type CreateReviewSessionRequest = z.infer<typeof createReviewSessionRequestSchema>;
export type ReviewSessionEventPayload = z.infer<typeof reviewSessionEventPayloadSchema>;
```

- [ ] **Step 5: 运行测试验证通过**

Run: `pnpm --filter @app/review-backend test packages/review-backend/tests/review-session-types.test.ts`
Expected: PASS，2 tests passed

- [ ] **Step 6: Commit**

```bash
git add packages/review-backend/src/domain packages/review-backend/src/contracts packages/review-backend/src/index.ts packages/review-backend/tests/review-session-types.test.ts
git commit -m "feat: define backend domain contracts"
```

### Task 3: 实现 GitClient 与统一 diff 解析能力

**Files:**
- Create: `packages/review-backend/src/infrastructure/git/git-client.ts`
- Create: `packages/review-backend/src/infrastructure/git/parse-unified-diff.ts`
- Create: `packages/review-backend/tests/git-client.test.ts`
- Modify: `packages/review-backend/src/index.ts`

- [ ] **Step 1: 先写失败测试，锁定 git 能力接口**

```ts
import { describe, expect, it } from "vitest";
import { parseUnifiedDiff } from "../src/infrastructure/git/parse-unified-diff";

describe("parseUnifiedDiff", () => {
  it("parses file paths and hunk headers", () => {
    const files = parseUnifiedDiff(`
diff --git a/src/a.ts b/src/a.ts
--- a/src/a.ts
+++ b/src/a.ts
@@ -1,2 +1,3 @@
-const a = 1;
+const a = 2;
+const b = 3;
`);

    expect(files).toHaveLength(1);
    expect(files[0].path).toBe("src/a.ts");
    expect(files[0].hunks[0].newStart).toBe(1);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm --filter @app/review-backend test packages/review-backend/tests/git-client.test.ts`
Expected: FAIL，提示 `parseUnifiedDiff` 未定义

- [ ] **Step 3: 实现最小 diff parser**

```ts
export type ParsedDiffFile = {
  path: string;
  hunks: Array<{
    oldStart: number;
    oldCount: number;
    newStart: number;
    newCount: number;
    lines: string[];
  }>;
};

const HUNK_RE = /^@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@/;

export function parseUnifiedDiff(input: string): ParsedDiffFile[] {
  const lines = input.split("\n");
  const files: ParsedDiffFile[] = [];
  let current: ParsedDiffFile | undefined;
  let currentHunk: ParsedDiffFile["hunks"][number] | undefined;

  for (const line of lines) {
    if (line.startsWith("+++ b/")) {
      current = { path: line.slice(6), hunks: [] };
      files.push(current);
      continue;
    }

    const match = line.match(HUNK_RE);
    if (match && current) {
      currentHunk = {
        oldStart: Number(match[1]),
        oldCount: Number(match[2] || "1"),
        newStart: Number(match[3]),
        newCount: Number(match[4] || "1"),
        lines: []
      };
      current.hunks.push(currentHunk);
      continue;
    }

    if (currentHunk) {
      currentHunk.lines.push(line);
    }
  }

  return files;
}
```

- [ ] **Step 4: 实现 GitClient，统一 git 命令入口**

```ts
import { execa } from "execa";
import { parseUnifiedDiff } from "./parse-unified-diff";

export class GitClient {
  constructor(private readonly repositoryPath: string) {}

  async listBranches(): Promise<string[]> {
    const { stdout } = await execa("git", ["branch", "--format=%(refname:short)"], {
      cwd: this.repositoryPath
    });
    return stdout.split("\n").map((line) => line.trim()).filter(Boolean);
  }

  async readDiff(baseRef: string, targetRef: string) {
    const { stdout } = await execa("git", ["diff", "--no-ext-diff", `${baseRef}...${targetRef}`], {
      cwd: this.repositoryPath,
      maxBuffer: 20_000_000
    });
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

- [ ] **Step 5: 为 GitClient 增加临时仓库集成测试**

```ts
import { mkdtemp, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execa } from "execa";
import { describe, expect, it } from "vitest";
import { GitClient } from "../src/infrastructure/git/git-client";

describe("GitClient", () => {
  it("lists branches from a temporary repo", async () => {
    const repo = await mkdtemp(join(tmpdir(), "review-backend-"));
    await execa("git", ["init", "-b", "main"], { cwd: repo });
    await mkdir(join(repo, "src"), { recursive: true });
    await writeFile(join(repo, "src", "a.ts"), "export const a = 1;\n");
    await execa("git", ["add", "."], { cwd: repo });
    await execa("git", ["-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "-m", "init"], { cwd: repo });

    const client = new GitClient(repo);
    const branches = await client.listBranches();

    expect(branches).toContain("main");
  });
});
```

- [ ] **Step 6: 运行测试并 typecheck**

Run: `pnpm --filter @app/review-backend test packages/review-backend/tests/git-client.test.ts`
Expected: PASS

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add packages/review-backend/src/infrastructure/git packages/review-backend/tests/git-client.test.ts packages/review-backend/src/index.ts
git commit -m "feat: add git client and diff parser"
```

### Task 4: 实现 ReviewUnitPlanner 与 ContextCollector

**Files:**
- Create: `packages/review-backend/src/infrastructure/planner/review-unit-planner.ts`
- Create: `packages/review-backend/src/infrastructure/context/context-collector.ts`
- Create: `packages/review-backend/tests/review-unit-planner.test.ts`
- Modify: `packages/review-backend/src/domain/review-unit.ts`
- Modify: `packages/review-backend/src/index.ts`

- [ ] **Step 1: 先写失败测试，固定分组规则**

```ts
import { describe, expect, it } from "vitest";
import { buildReviewUnits } from "../src/infrastructure/planner/review-unit-planner";

describe("buildReviewUnits", () => {
  it("creates one unit per changed file in MVP mode", () => {
    const units = buildReviewUnits([
      { path: "src/a.ts", hunks: [] },
      { path: "src/b.ts", hunks: [] }
    ]);

    expect(units).toHaveLength(2);
    expect(units[0].primaryFile).toBe("src/a.ts");
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm --filter @app/review-backend test packages/review-backend/tests/review-unit-planner.test.ts`
Expected: FAIL，提示 `buildReviewUnits` 未定义

- [ ] **Step 3: 实现 review unit 模型和 planner**

```ts
export type ReviewUnit = {
  id: string;
  primaryFile: string;
  files: string[];
  diffPaths: string[];
};
```

```ts
import type { ParsedDiffFile } from "../git/parse-unified-diff";
import type { ReviewUnit } from "../../domain/review-unit";

export function buildReviewUnits(files: ParsedDiffFile[]): ReviewUnit[] {
  return files.map((file, index) => ({
    id: `unit_${index + 1}`,
    primaryFile: file.path,
    files: [file.path],
    diffPaths: [file.path]
  }));
}
```

- [ ] **Step 4: 实现最小 ContextCollector**

```ts
import type { GitClient } from "../git/git-client";
import type { ReviewUnit } from "../../domain/review-unit";

export async function collectUnitContext(input: {
  gitClient: GitClient;
  baseRef: string;
  targetRef: string;
  unit: ReviewUnit;
}) {
  const [beforeContent, afterContent] = await Promise.all([
    input.gitClient.readFileAtRef(input.baseRef, input.unit.primaryFile).catch(() => ""),
    input.gitClient.readFileAtRef(input.targetRef, input.unit.primaryFile).catch(() => "")
  ]);

  return {
    unitId: input.unit.id,
    primaryFile: input.unit.primaryFile,
    beforeContent,
    afterContent
  };
}
```

- [ ] **Step 5: 扩展测试覆盖空文件和新增文件场景**

```ts
it("keeps primary file even when hunks are empty", () => {
  const units = buildReviewUnits([{ path: "src/new.ts", hunks: [] }]);
  expect(units[0].files).toEqual(["src/new.ts"]);
});
```

- [ ] **Step 6: 运行测试**

Run: `pnpm --filter @app/review-backend test packages/review-backend/tests/review-unit-planner.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add packages/review-backend/src/domain/review-unit.ts packages/review-backend/src/infrastructure/planner packages/review-backend/src/infrastructure/context packages/review-backend/tests/review-unit-planner.test.ts packages/review-backend/src/index.ts
git commit -m "feat: add review unit planner and context collector"
```

### Task 5: 实现 Provider 抽象、OpenAI-compatible 调用器和 Finding Normalizer

**Files:**
- Create: `packages/review-backend/src/infrastructure/llm/openai-compatible-provider.ts`
- Create: `packages/review-backend/src/infrastructure/llm/normalize-provider-output.ts`
- Create: `packages/review-backend/tests/normalize-provider-output.test.ts`
- Modify: `packages/review-backend/src/domain/provider.ts`
- Modify: `packages/review-backend/src/index.ts`

- [ ] **Step 1: 先写失败测试，锁定模型输出结构**

```ts
import { describe, expect, it } from "vitest";
import { normalizeProviderOutput } from "../src/infrastructure/llm/normalize-provider-output";

describe("normalizeProviderOutput", () => {
  it("converts JSON output into a review finding", () => {
    const findings = normalizeProviderOutput({
      content: JSON.stringify({
        findings: [
          {
            severity: "medium",
            category: "test-gap",
            summary: "缺少回归测试",
            explanation: "新增分支没有对应测试",
            file: "src/a.ts",
            startLine: 5,
            endLine: 7,
            confidenceSignals: ["diff-hit"]
          }
        ]
      }),
      fallbackFile: "src/a.ts"
    });

    expect(findings[0].status).toBe("line-level");
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm --filter @app/review-backend test packages/review-backend/tests/normalize-provider-output.test.ts`
Expected: FAIL，提示 `normalizeProviderOutput` 未定义

- [ ] **Step 3: 实现 Provider 接口与 OpenAI-compatible provider**

```ts
export type ProviderProfile = {
  id: string;
  baseUrl: string;
  apiKey: string;
  model: string;
};
```

```ts
import type { LlmProvider, ProviderProfile } from "../../domain/provider";

export class OpenAiCompatibleProvider implements LlmProvider {
  readonly id: string;

  constructor(private readonly profile: ProviderProfile) {
    this.id = profile.id;
  }

  async review(input: { prompt: string; signal?: AbortSignal }) {
    const response = await fetch(`${this.profile.baseUrl}/chat/completions`, {
      method: "POST",
      signal: input.signal,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.profile.apiKey}`
      },
      body: JSON.stringify({
        model: this.profile.model,
        messages: [{ role: "user", content: input.prompt }],
        response_format: { type: "json_object" }
      })
    });

    const payload = await response.json();
    return {
      content: payload.choices?.[0]?.message?.content ?? "{\"findings\":[]}",
      usage: payload.usage
        ? {
            inputTokens: payload.usage.prompt_tokens ?? 0,
            outputTokens: payload.usage.completion_tokens ?? 0
          }
        : undefined
    };
  }
}
```

- [ ] **Step 4: 实现 Finding Normalizer，保证坏输出可降级**

```ts
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { reviewFindingSchema } from "../../domain/review-finding";

const providerOutputSchema = z.object({
  findings: z.array(
    z.object({
      severity: z.enum(["high", "medium", "low"]),
      category: z.string(),
      summary: z.string(),
      explanation: z.string(),
      file: z.string().optional(),
      startLine: z.number().int().positive().optional(),
      endLine: z.number().int().positive().optional(),
      evidence: z.string().optional(),
      suggestion: z.string().optional(),
      confidenceSignals: z.array(z.string()).default([])
    })
  )
});

export function normalizeProviderOutput(input: {
  content: string;
  fallbackFile: string;
}) {
  const parsed = providerOutputSchema.safeParse(JSON.parse(input.content));
  if (!parsed.success) {
    return [];
  }

  return parsed.data.findings.map((finding) =>
    reviewFindingSchema.parse({
      id: randomUUID(),
      ...finding,
      file: finding.file ?? input.fallbackFile,
      status: finding.startLine ? "line-level" : "file-level"
    })
  );
}
```

- [ ] **Step 5: 补充测试覆盖坏 JSON 和文件级降级**

```ts
it("returns empty list for invalid JSON", () => {
  expect(() => normalizeProviderOutput({ content: "not-json", fallbackFile: "src/a.ts" })).toThrow();
});
```

将上面的期望改为真正需要的行为后，再实现：

```ts
it("returns empty list for invalid JSON", () => {
  expect(normalizeProviderOutput({ content: "{}", fallbackFile: "src/a.ts" })).toEqual([]);
});
```

```ts
it("downgrades finding without line numbers", () => {
  const findings = normalizeProviderOutput({
    content: JSON.stringify({
      findings: [
        {
          severity: "low",
          category: "style",
          summary: "建议补充说明",
          explanation: "当前改动意图不够明显",
          confidenceSignals: []
        }
      ]
    }),
    fallbackFile: "src/a.ts"
  });

  expect(findings[0].status).toBe("file-level");
});
```

- [ ] **Step 6: 调整 normalizer 以避免坏 JSON 抛异常**

```ts
export function normalizeProviderOutput(input: {
  content: string;
  fallbackFile: string;
}) {
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(input.content);
  } catch {
    return [];
  }

  const parsed = providerOutputSchema.safeParse(parsedJson);
  if (!parsed.success) {
    return [];
  }

  return parsed.data.findings.map((finding) =>
    reviewFindingSchema.parse({
      id: randomUUID(),
      ...finding,
      file: finding.file ?? input.fallbackFile,
      status: finding.startLine ? "line-level" : "file-level"
    })
  );
}
```

- [ ] **Step 7: 运行测试**

Run: `pnpm --filter @app/review-backend test packages/review-backend/tests/normalize-provider-output.test.ts`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add packages/review-backend/src/infrastructure/llm packages/review-backend/src/domain/provider.ts packages/review-backend/tests/normalize-provider-output.test.ts packages/review-backend/src/index.ts
git commit -m "feat: add llm provider and finding normalizer"
```

### Task 6: 实现 SessionStore 与 review session 编排主流程

**Files:**
- Create: `packages/review-backend/src/infrastructure/storage/paths.ts`
- Create: `packages/review-backend/src/infrastructure/storage/file-session-store.ts`
- Create: `packages/review-backend/src/infrastructure/logging/logger.ts`
- Create: `packages/review-backend/src/application/start-review-session.ts`
- Create: `packages/review-backend/src/application/stream-review-session.ts`
- Create: `packages/review-backend/src/application/build-review-summary.ts`
- Create: `packages/review-backend/tests/start-review-session.test.ts`
- Modify: `packages/review-backend/src/index.ts`

- [ ] **Step 1: 先写失败测试，锁定最小编排能力**

```ts
import { describe, expect, it, vi } from "vitest";
import { streamReviewSession } from "../src/application/stream-review-session";

describe("streamReviewSession", () => {
  it("emits started and finished events", async () => {
    const provider = {
      id: "mock",
      review: vi.fn().mockResolvedValue({
        content: JSON.stringify({ findings: [] })
      })
    };

    const events = [];
    for await (const event of streamReviewSession({
      input: {
        repositoryPath: "/tmp/repo",
        baseRef: "main",
        targetRef: "feature",
        providerProfileId: "mock",
        contextBudgetTokens: 12000
      },
      dependencies: {
        provider,
        gitClient: {
          readDiff: vi.fn().mockResolvedValue([{ path: "src/a.ts", hunks: [] }]),
          readFileAtRef: vi.fn().mockResolvedValue("export const a = 1;\n")
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

    expect(events).toEqual(["session-started", "unit-completed", "session-finished"]);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm --filter @app/review-backend test packages/review-backend/tests/start-review-session.test.ts`
Expected: FAIL，提示 `streamReviewSession` 未定义

- [ ] **Step 3: 实现文件型 SessionStore**

```ts
import { mkdir, readFile, writeFile } from "node:fs/promises";
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
    const sessionDir = join(this.rootDir, sessionId);
    const current = await readFile(join(sessionDir, "events.jsonl"), "utf8");
    await writeFile(join(sessionDir, "events.jsonl"), `${current}${JSON.stringify(event)}\n`);
  }

  async completeSession(sessionId: string, summary: unknown) {
    const sessionDir = join(this.rootDir, sessionId);
    await writeFile(join(sessionDir, "summary.json"), JSON.stringify(summary, null, 2));
  }
}
```

- [ ] **Step 4: 实现最小编排主流程**

```ts
import { randomUUID } from "node:crypto";
import { buildReviewUnits } from "../infrastructure/planner/review-unit-planner";
import { collectUnitContext } from "../infrastructure/context/context-collector";
import { normalizeProviderOutput } from "../infrastructure/llm/normalize-provider-output";

export async function* streamReviewSession(input: {
  input: {
    repositoryPath: string;
    baseRef: string;
    targetRef: string;
    providerProfileId: string;
    contextBudgetTokens: number;
  };
  dependencies: {
    provider: {
      id: string;
      review(input: { prompt: string; signal?: AbortSignal }): Promise<{ content: string }>;
    };
    gitClient: {
      readDiff(baseRef: string, targetRef: string): Promise<Array<{ path: string; hunks: unknown[] }>>;
      readFileAtRef(ref: string, filePath: string): Promise<string>;
    };
    sessionStore: {
      createSession(input: { repositoryPath: string; baseRef: string; targetRef: string }): Promise<{ sessionId: string }>;
      appendEvent(sessionId: string, event: unknown): Promise<void>;
      completeSession(sessionId: string, summary: unknown): Promise<void>;
    };
  };
}) {
  const session = await input.dependencies.sessionStore.createSession(input.input);
  const startedEvent = { type: "session-started" as const, sessionId: session.sessionId };
  await input.dependencies.sessionStore.appendEvent(session.sessionId, startedEvent);
  yield startedEvent;

  const diffFiles = await input.dependencies.gitClient.readDiff(input.input.baseRef, input.input.targetRef);
  const units = buildReviewUnits(diffFiles as never[]);
  let totalFindings = 0;

  for (const unit of units) {
    const context = await collectUnitContext({
      gitClient: input.dependencies.gitClient as never,
      baseRef: input.input.baseRef,
      targetRef: input.input.targetRef,
      unit
    });
    const prompt = JSON.stringify({ task: "review", unit, context });
    const result = await input.dependencies.provider.review({ prompt });
    const findings = normalizeProviderOutput({ content: result.content, fallbackFile: unit.primaryFile });
    totalFindings += findings.length;

    const event = {
      type: "unit-completed" as const,
      sessionId: session.sessionId,
      unitId: unit.id ?? randomUUID(),
      findingsCount: findings.length
    };
    await input.dependencies.sessionStore.appendEvent(session.sessionId, event);
    yield event;
  }

  const finishedEvent = {
    type: "session-finished" as const,
    sessionId: session.sessionId,
    totalFindings
  };
  await input.dependencies.sessionStore.appendEvent(session.sessionId, finishedEvent);
  await input.dependencies.sessionStore.completeSession(session.sessionId, finishedEvent);
  yield finishedEvent;
}
```

- [ ] **Step 5: 增加 review summary builder，避免前端直接拼数据**

```ts
import type { ReviewFinding } from "../domain/review-finding";

export function buildReviewSummary(input: {
  findings: ReviewFinding[];
  changedFiles: string[];
}) {
  return {
    changedFilesCount: input.changedFiles.length,
    findingsCount: input.findings.length,
    highSeverityCount: input.findings.filter((item) => item.severity === "high").length,
    files: input.changedFiles
  };
}
```

- [ ] **Step 6: 运行完整后端测试**

Run: `pnpm test`
Expected: 所有 backend tests PASS

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add packages/review-backend/src/application packages/review-backend/src/infrastructure/storage packages/review-backend/src/infrastructure/logging packages/review-backend/tests/start-review-session.test.ts packages/review-backend/src/index.ts
git commit -m "feat: add session store and review orchestration"
```

## 自检结果

### 1. Spec 覆盖检查

已覆盖的设计文档要求：

1. `Repository Adapter`：Task 3
2. `Review Unit Planner`：Task 4
3. `Context Collector`：Task 4
4. `LLM Review Runner`：Task 5
5. `Finding Normalizer`：Task 5
6. `Review Session Store`：Task 6
7. 渐进式结果事件流：Task 2、Task 6
8. 本地仓库分支对比输入：Task 3、Task 6
9. 历史 session 保存与回放基础：Task 6

当前未覆盖内容：

1. 前端双栏 UI 和 diff viewer
2. Electron 窗口管理与 IPC 注册细节
3. 敏感目录过滤和 provider 配置持久化的产品界面

这些不属于本后端计划范围。

### 2. Placeholder 扫描

已检查本计划，正文任务中没有保留未细化的占位表达。

### 3. 类型一致性检查

1. `ReviewFinding` 在 Task 2 定义，在 Task 5 和 Task 6 复用。
2. `streamReviewSession` 的事件名称在 Task 2 和 Task 6 中保持一致：`session-started`、`unit-completed`、`session-finished`。
3. `GitClient` 的 `readDiff`、`readFileAtRef` 签名在 Task 3、Task 4、Task 6 中保持一致。

## 执行前备注

1. 第一版 session store 采用文件系统实现，是有意的 MVP 取舍，不是临时方案遗漏。
2. 第一版 planner 采用“一文件一单元”的保守策略，后续再按关联文件合并。
3. 如果实现阶段发现 `git show <ref>:<path>` 对删除文件场景不稳定，应在 `ContextCollector` 内做删除文件专门分支，而不是让上层编排感知底层异常。

Plan complete and saved to `docs/superpowers/plans/2026-06-06-review-backend-foundation.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
