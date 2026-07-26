# Plan-and-Solve / 受限 ReAct / Reflection 混合审查 Agent 设计

## 1. 决策摘要

本版本采用以下运行时范式：

```text
确定性预分析
  → 全局 Plan
  → 文件级子 Plan
  → 受限 ReAct（只读证据采集）
  → 文件级 Reflection
      ↘ 最多一次补证
  → 全局 Reflection
  → 确定性校验与持久化
  → 正式 finding / 降级 / 未采纳
```

系统由一个确定性的 `ReviewOrchestrator` 编排，不拆成多个可自由交接的 Agent。Plan、ReAct 和 Reflection 是职责隔离的阶段；阶段之间只通过经过 Zod 校验的结构化 contract 传递数据。

第一目标是 finding 精确率、证据完整性和定位准确率，第二目标是让用户能够回看计划、证据来源和校验结论。召回率、成本优化和并行执行不作为第一阶段的优先目标。

## 2. 目标与边界

### 2.1 本次重规划目标

1. 在整个变更集级别生成可审计的全局审查计划。
2. 为每个变更文件生成有完成条件的文件级子计划。
3. 让 ReAct 只采集计划授权的只读证据，不直接生成 finding。
4. 让 Reflection 负责语义判断，工程逻辑负责确定性校验和降级。
5. 用阶段状态机和事件日志支持流式 UI、取消、恢复和重跑。
6. 让新旧运行时可以并行对比，降低迁移风险。

### 2.2 不在本次范围内

1. GitHub / GitLab 在线 PR 接入。
2. 自动修改代码或回写评论。
3. 本地模型。
4. 文件级并行执行。
5. 让模型自由创建工具或扩大仓库访问范围。
6. 展示原始模型思维链；只展示结构化计划、证据和校验信息。

## 3. 核心架构

### 3.1 阶段职责

#### 确定性预分析

输入是 base ref、target ref 和 Git diff。输出变更集事实摘要：文件列表、语言、增删行数、diff hunk、文件类别、敏感路径线索和可推导的依赖线索。该阶段不调用模型，保证 Planner 的输入边界稳定。

#### 全局 Plan

Planner 接收预分析结果和受控 diff 摘要，输出：风险区域、跨文件关系、审查顺序、文件级子计划和全局预算分配。计划版本生成后冻结；只有确定性触发条件满足时才允许一次全局修订。

#### 文件级子 Plan

编排器从全局计划中取出一个文件子计划，校验其文件范围、检查项、证据目标和预算。子计划不允许扩大仓库访问范围。

#### 受限 ReAct

ReAct 只允许调用 `file_read`、`file_find`、`code_search`、`file_read_diff`。每次调用必须通过计划授权器，且必须记录检查项、参数、结果摘要、预算变化和授权结果。ReAct 输出 `EvidenceBundle`，不输出正式 finding。

#### 文件级 Reflection

Reflection 接收子计划和证据包，输出候选 finding、保留/拒绝理由、反例分析、证据引用和定位信息。证据不足时只能提出一次受限补证请求，最多调用 3 次授权工具，之后必须终态化。

#### 全局 Reflection

全局 Reflection 只消费全局计划、各文件 Reflection 结果和证据摘要，不再调用工具。它检查跨文件契约风险、重复问题、互相矛盾的问题和整体严重级别，不负责自由探索。

#### 确定性校验

工程代码校验 schema、证据引用、文件范围、行号、diff 关联、重复项和状态降级。不能验证的结果进入 `rejected` 或 `needs-review` 轨迹，不进入正式问题卡片。

### 3.2 状态机

合法主路径如下：

```text
session-created
  → pre-analysis-completed
  → global-plan-completed
  → unit-plan-started
  → react-evidence-collecting
  → reflection-validating
  → unit-completed
  → ...
  → global-reflection-completed
  → session-finished
```

补证路径只能发生一次：

```text
reflection-validating
  → evidence-backfill
  → reflection-validating
```

失败和取消状态：

1. 单个文件子计划或 ReAct 失败：该单元进入 `unit-failed` 或 `evidence-incomplete`，继续下一个文件。
2. Reflection 失败：该单元不发布新 finding，session 最终为 `partial`。
3. 全局计划失败：可使用确定性的最小计划，但必须记录 `plan-degraded`。
4. 取消只在 provider 请求或工具调用返回后写入 `cancelled`，操作必须幂等。
5. 崩溃恢复只从最近一个已持久化的阶段边界恢复，不精确续跑正在执行的模型请求。

### 3.3 工具授权

固定工具白名单与计划授权范围共同决定可执行调用。授权器必须检查：

1. 工具名称是否属于只读白名单。
2. 文件路径是否属于当前变更集或子计划允许的依赖范围。
3. 搜索关键词/正则是否对应当前检查项的证据目标。
4. 当前阶段、工具次数、读取字节数和上下文 token 是否仍在预算内。
5. 是否触发重复调用上限。

`code_comment` 和 `task_done` 不再是 ReAct 工具。阶段完成由编排器根据模型响应、证据完整性和预算状态判断。

### 3.4 计划修订

计划修订只能由以下确定性条件触发：

1. 计划引用的文件不存在。
2. 关键依赖关系被 Git/搜索证据证伪。
3. 新证据与计划中的关键假设冲突。

全局计划最多修订一次，文件子计划最多修订一次。修订不得扩大原始变更集和已授权依赖范围；每次修订记录触发原因、旧版本、新版本、预算变化和受影响检查项。

## 4. 核心 Contract

以下 contract 位于 `packages/review-backend/src/domain`，均使用 Zod schema 和 inferred type。持久化 contract 必须带版本号。

### 4.1 运行时元数据

```ts
type ReviewRuntimeMetadata = {
  runtimeVersion: string;
  planVersion: number;
  schemaVersion: number;
  providerCapabilities: {
    structuredOutput: boolean;
    toolCalling: boolean;
    usage: boolean;
    cancellation: boolean;
  };
};
```

### 4.2 计划

```ts
type ReviewPlan = {
  version: number;
  changeSetSummary: {
    files: string[];
    totalInsertions: number;
    totalDeletions: number;
  };
  riskAreas: Array<{
    id: string;
    area: string;
    riskLevel: "high" | "medium" | "low";
    reasoning: string;
    relatedFiles: string[];
  }>;
  units: Array<{
    unitId: string;
    file: string;
    order: number;
    checks: Array<{
      id: string;
      description: string;
      completionCriteria: string[];
      allowedFiles: string[];
      evidenceTargets: string[];
    }>;
    budget: PhaseBudget;
  }>;
  revision?: { reason: string; previousVersion: number };
};
```

### 4.3 预算和证据

```ts
type PhaseBudget = {
  modelCalls: number;
  toolCalls: number;
  maxInputTokens: number;
  maxOutputTokens: number;
  maxReadBytes: number;
  maxDurationMs: number;
};

type EvidenceBundle = {
  schemaVersion: number;
  unitId: string;
  items: Array<{
    id: string;
    checkId: string;
    source: "file_read" | "file_find" | "code_search" | "file_read_diff";
    arguments: Record<string, unknown>;
    content: string;
    contentHash: string;
  }>;
  completeness: "complete" | "incomplete";
};
```

### 4.4 Reflection 结果

```ts
type ReflectionResult = {
  schemaVersion: number;
  unitId?: string;
  candidates: Array<{
    finding: ReviewFinding;
    evidenceIds: string[];
    counterEvidence: string;
    decision: "accept" | "reject" | "needs-review";
    decisionReason: string;
  }>;
  backfillRequest?: {
    checkId: string;
    reason: string;
    allowedTool: "file_read" | "file_find" | "code_search" | "file_read_diff";
    arguments: Record<string, unknown>;
  };
};
```

正式 finding 的 `file-level` 仅表示定位不精确；证据不足使用独立的 `evidence-incomplete` 或 `needs-review` 状态，不能混用。

## 5. 事件与持久化

所有阶段状态转移、计划版本、授权结果、预算变化、证据摘要、Reflection 结论和降级原因都写入事件日志。事件至少包含 `sessionId`、`unitId?`、`phase`、`schemaVersion` 和 `runtimeVersion`。

前端默认展示：

1. 阶段进度和当前检查项。
2. 当前文件、预算消耗和降级提示。
3. finding 的已校验、待确认、未采纳状态。
4. 可展开的计划摘要、工具摘要、证据来源和 Reflection 结论。

不默认展示完整 prompt、原始模型消息或模型内部思维链。

## 6. Provider 能力

Provider contract 增加能力声明：structured output、tool calling、usage、cancellation 和上下文上限。

1. 缺少工具调用能力：允许进入明确标记的降级路径，但不能伪装成完整混合范式。
2. 缺少 Reflection 结构化输出：禁止发布正式 finding，只保留失败轨迹。
3. 缺少 usage：允许执行，但预算中的成本统计标记为不可计量。
4. provider 请求必须支持 AbortSignal；不能取消时必须在 session 中显式标记能力缺失。

## 7. 迁移策略

新增 `ReviewOrchestrator`，旧 `runToolUseLoop` 暂时保留。新旧运行时共享 GitClient、只读工具实现、finding schema、SessionStore 和 IPC 桥接，但不共享旧的“工具调用即产生 finding”控制流。

通过运行模式或 feature flag 切换新旧路径，对同一批 golden corpus 进行比较。新路径达到精确率、定位准确率和轨迹完整性基线后，再删除旧主流程或将其收敛为兼容适配层。

## 8. 验收标准

### 功能验收

1. 一次 session 能完整经过预分析、全局 Plan、文件子 Plan、受限 ReAct、两级 Reflection 和最终校验。
2. 越权工具调用被拒绝并写入事件，不能访问未授权文件。
3. Reflection 证据不足时最多补证一次，补证最多 3 次工具调用。
4. 无法验证的 finding 不进入正式问题卡片，并保留未采纳轨迹。
5. 单文件失败不拖垮其他文件；全局 Reflection 失败导致 `partial`。
6. 取消、恢复和重跑遵守阶段边界和 session 隔离规则。

### 质量验收

1. 所有持久化 contract 通过 schema parse，并具备 schema version。
2. 新旧运行时都通过既有测试；新路径新增状态机、授权器、Reflection 校验和事件恢复测试。
3. golden corpus 能测量正式 finding 精确率、定位准确率、证据完整率、误报率和轨迹回放率。
4. UI 不依赖猜测缺失字段；阶段状态全部来自结构化事件。
