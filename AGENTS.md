# AGENTS.md

本文件用于约束本仓库内 agent / 开发者的协作方式、架构边界和实现优先级。除非用户明确覆盖，否则在本仓库内工作时默认遵循本文件。

## 1. 项目目标

本项目是一个 `桌面端可视化代码审查 Agent`，第一版目标是服务 `reviewer` 对单个变更集进行审查。

MVP 用户价值：

1. 选择本地仓库和两个分支发起审查。
2. 快速理解这次改动做了什么。
3. 查看高风险问题卡片，并跳转到对应 diff/代码位置验证。
4. 保存、回看和重跑审查会话。

MVP 明确不做：

1. GitHub / GitLab 在线 PR 拉取。
2. 自动回写评论。
3. 自动修复代码。
4. 本地模型支持。
5. 多人协作和复杂权限系统。

## 2. 总体架构

项目采用 `Electron + TypeScript` 全栈方案，按职责分为三层：

1. `桌面壳 / 主进程`
   负责窗口、preload、IPC 注册、系统权限、任务入口。
2. `前端工作台 / renderer`
   负责仓库与分支选择、会话列表、摘要面板、问题卡片流、diff 详情和设置页。
3. `后端审查引擎`
   负责 git diff、审查单元拆分、上下文收集、LLM 调用、结果结构化、会话存储。

关键原则：

1. 前端只消费结构化结果，不直接解析 LLM 原始文本。
2. renderer 不直接访问文件系统、git 或模型配置，一律通过 IPC。
3. 后端不单独起 Express/Fastify 服务，默认作为 Electron 主进程可调用的应用服务。
4. 确定性逻辑前置：diff、文件筛选、定位映射、上下文裁剪应由工程逻辑保证稳定。
5. 结果可信度优先：定位失败时要降级为文件级 finding，不允许伪造精确行号。

## 3. 目录规划

按当前技术方案，仓库目标结构如下：

```text
docs/
  superpowers/
    specs/
    plans/
packages/
  review-contracts/
    src/
    tests/
  review-engine/
    src/
  review-infrastructure/
    src/
  review-backend/
    src/
      domain/
      application/
      infrastructure/
      contracts/
    tests/
  review-app/
    src/
      app/
      pages/
      components/
      hooks/
      store/
      lib/
      styles/
    tests/
apps/
  review-shell/
    src/
    tests/
```

目录职责：

1. `docs/superpowers/specs`
   记录设计文档，当前基线是 `2026-06-06-visual-code-review-agent-design.md`。
2. `docs/superpowers/plans`
   记录实现计划，当前已有前后端两个详细计划。
3. `packages/review-backend`
   当前审查引擎的兼容实现，内部继续按 domain/application/infrastructure 分层；新代码通过 facade 迁移。
4. `packages/review-contracts`
   独立的跨进程、跨包 Zod contract，不依赖 Node.js、Electron 或 renderer。
5. `packages/review-engine`
   审查应用服务入口，承接 Plan-and-Solve、受限 ReAct、Reflection 编排；当前通过兼容 facade 暴露 backend 实现。
6. `packages/review-infrastructure`
   Git、LLM provider、文件会话存储等外部适配器入口；当前通过兼容 facade 暴露 backend 实现。
7. `packages/review-app`
   renderer 前端工作台，不包含主进程逻辑。
8. `apps/review-shell`
   Electron 主进程、preload 和 IPC 注册；只依赖 contracts、engine、infrastructure，不直接依赖 backend 内部模块。

## 4. 后端实现约定

后端目标技术栈：

1. `Node.js 22`
2. `TypeScript 5`
3. `pnpm workspace`
4. `Vitest`
5. `zod`
6. `execa`
7. `pino`

后端分层约束：

1. `domain`
   只定义核心模型、schema、接口类型，不依赖 UI 或具体基础设施。
2. `application`
   负责审查会话编排和事件流，不直接拼 shell 命令。
3. `infrastructure`
   负责 git、LLM provider、文件存储、日志等外部依赖。
4. `contracts`
   定义 IPC 和跨层共享 contract。

后端必须遵守：

1. git 能力统一走 `GitClient`，禁止业务层散落 shell 调用。
2. provider 必须通过统一接口注入，第一版只实现 OpenAI-compatible provider。
3. review session 结果以 `AsyncGenerator<ReviewSessionEvent>` 或等价流式事件模型对外暴露。
4. session store 第一版使用文件系统，不提前引入 SQLite。
5. 单个审查单元失败时必须隔离，不能拖垮整个 session。

## 5. 前端实现约定

前端目标技术栈：

1. `React 19`
2. `TypeScript 5`
3. `Vite`
4. `React Router`
5. `Zustand`
6. `TanStack Query`
7. `Tailwind CSS`
8. `Monaco Diff Editor`
9. `Vitest + Testing Library + Playwright`

前端状态和组件约束：

1. 页面组件负责编排场景，不承担复杂数据转换。
2. `Zustand` 只管理本地 UI 状态与当前会话选中态。
3. `TanStack Query` 管理会话列表、会话详情、重跑等异步数据。
4. diff 视图必须支持根据 finding 自动滚动定位。
5. 文件级 finding 没有精确行号时，右侧视图要做文件级降级展示。

界面优先级：

1. 先做“左侧摘要/问题流 + 右侧详情”的主工作台闭环。
2. 再做设置页、隐私说明、会话历史。
3. 不要在 MVP 早期投入复杂动画、虚拟滚动或高级主题系统。

## 6. 数据与接口边界

标准 finding 结构以设计文档为准，至少包含：

1. `id`
2. `severity`
3. `category`
4. `summary`
5. `explanation`
6. `file`
7. `startLine`
8. `endLine`
9. `evidence`
10. `suggestion`
11. `confidenceSignals`
12. `status`

边界要求：

1. 前端不得自行猜测缺失字段。
2. 后端若无法精确定位，必须返回 `status: file-level`。
3. 前后端 contract 优先用 `zod schema + inferred types` 统一。
4. 所有磁盘会话数据都要可校验，不能直接信任 JSON 输入。

## 7. 开发方式

默认采用：

1. `pnpm workspace`
2. `TDD`
3. 小步提交
4. 先计划后实现

工作顺序建议：

1. 先更新或确认 `docs/superpowers/specs` / `plans`。
2. 先写失败测试。
3. 再写最小实现让测试通过。
4. 最后补充类型、日志、错误路径和文档。

除非用户明确要求，否则不要：

1. 提前引入新框架替换既定技术栈。
2. 做与当前任务无关的大规模重构。
3. 把前端和后端逻辑耦合到同一层。
4. 为了“看起来完整”加入超出 MVP 范围的能力。

## 8. 测试要求

后端测试重点：

1. `GitClient`
2. `ReviewUnitPlanner`
3. `ContextCollector`
4. `Finding Normalizer`
5. `streamReviewSession`
6. `SessionStore`

前端测试重点：

1. 仓库/分支选择表单
2. 会话详情页
3. finding 卡片点击与选中
4. 渐进式事件订阅
5. diff 定位逻辑
6. renderer E2E 主流程

推荐命令：

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm --filter @app/review-backend test
pnpm --filter @app/review-app test
pnpm --filter @app/review-app build
pnpm --filter @app/review-app test:e2e
```

## 9. UI 与体验约束

前端不要做成普通后台表格页。设计上应保持：

1. 强调审查工作台感，而不是 CRUD 管理台感。
2. 左右分栏清晰，信息层次稳定。
3. 问题卡片要支持快速扫描严重级别、文件和摘要。
4. 右侧代码区要优先保证可读性与定位效率。

避免：

1. 默认紫色渐变 AI 风格。
2. 过度依赖弹窗承载主流程。
3. 在还没有真实数据链路前堆复杂视觉效果。

## 10. 文档基线

如无特别说明，后续实现以以下文档为基线：

1. [docs/superpowers/specs/2026-06-06-visual-code-review-agent-design.md](/Users/jinminrui/Desktop/code-review-agent/docs/superpowers/specs/2026-06-06-visual-code-review-agent-design.md)
2. [docs/superpowers/plans/2026-06-06-review-backend-foundation.md](/Users/jinminrui/Desktop/code-review-agent/docs/superpowers/plans/2026-06-06-review-backend-foundation.md)
3. [docs/superpowers/plans/2026-06-06-review-frontend-workbench.md](/Users/jinminrui/Desktop/code-review-agent/docs/superpowers/plans/2026-06-06-review-frontend-workbench.md)

若实现和文档发生冲突，优先先更新文档，再继续编码，避免架构漂移。

## 11. Agent skills

### Issue tracker

本仓库的 issue 追踪使用 GitHub Issues；外部 PR 不作为 triage 入口。详见 `docs/agents/issue-tracker.md`。

### Triage labels

本仓库使用默认 triage 标签词汇：`needs-triage`、`needs-info`、`ready-for-agent`、`ready-for-human`、`wontfix`。详见 `docs/agents/triage-labels.md`。

### Domain docs

本仓库使用 single-context 的领域文档布局。详见 `docs/agents/domain.md`。

### TDD

本仓库严格遵循测试驱动开发流程：先写失败测试，再写最小实现。详见 `docs/agents/tdd.md`。

### IPC 边界

前端不直接访问后端能力，一切通过 `window.reviewWorkbenchApi` IPC 桥接。详见 `docs/agents/ipc-boundary.md`。
