# Review Trace 优化设计

## 目标

修复 trace `efe502da-0665-43a8-b327-1fcc78e16def` 暴露出的 Plan 降级难诊断、重复模型调用和预算原因不透明问题，同时保持现有 fallback 与事件契约兼容。

## 方案

1. Plan 校验错误保留缺失、重复和越界文件，并在重试提示中明确这些文件。
2. 对单文件且小于等于 50 行变更的审查，使用确定性最小计划，不调用 Plan 模型；大变更继续使用现有 Plan 流程。
3. 记录统一的 session budget 使用量与触发原因；当前使用编排层可获得的 runtime usage（React 阶段）并覆盖证据不完整、Reflection 失败和单元失败。
4. 日志查询允许返回经过审核的诊断字段，包括 stage、code、message、durationMs 和 token usage，但仍不返回 prompt、源码和模型原文。

## 兼容性

- 不新增 renderer IPC 字段。
- 不改变 Plan 降级后继续审查的行为。
- 不改变现有 session event schema。
- 小变更集仍产生可持久化的 `global-plan-completed` 事件，使用确定性 fallback 计划。

## 验证

- Plan 缺失/重复 unit 的错误详情测试。
- 小变更集不调用 provider 的测试。
- 预算超限记录触发原因的测试。
- 日志查询返回诊断字段且过滤敏感字段的测试。
- 后端全量测试、类型检查。
