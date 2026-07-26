# Hybrid Review Golden Corpus

## 目的

Golden corpus 用于在不访问网络、不调用真实 LLM 的条件下，比较 legacy 与 hybrid review runtime 的结构化输出。它只服务离线评测，不把评测结果写入业务 session。

当前 corpus 覆盖六类最小场景：明显 bug、安全问题、跨文件契约、无问题变更、无法精确定位、工具或模型失败。结构化 fixture 位于 `packages/review-backend/tests/fixtures/hybrid-review-corpus.ts`。

每个 fixture 必须包含：变更文件事实、人工标注的正式 finding、允许的 file-level 降级、应拒绝的问题，以及 legacy/hybrid runner 的输出和轨迹。

## 指标

评测测试统计以下指标，取值范围均为 `0..1`：

- finding 精确率：报告 finding 中与人工正式 finding ID 匹配的比例。
- 误报率：报告 finding 中未被人工标注或明确列入拒绝集合的比例。
- 行号定位准确率：正式 line-level finding 中起止行均精确匹配的比例；只有 file-level 标注的 fixture 不要求伪造行号。
- 证据完整率：正式 finding 中带有人工证据的项目，被输出 finding 保留证据的比例。
- 轨迹回放率：轨迹事件序号严格递增、阶段值符合 runtime contract 并可顺序回放的比例。

评测只比较结构化结果。模型原文、日志和评测结果不得写入 `FileSessionStore`。

迁移门槛采用六个 fixture 的 macro-average（fixture 等权）计算：finding precision 至少 `0.90`、误报率至多 `0.10`、行号定位准确率至少 `0.90`、证据完整率至少 `0.95`、轨迹回放率必须为 `1.0`。五项指标全部参与 gate，任一项失败即阻止默认切换。

## 迁移使用方式

通过确定性 runner 先建立 legacy 基线，再运行 hybrid 输出，保存测试中的结构化比较结果。发布门槛和 feature flag 规则记录在 [ADR 0007](../adr/0007-hybrid-review-orchestrator.md)。
