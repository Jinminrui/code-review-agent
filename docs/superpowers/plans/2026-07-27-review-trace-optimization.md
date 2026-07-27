# Review Trace 优化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 降低 Plan 降级概率和小变更集成本，并让 trace 能直接解释预算与校验失败原因。

**Architecture:** 在现有 Plan stage 增加结构化校验诊断；在 orchestrator 的 Plan 入口按确定性规模选择小变更集 fallback；在 session 编排内集中记录 budget degradation reason；扩展日志读取的安全字段白名单。保持现有 IPC 和事件 schema。

**Tech Stack:** TypeScript 5、Vitest、Zod、Pino、pnpm workspace。

---

### Task 1: 固化 Plan 校验诊断

**Files:**
- Modify: `packages/review-backend/src/application/review-plan-stage.ts`
- Modify: `packages/review-backend/src/infrastructure/llm/plan-provider.ts`
- Test: `packages/review-backend/tests/review-plan-stage.test.ts`

- [ ] 为缺失、重复和越界文件增加失败测试，断言错误中包含具体文件。
- [ ] 将 Plan 校验错误详情传入重试提示，且不改变最终 fallback。
- [ ] 运行 `pnpm --filter @app/review-backend test -- tests/review-plan-stage.test.ts`。

### Task 2: 小变更集跳过模型 Plan

**Files:**
- Modify: `packages/review-backend/src/application/review-orchestrator.ts`
- Test: `packages/review-backend/tests/review-orchestrator.test.ts`

- [ ] 增加单文件小 diff 的失败测试，断言 Plan stage 不被调用且使用确定性计划。
- [ ] 在 Plan 前按变更文件数和 diff 行数选择 deterministic fallback。
- [ ] 运行 orchestrator 定向测试。

### Task 3: 统一预算诊断

**Files:**
- Modify: `packages/review-backend/src/application/review-orchestrator.ts`
- Test: `packages/review-backend/tests/review-orchestrator.test.ts`

- [ ] 增加预算超限事件/结果诊断的失败测试。
- [ ] 集中记录 `budgetUsed`、`budgetLimit` 和 `degradationReasons`，保留现有 status 语义。
- [ ] 运行 orchestrator 与 session 相关测试。

### Task 4: 扩展安全日志查询字段

**Files:**
- Modify: `packages/review-backend/src/infrastructure/logging/read-logs.ts`
- Test: `packages/review-backend/tests/read-logs.test.ts`

- [ ] 增加诊断字段白名单测试，并断言 prompt、源码和 API key 不返回。
- [ ] 扩展白名单到 stage、code、message、durationMs、token usage 等字段。
- [ ] 运行日志测试。

### Task 5: 全量验证

- [ ] 运行 `pnpm --filter @app/review-backend test`。
- [ ] 运行 `pnpm typecheck`。
- [ ] 检查 `git diff --check` 和改动范围。
