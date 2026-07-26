# ADR 0007：采用 Hybrid Review Orchestrator

## 状态

已接受，分阶段迁移。

## 决策

代码审查运行时采用“确定性预分析 → Plan-and-Solve → 受限 ReAct → Reflection”的显式编排器。legacy runtime 保留为兼容路径，hybrid runtime 通过 `reviewRuntime` feature flag 显式启用；评测 runner 只返回结构化比较结果，不修改业务 session。

ReAct 只能调用计划授权的只读工具，Reflection 负责候选 finding 的采纳与证据校验，文件无法精确定位时只能降级为 file-level，不能伪造行号。

## 迁移门槛

hybrid 默认切换前必须满足 golden corpus 六类 fixture 均可离线运行，并对六个 fixture 的指标做 macro-average（每个 fixture 等权，不按 finding 数量加权）：

- finding precision `>= 0.90`
- false-positive rate `<= 0.10`
- line accuracy `>= 0.90`
- evidence completeness `>= 0.95`
- trace replay rate `= 1.0`

所有指标必须同时达标；任一指标未达标都不能切换默认运行时。失败和取消还必须可隔离且不破坏旧 session。

门槛通过前，默认值保持 `legacy`，hybrid 仅供显式验证和灰度使用。任何门槛回退都应保留 legacy 作为即时回滚路径。

## 旧路径删除条件

只有在连续版本的离线 corpus 和真实采样对比均通过门槛、已有 session 可迁移读取、hybrid 的取消/恢复/失败隔离覆盖稳定，并完成一次回滚演练后，才允许删除 legacy tool-use loop 和对应 feature flag。删除前必须先更新本 ADR 与发布说明。

## 后果

显式阶段和版本化事件增加了实现与存储复杂度，但换来了可解释的证据边界、可恢复的运行状态和可量化的新旧运行时迁移依据。
