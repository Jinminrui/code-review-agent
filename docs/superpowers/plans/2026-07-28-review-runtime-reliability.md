# Review Runtime Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** 隔离非法文件级 Reflection candidate，压缩并保护 Global Reflection 输入，完整记录阶段诊断，并在 Global 失败或超时时保留合法文件级 findings。

**Architecture:** 在 review-result-validation 之后增加纯函数边界层，将正式 findings、合法 evidence 和非法 candidates 分离；Global Reflection 只接收精简投影。编排层统一聚合各阶段 usage 和诊断，Global 阶段采用软预算、单次受控调用和文件级结果回退。session 新字段全部可选，保持旧事件和旧 summary 可读取。

**Tech Stack:** TypeScript 5、Zod、Vitest、Electron 文件 session store、OpenAI-compatible tool calling。

---

## 1. 文件地图与职责

### 新增文件

- packages/review-backend/src/application/global-review-input.ts
  - 定义文件级结果到 Global 输入的确定性清洗和精简投影。
  - 隔离非法 candidate，生成 unadopted 和结构化原因。
- packages/review-backend/tests/global-review-input.test.ts
  - 覆盖重复 finding、错配 evidence、合法 candidate 和精简输入。

### 修改文件

- packages/review-backend/src/application/global-review-reflection-stage.ts
  - 使用精简 Global 输入。
  - 以正式 findings 和 evidence 投影为准，不让单个非法 candidate 阻塞全局。
- packages/review-backend/src/infrastructure/llm/reflection-provider.ts
  - 增加 allowedFindingIds、allowedEvidenceIds 和精简 Global message 类型。
  - 返回 provider usage，供编排层累计。
- packages/review-backend/src/application/review-reflection-stage.ts
  - 传递文件级 Reflection 和 Backfill usage、状态及失败原因。
- packages/review-backend/src/application/review-orchestrator.ts
  - 聚合 Plan、ReAct、Reflection、Backfill、Global Reflection usage。
  - 添加阶段诊断、Global 软预算、单次受控调用和文件级回退。
- packages/review-backend/src/application/review-react-stage.ts
  - 保留已有 stopReason，确保阶段诊断能记录 missingCheckIds。
- packages/review-backend/src/domain/review-runtime.ts
  - 增加 StageDiagnostic、StageUsage 和诊断 schema。
- packages/review-backend/src/domain/review-session.ts
  - 为 phase event 的 unitResult 和 session detail 增加可选诊断字段。
- packages/review-backend/src/infrastructure/storage/file-session-store.ts
  - 读取旧 summary 时补充空诊断默认值，写入新 summary 时保留可选字段。
- packages/review-backend/tests/review-reflection-stage.test.ts
  - 增加 Global 输入清洗、失败回退、Global 输出非法和 prompt 白名单测试。
- packages/review-backend/tests/review-orchestrator.test.ts
  - 增加全阶段 usage 聚合、Global 超预算仍调用、超时回退和诊断持久化测试。
- packages/review-backend/tests/review-session-types.test.ts
  - 增加诊断字段 schema 兼容测试。
- packages/review-backend/tests/file-session-store.test.ts
  - 增加旧 summary 无诊断字段时的读取测试。
- packages/review-backend/tests/review-session-recovery.test.ts
  - 验证新诊断字段不影响恢复边界和已完成 Unit 复用。

### 不修改

- renderer IPC 接口。
- finding 业务字段和 severity 定义。
- git、tool executor、Plan provider 的既有行为。

## 2. Task 1：建立诊断与 usage 领域契约

**Files:**

- Modify: packages/review-backend/src/domain/review-runtime.ts
- Modify: packages/review-backend/src/domain/review-session.ts
- Test: packages/review-backend/tests/review-session-types.test.ts

- [ ] **Step 1: 写失败测试，定义新诊断结构可以通过 schema**

在 review-session-types.test.ts 增加以下行为测试：

```ts
it("接受可选的阶段诊断和 Global 回退信息", () => {
  const detail = reviewSessionDetailSchema.parse({
    sessionId: "s-diagnostics",
    status: "partial",
    repositoryPath: "/repo",
    baseRef: "main",
    targetRef: "feature",
    summary: {
      changedFilesCount: 1,
      findingsCount: 1,
      highSeverityCount: 1,
      files: ["src/auth.ts"]
    },
    findings: [],
    diffByFile: {},
    diagnostics: {
      stageDiagnostics: [{
        stage: "global-reflection",
        status: "failed",
        reason: "duplicate-finding-id",
        usage: { modelCalls: 1, toolCalls: 0, durationMs: 100 }
      }],
      globalFallback: { used: true, reason: "global-reflection-failed" }
    }
  });

  expect(detail.diagnostics?.stageDiagnostics).toHaveLength(1);
});

it("旧 session detail 没有 diagnostics 时仍然通过校验", () => {
  expect(reviewSessionDetailSchema.parse(validLegacyDetail())).not.toHaveProperty("diagnostics");
});
```

- [ ] **Step 2: 运行测试确认当前 schema 不支持新字段**

运行：

```bash
pnpm --filter @app/review-backend test -- review-session-types.test.ts
```

预期：新增测试失败，失败原因是 diagnostics 未被 schema 接受或未出现在解析结果中。

- [ ] **Step 3: 在 review-runtime.ts 增加最小诊断类型**

实现以下 schema，并导出推导类型：

```ts
export const stageUsageSchema = z.object({
  inputTokens: z.number().int().nonnegative().optional(),
  outputTokens: z.number().int().nonnegative().optional(),
  modelCalls: z.number().int().nonnegative(),
  toolCalls: z.number().int().nonnegative(),
  readBytes: z.number().int().nonnegative().optional(),
  durationMs: z.number().int().nonnegative(),
  usageUnavailable: z.boolean().optional()
});

export const stageDiagnosticSchema = z.object({
  stage: z.enum(["plan", "react", "reflection", "backfill", "global-reflection"]),
  unitId: z.string().min(1).optional(),
  status: z.enum(["completed", "incomplete", "failed", "fallback"]),
  reason: z.string().min(1).optional(),
  details: z.record(z.unknown()).optional(),
  usage: stageUsageSchema.optional()
});

export type StageUsage = z.infer<typeof stageUsageSchema>;
export type StageDiagnostic = z.infer<typeof stageDiagnosticSchema>;
```

- [ ] **Step 4: 在 review-session.ts 增加可选 diagnostics**

新增 diagnostics schema：

```ts
const reviewSessionDiagnosticsSchema = z.object({
  stageDiagnostics: z.array(stageDiagnosticSchema).default([]),
  globalFallback: z.object({
    used: z.boolean(),
    reason: z.string().min(1).optional()
  }).optional()
}).optional();
```

将其挂到 reviewSessionDetailSchema，并在 phase event 的 unitResult 上增加可选 diagnostics，不修改旧事件必填字段。

- [ ] **Step 5: 运行 session schema 测试**

运行：

```bash
pnpm --filter @app/review-backend test -- review-session-types.test.ts
```

预期：新增测试和原有 session schema 测试全部通过。

- [ ] **Step 6: 提交契约变更**

```bash
git add packages/review-backend/src/domain/review-runtime.ts packages/review-backend/src/domain/review-session.ts packages/review-backend/tests/review-session-types.test.ts
git commit -m "feat(runtime): add stage diagnostics contract"
```

## 3. Task 2：实现文件级结果边界清洗

**Files:**

- Create: packages/review-backend/src/application/global-review-input.ts
- Create: packages/review-backend/tests/global-review-input.test.ts
- Reference: packages/review-backend/src/application/review-result-validation.ts
- Reference: packages/review-backend/src/domain/reflection-result.ts

- [ ] **Step 1: 写非法 candidate 隔离的失败测试**

构造正式 finding、合法 candidate 和引用 reflection-evidence-1 的非法 candidate，调用 sanitizeFileResultForGlobal，断言非法候选被隔离：

```ts
const result = sanitizeFileResultForGlobal({
  unitId: "unit-auth",
  file: "src/auth.ts",
  findings: [finding({ id: "weak-password-validation", file: "src/auth.ts" })],
  reflectionResult: reflectionResult([
    reflectionCandidate(
      finding({ id: "weak-password-validation", file: "src/auth.ts" }),
      ["unit-auth-evidence-1"]
    ),
    reflectionCandidate(
      finding({ id: "hardcoded-jwt-secret", file: "src/auth.ts" }),
      ["reflection-evidence-1"]
    )
  ]),
  evidenceSummary: evidenceSummary("unit-auth", ["unit-auth-evidence-1"])
});

expect(result.fileResult.reflectionResult.candidates).toHaveLength(1);
expect(result.rejectedCandidates).toContainEqual(expect.objectContaining({
  reason: "finding-id-not-allowed"
}));
```

- [ ] **Step 2: 运行测试确认清洗函数尚不存在**

运行：

```bash
pnpm --filter @app/review-backend test -- global-review-input.test.ts
```

预期：测试因缺少 sanitizeFileResultForGlobal 失败。

- [ ] **Step 3: 定义清洗结果和原因类型**

在新文件中实现：

```ts
export type GlobalCandidateRejectionReason =
  | "finding-id-not-allowed"
  | "finding-id-duplicate"
  | "evidence-id-not-owned"
  | "finding-content-mismatch"
  | "file-not-owned";

export type GlobalCandidateRejection = {
  candidate: ReflectionCandidate;
  reason: GlobalCandidateRejectionReason;
  unitId: string;
};

export type SanitizedGlobalFileResult = {
  fileResult: GlobalReflectionFileResult;
  rejectedCandidates: GlobalCandidateRejection[];
};
```

- [ ] **Step 4: 实现最小确定性过滤**

过滤顺序固定为：

1. 从 findings 建立正式 findingId 集合。
2. 从 Evidence 摘要建立当前 Unit 的 evidenceId 集合。
3. 拒绝 findingId 不在正式集合中的 candidate。
4. 拒绝 evidenceId 不在当前 Unit 集合中的 candidate。
5. 拒绝 finding 文件不等于当前 Unit 文件的 candidate。
6. 同一 findingId 只保留一个内容完全一致的 candidate。
7. 过滤后的 candidates 才进入 Global fileResult。

不要在此处改变正式 findings，只过滤 reflectionResult.candidates 并返回 rejected 轨迹。

- [ ] **Step 5: 增加合法、重复和证据错配测试**

至少验证合法 candidate 保留，且 rejected reason 依次覆盖 finding-id-not-allowed、evidence-id-not-owned、file-not-owned。

- [ ] **Step 6: 运行边界测试**

运行：

```bash
pnpm --filter @app/review-backend test -- global-review-input.test.ts
```

预期：所有边界测试通过。

- [ ] **Step 7: 提交边界清洗**

```bash
git add packages/review-backend/src/application/global-review-input.ts packages/review-backend/tests/global-review-input.test.ts
git commit -m "fix(reflection): isolate invalid global candidates"
```

## 4. Task 3：压缩 Global 输入并强化 Prompt

**Files:**

- Modify: packages/review-backend/src/infrastructure/llm/reflection-provider.ts
- Modify: packages/review-backend/src/application/global-review-reflection-stage.ts
- Test: packages/review-backend/tests/review-reflection-stage.test.ts

- [ ] **Step 1: 写 Global 输入投影和 Prompt 失败测试**

断言 provider user message 包含 stage、units、unitId、file、findings 和 evidence，但不包含完整 fileResults 或 raw diff：

```ts
const payload = JSON.parse(provider.chat.mock.calls[0]![0].messages[1]!.content);

expect(payload).toMatchObject({
  stage: "global-reflection",
  units: [{
    unitId: "unit-auth",
    file: "src/auth.ts",
    findings: [expect.objectContaining({ id: "finding-auth" })],
    evidence: [expect.objectContaining({ id: "evidence-auth" })]
  }]
});
expect(payload).not.toHaveProperty("fileResults");
expect(JSON.stringify(payload)).not.toContain("raw diff content");
```

同时断言 system prompt 明确不得新增 finding、不得引用不存在 evidenceId。

- [ ] **Step 2: 运行测试确认当前 Global 输入仍包含完整 fileResults**

运行：

```bash
pnpm --filter @app/review-backend test -- review-reflection-stage.test.ts
```

预期：新增投影断言失败，现有测试保持通过。

- [ ] **Step 3: 定义精简 Global 输入类型**

在 reflection-provider.ts 增加：

```ts
export type GlobalReviewInput = {
  units: Array<{
    unitId: string;
    file: string;
    findings: Array<{
      id: string;
      severity: ReviewFinding["severity"];
      summary: string;
      explanation: string;
      suggestion: string;
      evidenceIds: string[];
    }>;
    evidence: Array<{
      id: string;
      checkId: string;
      source: EvidenceSource;
      summary: string;
    }>;
  }>;
};
```

- [ ] **Step 4: 修改 Global message builder 只发送投影**

将 buildGlobalReviewReflectionMessages 的输入改为 GlobalReviewInput，user message 固定为 stage 和 units，不再发送完整 reviewPlan、原始 fileResults、完整 diff 或未过滤 candidates。

- [ ] **Step 5: 强化 Global system prompt**

增加以下约束：

```text
只能处理输入 units.findings 中已有的 finding。
禁止新增 finding、修改文件、修改行号或扩大问题范围。
candidate.finding.id 必须来自输入正式 finding。
evidenceIds 必须来自同一 unit 的 evidence。
finding id 在结果中必须唯一。
```

- [ ] **Step 6: 运行 Reflection 测试**

运行：

```bash
pnpm --filter @app/review-backend test -- review-reflection-stage.test.ts
```

预期：Global prompt、输入投影和既有 Reflection 测试全部通过。

- [ ] **Step 7: 提交 Global 输入改造**

```bash
git add packages/review-backend/src/infrastructure/llm/reflection-provider.ts packages/review-backend/src/application/global-review-reflection-stage.ts packages/review-backend/tests/review-reflection-stage.test.ts
git commit -m "refactor(reflection): compact global review input"
```

## 5. Task 4：让 Global 阶段使用合法结果并回退

**Files:**

- Modify: packages/review-backend/src/application/global-review-reflection-stage.ts
- Modify: packages/review-backend/src/application/review-orchestrator.ts
- Test: packages/review-backend/tests/review-reflection-stage.test.ts
- Test: packages/review-backend/tests/review-orchestrator.test.ts

- [ ] **Step 1: 写 trace 形态的失败测试**

构造 unit-config 和 unit-auth 都出现 hardcoded-jwt-secret candidate，且 unit-auth 引用 reflection-evidence-1。断言非法候选进入 unadopted，合法文件级 findings 继续保留。

```ts
const result = await runGlobalReviewReflectionStage(input);

expect(result.status).toBe("completed");
expect(result.unadopted).toContainEqual(expect.objectContaining({
  finding: expect.objectContaining({ id: "hardcoded-jwt-secret" }),
  decisionReason: expect.stringContaining("evidence")
}));
```

- [ ] **Step 2: 运行测试确认当前实现仍返回 invalid-global-input**

运行：

```bash
pnpm --filter @app/review-backend test -- review-reflection-stage.test.ts
```

预期：新增测试失败，当前实现将整个 Global 输入标记为 invalid-global-input。

- [ ] **Step 3: 在 Global stage 入口清洗每个 fileResult**

调用 sanitizeFileResultForGlobal，累积 rejected candidates 到 unadopted 初始集合，用过滤后的 fileResult 和 evidence summary 构造 GlobalReviewInput，只对过滤后的正式 findings 做唯一性校验。

- [ ] **Step 4: 修改 Global 输出校验**

Global 输出 candidate 必须满足：

```text
candidate.finding.id 属于 projectedFindingIds
candidate.evidenceIds 属于 projectedEvidenceIds
candidate.finding.file 与 projected finding 一致
candidate.finding.id 全局唯一
```

非法 Global candidate 转为 needs-review 的 unadopted，不覆盖文件级 findings。

- [ ] **Step 5: 增加 provider 失败和超时回退测试**

在 review-orchestrator.test.ts 断言 session status 为 partial、summary.findings 包含文件级合法结果，且 diagnostics.globalFallback.used 为 true。

- [ ] **Step 6: 运行 Global 和 orchestrator 测试**

运行：

```bash
pnpm --filter @app/review-backend test -- review-reflection-stage.test.ts review-orchestrator.test.ts
```

预期：重复 finding 和错配 evidence 场景不再清空合法 findings。

- [ ] **Step 7: 提交 Global 容错**

```bash
git add packages/review-backend/src/application/global-review-reflection-stage.ts packages/review-backend/src/application/review-orchestrator.ts packages/review-backend/tests/review-reflection-stage.test.ts packages/review-backend/tests/review-orchestrator.test.ts
git commit -m "fix(reflection): fallback to valid file findings"
```

## 6. Task 5：统一阶段 usage 与 Global 软预算

**Files:**

- Modify: packages/review-backend/src/infrastructure/llm/reflection-provider.ts
- Modify: packages/review-backend/src/application/review-reflection-stage.ts
- Modify: packages/review-backend/src/application/global-review-reflection-stage.ts
- Modify: packages/review-backend/src/application/review-orchestrator.ts
- Test: packages/review-backend/tests/review-orchestrator.test.ts

- [ ] **Step 1: 写 Global usage 聚合失败测试**

让 fake provider 返回 inputTokens 1300、outputTokens 300，断言 summary diagnostics.budgetUsed 和 global-reflection stage diagnostic 都包含 usage。

- [ ] **Step 2: 运行测试确认 Global usage 当前未被累计**

运行：

```bash
pnpm --filter @app/review-backend test -- review-orchestrator.test.ts
```

预期：新增 Global usage 断言失败，现有测试保持通过。

- [ ] **Step 3: 让 Reflection provider 返回 usage**

将 requestReviewReflection 和 requestGlobalReviewReflection 返回值扩展为：

```ts
type ReflectionProviderResponse = {
  result: ReflectionResult;
  usage: StageUsage;
};
```

provider 缺少 usage 时使用 usageUnavailable true，不伪造 token 数量。

- [ ] **Step 4: 让 Reflection stage 透传 usage 和状态**

文件级 Reflection 返回可选 usage、backfillUsage 和 diagnostic；Backfill 的 toolCalls、readBytes、durationMs 必须计入。

- [ ] **Step 5: 在 orchestrator 中统一累计所有阶段**

增加并测试 addStageUsage(total, stage) 纯函数，累加 inputTokens、outputTokens、modelCalls、toolCalls、readBytes、durationMs，并传播 usageUnavailable。

- [ ] **Step 6: 实现 Global 软预算和单次硬保护**

进入 Global 前估算精简输入 token；超限时记录 context-budget-exceeded，但仍调用一次。使用独立 AbortController 限制最大时长，失败或超时则回退文件级 findings，并设置 globalFallback.used 为 true。禁止因软预算重复调用多次。

- [ ] **Step 7: 运行预算与回退测试**

运行：

```bash
pnpm --filter @app/review-backend test -- review-orchestrator.test.ts
```

预期：Global 超预算仍调用一次；失败时合法 findings 保留；usage 汇总包含 Global。

- [ ] **Step 8: 提交预算改造**

```bash
git add packages/review-backend/src/infrastructure/llm/reflection-provider.ts packages/review-backend/src/application/review-reflection-stage.ts packages/review-backend/src/application/global-review-reflection-stage.ts packages/review-backend/src/application/review-orchestrator.ts packages/review-backend/tests/review-orchestrator.test.ts
git commit -m "perf(runtime): bound and account for global reflection"
```

## 7. Task 6：持久化阶段诊断并保持恢复兼容

**Files:**

- Modify: packages/review-backend/src/application/review-orchestrator.ts
- Modify: packages/review-backend/src/domain/review-session.ts
- Modify: packages/review-backend/src/infrastructure/storage/file-session-store.ts
- Test: packages/review-backend/tests/file-session-store.test.ts
- Test: packages/review-backend/tests/review-session-recovery.test.ts
- Test: packages/review-backend/tests/review-orchestrator.test.ts

- [ ] **Step 1: 写旧 summary 兼容测试**

写入没有 diagnostics 的旧 summary，读取后确认旧字段正常；写入带 diagnostics 的新 summary，确认字段原样保留。

- [ ] **Step 2: 运行持久化测试确认基线**

运行：

```bash
pnpm --filter @app/review-backend test -- file-session-store.test.ts review-session-recovery.test.ts
```

预期：旧测试通过；新增 diagnostics 保留测试在实现前失败。

- [ ] **Step 3: 在 orchestrator 记录每个阶段诊断**

每个 Unit 记录 react、reflection、backfill 的 status、reason、missingCheckIds、backfillRequested 和 usage；Global 记录状态、失败原因、usage 和回退信息。

- [ ] **Step 4: 将 diagnostics 写入 summary，不改变旧事件顺序**

completeSession 的 summary 增加 budgetUsed、budgetLimit、degradationReasons、stageDiagnostics 和 globalFallback。旧 phase-transitioned 事件仍可读取；新增字段只作为可选字段附加。

- [ ] **Step 5: 验证恢复行为**

确认 unit-completed 的 findings/evidence 仍可复用，诊断不会改变安全恢复边界，Global 阶段失败可从 global-reflection-validating 重新执行。

- [ ] **Step 6: 运行持久化和编排测试**

运行：

```bash
pnpm --filter @app/review-backend test -- file-session-store.test.ts review-session-recovery.test.ts review-orchestrator.test.ts
```

预期：旧 session、新 diagnostics、恢复和回退路径全部通过。

- [ ] **Step 7: 提交诊断持久化**

```bash
git add packages/review-backend/src/application/review-orchestrator.ts packages/review-backend/src/domain/review-session.ts packages/review-backend/src/infrastructure/storage/file-session-store.ts packages/review-backend/tests/file-session-store.test.ts packages/review-backend/tests/review-session-recovery.test.ts packages/review-backend/tests/review-orchestrator.test.ts
git commit -m "feat(runtime): persist stage diagnostics"
```

## 8. Task 7：补齐 trace replay 与全量验证

**Files:**

- Create: packages/review-backend/tests/fixtures/traces/c8f46d72-global-invalid-candidate.json
- Modify: packages/review-backend/tests/review-reflection-stage.test.ts
- Modify: packages/review-backend/tests/review-orchestrator.test.ts
- Modify: docs/superpowers/specs/2026-07-28-review-runtime-reliability-design.md

- [ ] **Step 1: 保存脱敏 trace fixture**

fixture 只保留 traceId、非法 unitId/findingId/evidenceIds 和预期结果，不保存 prompt、源码原文或 provider 原始响应全文。

```json
{
  "traceId": "c8f46d72-b869-4553-a290-01cc2a9efadf",
  "invalidCandidate": {
    "unitId": "unit-auth",
    "findingId": "hardcoded-jwt-secret",
    "evidenceIds": ["reflection-evidence-1"]
  },
  "expected": {
    "illegalCandidateIsUnadopted": true,
    "validFileFindingsPreserved": true
  }
}
```

- [ ] **Step 2: 增加 trace 级回归测试**

断言非法 candidate 被隔离、合法文件级 findings 保留、错误结果不会抛出原始 ZodError。

- [ ] **Step 3: 运行后端全量测试**

运行：

```bash
pnpm --filter @app/review-backend test
```

预期：全部测试通过，新增 trace replay 覆盖非法 candidate、Global 回退和诊断字段。

- [ ] **Step 4: 运行类型检查和格式检查**

运行：

```bash
pnpm --filter @app/review-backend exec tsc --noEmit -p tsconfig.json
git diff --check
```

预期：TypeScript 无错误，git diff --check 无输出。

- [ ] **Step 5: 更新 spec 状态和验证记录**

仅在全量测试、类型检查和 trace replay 均通过后，将 spec 的 Status 从 Proposed 更新为 Implemented，并补充实际测试命令和结果。

- [ ] **Step 6: 提交验证与 fixture**

```bash
git add packages/review-backend/tests/fixtures/traces/c8f46d72-global-invalid-candidate.json packages/review-backend/tests/review-reflection-stage.test.ts packages/review-backend/tests/review-orchestrator.test.ts docs/superpowers/specs/2026-07-28-review-runtime-reliability-design.md
git commit -m "test(runtime): replay global reflection failure trace"
```

## 9. 计划自检

### Spec 覆盖

- 非法 candidate 隔离：Task 2、Task 4。
- finding/evidence 归属校验：Task 2、Task 4。
- Global 输入精简：Task 3。
- Global 超预算继续调用一次：Task 5。
- Global 失败回退：Task 4、Task 5。
- 全阶段 usage：Task 5。
- 阶段诊断：Task 1、Task 6。
- 历史 session 兼容：Task 1、Task 6。
- trace replay 和验收：Task 7。

### 类型一致性

1. StageUsage 在 review-runtime.ts 定义，Reflection provider、orchestrator 和 diagnostics schema 共用。
2. GlobalReviewInput 在 reflection-provider.ts 定义，Global stage 负责构造。
3. GlobalCandidateRejection 在 global-review-input.ts 定义，Global stage 负责转为 unadopted。
4. stageDiagnostics 和 globalFallback 都是 session detail 的可选字段。

### 占位符检查

本计划没有 TBD、TODO 或未定义的实现任务；每个任务都包含具体文件、测试命令和验收结果。
