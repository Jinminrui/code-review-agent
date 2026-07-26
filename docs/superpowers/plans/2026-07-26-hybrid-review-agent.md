# 混合范式代码审查 Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有 Electron + TypeScript 代码审查 Agent 中实现“确定性预分析 → Plan-and-Solve → 受限 ReAct → Reflection 校验”的可回放运行时，并完成前端阶段可视化与新旧运行时对比迁移。

**Architecture:** 新增一个由 `ReviewOrchestrator` 驱动的显式阶段状态机。Plan、ReAct、Reflection 通过版本化 Zod contract 传递结构化数据；ReAct 只调用计划授权的只读工具，Reflection 负责语义决策，工程代码负责证据、定位、去重和降级。旧 `runToolUseLoop` 保留为兼容路径，按 feature flag 与新运行时并行验证。

**Tech Stack:** Node.js 22、TypeScript 5、Zod、Vitest、React 19、Zustand、TanStack Query、Electron IPC、现有 GitClient / SessionStore / OpenAI-compatible provider。

---

## 文件地图

### 后端新增

- `packages/review-backend/src/domain/review-runtime.ts`：运行时阶段、预算、能力、版本和状态转移类型。
- `packages/review-backend/src/domain/review-evidence.ts`：预分析摘要、证据包和工具轨迹 contract。
- `packages/review-backend/src/domain/reflection-result.ts`：Reflection 输出和补证请求 contract。
- `packages/review-backend/src/application/review-orchestrator.ts`：阶段状态机和 session 编排入口。
- `packages/review-backend/src/application/review-pre-analysis.ts`：确定性变更集预分析。
- `packages/review-backend/src/application/review-plan-stage.ts`：全局 Plan 和文件子计划校验。
- `packages/review-backend/src/application/review-react-stage.ts`：受限 ReAct 调度与证据包生成。
- `packages/review-backend/src/application/review-reflection-stage.ts`：文件级/全局 Reflection 和补证控制。
- `packages/review-backend/src/application/review-result-validation.ts`：finding 证据、定位、去重和降级。
- `packages/review-backend/src/infrastructure/llm/review-stage-prompts.ts`：三个阶段独立 prompt。
- `packages/review-backend/src/infrastructure/llm/plan-provider.ts`：版本化结构化 Plan provider 适配。
- `packages/review-backend/src/infrastructure/llm/reflection-provider.ts`：版本化结构化 Reflection provider 适配。
- `packages/review-backend/src/infrastructure/llm/plan-authorizer.ts`：工具调用和范围预算授权。
- `packages/review-backend/src/infrastructure/runtime-feature-flags.ts`：新旧运行时切换配置。

### 后端修改

- `packages/review-backend/src/domain/review-session.ts`：扩展阶段事件、恢复元数据和新 session 状态。
- `packages/review-backend/src/domain/review-plan.ts`：替换旧的单层计划 schema，保留迁移函数。
- `packages/review-backend/src/domain/provider.ts`：增加 provider capability contract 和 structured output 约束。
- `packages/review-backend/src/domain/tool.ts`：移除 ReAct 对 `code_comment` / `task_done` 的授权，保留旧格式兼容解析。
- `packages/review-backend/src/application/stream-review-session.ts`：按 feature flag 调用新 orchestrator 或旧路径。
- `packages/review-backend/src/infrastructure/llm/tool-executors.ts`：支持授权上下文、调用摘要和内容 hash。
- `packages/review-backend/src/infrastructure/storage/file-session-store.ts`：保存版本化阶段事件并支持边界恢复。
- `packages/review-backend/src/index.ts`、`packages/review-backend/src/infrastructure/index.ts`：导出新 contract 和 orchestrator。

### 后端测试新增/修改

- `packages/review-backend/tests/review-pre-analysis.test.ts`
- `packages/review-backend/tests/review-plan-stage.test.ts`
- `packages/review-backend/tests/plan-authorizer.test.ts`
- `packages/review-backend/tests/review-react-stage.test.ts`
- `packages/review-backend/tests/review-reflection-stage.test.ts`
- `packages/review-backend/tests/review-result-validation.test.ts`
- `packages/review-backend/tests/review-orchestrator.test.ts`
- `packages/review-backend/tests/review-session-recovery.test.ts`
- `packages/review-backend/tests/provider-capabilities.test.ts`
- `packages/review-backend/tests/stream-review-session.hybrid.test.ts`
- 修改现有 `tool-executors.test.ts`、`stream-review-session.partial.test.ts`、`file-session-store.test.ts`。

### 前端新增/修改

- `packages/review-app/src/lib/review-model.ts`：解析阶段事件、预算和校验状态。
- `packages/review-app/src/hooks/use-review-session-stream.ts`：消费新阶段事件并保留旧事件兼容。
- `packages/review-app/src/components/session/session-progress.tsx`：展示五阶段进度和当前检查项。
- `packages/review-app/src/components/session/review-trace-panel.tsx`：可展开显示计划、工具摘要、证据和 Reflection 结论。
- `packages/review-app/src/components/session/finding-card.tsx`：显示已校验、待确认、未采纳状态。
- `packages/review-app/tests/review-trace-panel.test.tsx`、`session-progress.test.tsx`、`review-model.test.ts`。

### 文档与评测

- `docs/superpowers/specs/2026-07-26-hybrid-review-agent-design.md`：本设计基线。
- `docs/prompts/plan-prompt.md`、`docs/prompts/review-prompt.md`、`docs/prompts/system-prompt.md`：迁移为阶段独立 prompt 或由新 prompt 文件引用。
- `docs/evals/hybrid-review-golden-corpus.md`：golden corpus 组织方式和指标定义。
- `docs/adr/0007-hybrid-review-orchestrator.md`：记录新旧运行时并行迁移和状态机决策。

## 实施顺序

### Task 1: 固化 Contract、版本和 provider 能力

**Files:**
- Create: `packages/review-backend/src/domain/review-runtime.ts`
- Create: `packages/review-backend/src/domain/review-evidence.ts`
- Create: `packages/review-backend/src/domain/reflection-result.ts`
- Modify: `packages/review-backend/src/domain/review-session.ts`
- Modify: `packages/review-backend/src/domain/review-plan.ts`
- Modify: `packages/review-backend/src/domain/provider.ts`
- Test: `packages/review-backend/tests/review-session-types.test.ts`
- Test: `packages/review-backend/tests/provider-capabilities.test.ts`

- [x] 写 schema 失败测试：合法阶段事件通过；缺少 `schemaVersion`、非法阶段转移、负预算和未授权工具名失败。
- [x] 写 provider capability 失败测试：structured output、tool calling、usage、cancellation 缺失时能被识别。
- [x] 实现 `ReviewRuntimePhase`、`PhaseBudget`、`ReviewRuntimeMetadata`、`EvidenceBundle`、`ReflectionResult` 及对应 schema。
- [x] 将旧 `ReviewPlan` 迁移为包含 `version`、`riskAreas`、`units`、`completionCriteria` 和 `allowedFiles` 的全局计划；提供旧计划读取迁移函数。
- [x] 扩展 session event union，所有新增事件包含 `schemaVersion`、`phase` 和可选 `unitId`。
- [x] 运行 `pnpm --filter @app/review-backend test -- review-session-types provider-capabilities`，预期全部通过。
- [x] 运行 `pnpm typecheck`，预期通过；此任务只提交 contract，不接入编排器。

### Task 2: 实现确定性预分析

**Files:**
- Create: `packages/review-backend/src/application/review-pre-analysis.ts`
- Test: `packages/review-backend/tests/review-pre-analysis.test.ts`

- [x] 写测试：给定多个 `ParsedDiffFile`，输出稳定排序的文件事实、增删统计、语言和敏感路径线索。
- [x] 写测试：相同输入多次运行结果相同；空 diff 输出空变更集而非异常。
- [x] 实现只消费 `ParsedDiffFile[]` 的纯函数，不读取模型、不搜索仓库、不访问 UI。
- [x] 将路径分类限定为现有变更文件；敏感路径只作为 Planner 线索，不直接判定风险。
- [x] 运行 `pnpm --filter @app/review-backend test -- review-pre-analysis`，预期通过。

### Task 3: 实现 Plan 阶段与计划修订

**Files:**
- Create: `packages/review-backend/src/infrastructure/llm/review-stage-prompts.ts`
- Create: `packages/review-backend/src/infrastructure/llm/plan-provider.ts`
- Create: `packages/review-backend/src/application/review-plan-stage.ts`
- Test: `packages/review-backend/tests/review-plan-stage.test.ts`

- [x] 写 fake provider 测试：合法 JSON 生成全局计划和按 `order` 排序的子计划。
- [x] 写失败测试：模型返回非法 JSON、缺少完成条件或引用不存在文件时，Planner 返回显式 `plan-degraded` 或结构化错误。
- [x] 写修订测试：只有文件不存在、依赖被证伪或关键假设冲突时允许一次修订；第二次修订必须拒绝。
- [x] 实现独立 Plan prompt，只传预分析结果和受控 diff 摘要，不传完整聊天历史。
- [x] 实现 plan schema parse、文件范围校验、预算默认值和修订记录。
- [x] 实现确定性最小计划 fallback，并保证 fallback 产生 `plan-degraded` 事件。
- [x] 运行 `pnpm --filter @app/review-backend test -- review-plan-stage`，预期通过。

### Task 4: 实现计划授权器和证据包

**Files:**
- Create: `packages/review-backend/src/infrastructure/llm/plan-authorizer.ts`
- Modify: `packages/review-backend/src/infrastructure/llm/tool-executors.ts`
- Modify: `packages/review-backend/src/domain/tool.ts`
- Test: `packages/review-backend/tests/plan-authorizer.test.ts`
- Modify: `packages/review-backend/tests/tool-executors.test.ts`

- [x] 写测试：允许计划中的只读工具；拒绝 `code_comment`、`task_done`、未授权文件、无关搜索目标和超预算调用。
- [x] 写测试：同一检查项重复读取命中去重策略；读取字节、工具次数和 token 预算正确累计。
- [x] 实现 `PlanAuthorizer`，返回结构化 `allow` / `deny` 决策和原因，不直接吞掉拒绝事件。
- [x] 将授权上下文传给 executor；工具结果保存 `contentHash` 和可审计参数。
- [x] 保持旧 Tool-use 路径兼容，但新路径只能导出四个只读工具定义。
- [x] 运行 `pnpm --filter @app/review-backend test -- plan-authorizer tool-executors`，预期通过。

### Task 5: 实现受限 ReAct 阶段

**Files:**
- Create: `packages/review-backend/src/application/review-react-stage.ts`
- Test: `packages/review-backend/tests/review-react-stage.test.ts`

- [x] 写测试：模型连续请求授权工具时，阶段返回 `EvidenceBundle`，不产生任何 `ReviewFinding`。
- [x] 写测试：模型尝试调用评论工具或越界读取时，工具调用被拒绝，阶段仍能输出 `evidence-incomplete`。
- [x] 写测试：达到模型调用、工具调用、读取字节或时间预算时，阶段停止并记录预算耗尽。
- [x] 实现每次 provider 调用只传当前子计划和必要的已结构化工具结果；不传 Planner 原始聊天消息。
- [x] 实现工具结果摘要、检查项关联、内容 hash 和完整性判断。
- [x] 将 `AbortSignal` 贯穿 provider 和工具执行；取消时不伪造 EvidenceBundle 完成状态。
- [x] 运行 `pnpm --filter @app/review-backend test -- review-react-stage`，预期通过。

### Task 6: 实现文件级 Reflection、一次补证和确定性校验

**Files:**
- Create: `packages/review-backend/src/infrastructure/llm/reflection-provider.ts`
- Create: `packages/review-backend/src/application/review-reflection-stage.ts`
- Create: `packages/review-backend/src/application/review-result-validation.ts`
- Test: `packages/review-backend/tests/review-reflection-stage.test.ts`
- Test: `packages/review-backend/tests/review-result-validation.test.ts`

- [x] 写测试：Reflection 只接受引用已存在 evidence id 的候选 finding；无引用候选进入 `needs-review`。
- [x] 写测试：证据不足最多发起一次补证，补证工具调用不超过 3 次；第二次请求被拒绝。
- [x] 写测试：非法文件、越界行号、重复 finding 和无法定位的 finding 分别触发拒绝、合并或 `file-level` 降级。
- [x] 实现独立 Reflection prompt，输入子计划、EvidenceBundle 和候选上下文，输出版本化 `ReflectionResult`。
- [x] 实现补证控制器，只允许调用 Reflection 指定且经授权器批准的只读工具。
- [x] 实现 `validateAndNormalizeFindings`：校验 evidence id、文件范围、diff 关联、行号、去重和状态。
- [x] Reflection provider 不支持结构化输出时禁止发布正式 finding，并写入阶段失败事件。
- [x] 运行 `pnpm --filter @app/review-backend test -- review-reflection-stage review-result-validation`，预期通过。

### Task 7: 实现全局 Reflection

**Files:**
- Modify: `packages/review-backend/src/application/review-reflection-stage.ts`
- Test: `packages/review-backend/tests/review-reflection-stage.test.ts`

- [x] 写测试：全局 Reflection 能识别跨文件契约风险、重复 finding 和互相矛盾的严重级别。
- [x] 写测试：全局 Reflection 不接收工具定义；模型请求工具时返回结构化拒绝。
- [x] 实现只消费全局计划、文件级结果和证据摘要的全局校验调用。
- [x] 将全局决策应用到正式 finding 和未采纳轨迹，禁止新增未经文件级证据支持的问题。
- [x] 运行 `pnpm --filter @app/review-backend test -- review-reflection-stage`，预期通过。

### Task 8: 实现 ReviewOrchestrator 和事件恢复

**Files:**
- Create: `packages/review-backend/src/application/review-orchestrator.ts`
- Modify: `packages/review-backend/src/application/stream-review-session.ts`
- Modify: `packages/review-backend/src/infrastructure/storage/file-session-store.ts`
- Create: `packages/review-backend/src/infrastructure/runtime-feature-flags.ts`
- Test: `packages/review-backend/tests/review-orchestrator.test.ts`
- Test: `packages/review-backend/tests/review-session-recovery.test.ts`
- Test: `packages/review-backend/tests/stream-review-session.hybrid.test.ts`

- [x] 写状态转移测试：非法 phase transition 失败；主路径按预分析、Plan、unit Plan、ReAct、Reflection、全局 Reflection 顺序产生事件。
- [x] 写失败隔离测试：单元 ReAct/Reflection 失败后其他文件继续；全局 Reflection 失败最终状态为 `partial`。
- [x] 写取消测试：provider 或工具返回后写入一次 `cancelled`；重复 cancel 不重复完成 session。
- [x] 写恢复测试：从最近阶段边界继续；不精确恢复正在执行的模型请求；重跑产生新 session 并记录来源。
- [x] 实现 orchestrator，串行执行全局计划中的 units，累计 session 和 unit 两级预算。
- [x] 在 `stream-review-session.ts` 增加运行模式选择；旧路径仍可运行，新路径的所有阶段事件先 append 再 yield。
- [x] 在 FileSessionStore 中保存 runtime/schema/plan version，并为旧事件提供 parse/migration 入口。
- [x] 运行 `pnpm --filter @app/review-backend test -- review-orchestrator review-session-recovery stream-review-session.hybrid`，预期通过。

### Task 9: 接入前端阶段进度和可展开轨迹

**Files:**
- Modify: `packages/review-app/src/lib/review-model.ts`
- Modify: `packages/review-app/src/hooks/use-review-session-stream.ts`
- Modify: `packages/review-app/src/components/session/session-progress.tsx`
- Create: `packages/review-app/src/components/session/review-trace-panel.tsx`
- Modify: `packages/review-app/src/components/session/finding-card.tsx`
- Test: `packages/review-app/tests/review-model.test.ts`
- Create: `packages/review-app/tests/review-trace-panel.test.tsx`
- Modify: `packages/review-app/tests/use-review-session-stream.test.tsx`

- [x] 写 model 测试：新阶段事件映射为预分析、规划、证据采集、校验、完成五个 UI 阶段；旧事件仍能显示基本进度。
- [x] 写 trace panel 测试：只展示计划摘要、工具摘要、证据来源和 Reflection 结论；不渲染完整 prompt。
- [x] 实现阶段状态、当前 unit、检查项、预算和降级提示的结构化解析。
- [x] 实现可展开轨迹面板；缺失字段显示明确的“不可用”，不由前端猜测。
- [x] 为 finding 卡片按后端 contract 展示 `line-level`（已校验）、`file-level`（文件级），并防御性支持未来的 `reviewStatus`。
- [x] 运行 `pnpm --filter @app/review-app test -- review-model review-trace-panel use-review-session-stream`，预期通过。
- [x] 运行 `pnpm --filter @app/review-app build`，预期通过。

### Task 10: 建立 golden corpus 和新旧运行时对比

**Files:**
- Create: `docs/evals/hybrid-review-golden-corpus.md`
- Create: `docs/adr/0007-hybrid-review-orchestrator.md`
- Create: `packages/review-backend/tests/fixtures/hybrid-review-corpus.ts`
- Create: `packages/review-backend/tests/hybrid-review-evaluation.test.ts`

- [x] 定义至少六类 fixture：明显 bug、安全问题、跨文件契约、无问题变更、无法精确定位、工具/模型失败。
- [x] 为 fixture 记录人工标注的正式 finding、允许的文件级降级和应拒绝问题。
- [x] 写评测测试，统计 finding 精确率、误报率、行号定位准确率、证据完整率和轨迹回放率。
- [ ] 运行旧运行时和新运行时对同一 fixture，输出结构化比较结果，不把比较结果写回业务 session。
- [x] 在 ADR 中记录 feature flag、迁移门槛和旧路径删除条件。
- [x] 运行 `pnpm --filter @app/review-backend test -- hybrid-review-evaluation`，预期通过。

### Task 11: 全量验证和迁移切换

**Files:**
- Modify: `packages/review-backend/src/infrastructure/runtime-feature-flags.ts`
- Modify: `docs/superpowers/plans/2026-07-26-hybrid-review-agent.md`

- [x] 运行 `pnpm typecheck`，预期 backend、app、shell 全部通过。
- [x] 运行 `pnpm test`，预期现有测试和新增测试全部通过。
- [x] 运行 `pnpm build`，预期三个 package 构建成功。
- [x] 运行 `pnpm --filter @app/review-app test:e2e`，验证启动、阶段进度、finding 点击和 diff 定位主流程。
- [ ] 对 golden corpus 记录新旧结果差异；只有精确率、定位准确率、证据完整率和轨迹回放率达到基线，才将 feature flag 默认切换到新运行时。
- [x] 将旧运行时保留为显式兼容模式；删除旧路径前先完成独立迁移评审，不在本计划内顺手删除。

## 自检结果

### 规格覆盖

- 全局预分析、全局 Plan、文件子 Plan：Task 2-3。
- 受限 ReAct、工具授权和预算：Task 4-5。
- 文件级 Reflection、补证、全局 Reflection：Task 6-7。
- 状态机、事件、恢复、取消、重跑：Task 8。
- UI 可解释性：Task 9。
- Provider 能力和迁移对比：Task 1、8、10-11。
- 精确率优先的验收：Task 10-11。

### 版本一致性

`ReviewPlan.version` 表示计划修订版本；`schemaVersion` 表示持久化 contract 版本；`runtimeVersion` 表示运行时实现版本。三者不混用。`ReflectionResult.unitId` 在全局 Reflection 中为空，其他阶段必须提供。

### 明确不做的扩展

本计划没有加入并行执行、任意工具生成、自动修复、长期双路径维护或完整原始模型轨迹 UI，避免超出已确认的 MVP 截止线。

## Task 11 验证记录（2026-07-26）

- `pnpm typecheck`：通过，backend、app、shell 均完成 TypeScript 构建检查。
- `pnpm test`：通过；backend 21 个测试文件 / 279 项，app 13 个测试文件 / 37 项，shell 3 个测试文件 / 9 项。
- `pnpm --filter @app/review-app test -- review-model review-trace-panel use-review-session-stream`：通过；实际运行 13 个测试文件 / 37 项。
- `pnpm build`：通过。通过新增无 Node 依赖的 `@app/review-backend/contracts` 入口，renderer 不再打包 backend application/infrastructure。
- `pnpm --filter @app/review-app test:e2e`：通过，1 个 Playwright 主流程用例通过；修正了 mock API 在 preview 构建时的环境注入和测试选择器。
- runtime feature flag：保持 `DEFAULT_RUNTIME_FEATURE_FLAGS.reviewRuntime = "legacy"`；仅显式传入 `reviewRuntime: "hybrid"` 时启用 hybrid。当前只有离线 golden corpus，未满足真实采样对比门槛，因此不切换默认值。
- 迁移收口：Task 8、Task 9 renderer build 与 Task 10 离线评测已收口；Task 10 的生产 runtime 对比、E2E 主流程和真实采样对比仍未完成，因此默认 runtime 继续保持 legacy。未提交 Git。
