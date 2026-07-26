# 目录架构重构方案

## 目标

将桌面端代码审查 Agent 按职责拆分为跨层 contract、审查引擎、基础设施、renderer 应用和 Electron 壳，降低跨包依赖，支持后续继续演进混合审查编排。

## 目标目录

```text
apps/
  review-shell/                 # Electron main/preload/IPC
packages/
  review-contracts/             # 跨进程共享的 Zod schema 与类型
  review-engine/                # 审查应用服务入口
  review-infrastructure/        # Git、LLM、存储等外部适配器入口
  review-app/                   # renderer 工作台
  review-backend/               # 现有实现，迁移期间保留的兼容层
```

## 依赖方向

```text
review-app ───────────────▶ review-contracts
review-shell ─────────────▶ review-contracts
review-shell ─────────────▶ review-engine ─────────▶ review-backend（过渡）
review-shell ─────────────▶ review-infrastructure ─▶ review-backend（过渡）
```

renderer 只消费结构化 contract；Electron shell 负责 IPC 和生命周期；engine 负责审查流程编排；infrastructure 负责外部系统适配。`review-backend` 的兼容层仅用于渐进迁移，不作为新业务代码的依赖入口。

## 迁移策略

1. 先创建 `review-contracts`，迁移 renderer 和 IPC 的共享类型。
2. 将 Electron 壳移动到 `apps/review-shell`。
3. 创建 engine 和 infrastructure facade，保持现有运行时实现不变。
4. 验证 typecheck、单元测试、构建和 E2E 后，再按模块把 backend 内部实现迁入新包。
5. 最后删除 facade 对 `review-backend` 的依赖，并将 backend 降级为历史兼容包或移除。

## 当前边界

本次重构不改变审查算法、IPC 方法名和持久化格式，只调整包入口、目录位置和依赖方向。因此可以在不影响现有用户流程的情况下继续实现 Plan-and-Solve、受限 ReAct、Reflection 混合范式。
