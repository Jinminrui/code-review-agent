# Code Review Agent

一个面向 `reviewer` 的桌面端可视化代码审查 Agent。

第一版目标不是替代 GitHub / GitLab，而是提供一个独立的审查工作台：基于本地仓库分支对比，生成改动摘要、风险问题卡片，并把 reviewer 直接带到对应的 diff / 代码位置。

## 核心能力

MVP 计划提供以下能力：

1. 选择本地仓库和两个分支发起审查。
2. 展示改动摘要和高风险文件。
3. 以问题卡片流方式呈现审查结果。
4. 在右侧代码视图中定位具体问题。
5. 保存、回看和重跑审查会话。

MVP 明确不包含：

1. GitHub / GitLab 在线 PR 拉取。
2. 自动回写评论。
3. 自动修复代码。
4. 本地模型支持。
5. 多人协作能力。

## 架构概览

项目采用 `Electron + TypeScript` 全栈架构，分为三层：

1. `主进程 / 桌面壳`
负责窗口、preload、IPC 注册、系统权限和任务入口。

2. `renderer / 前端工作台`
负责仓库与分支选择、摘要面板、问题卡片流、diff 详情和设置页。

3. `后端审查引擎`
负责 git diff、审查单元拆分、上下文收集、LLM 调用、结果结构化和会话存储。

这版架构有两个重要原则：

1. 前端只消费结构化结果，不直接碰 git、文件系统和原始 LLM 文本。
2. 后端默认作为 Electron 主进程可调用的应用服务，不额外起 Express / Fastify。

## 技术选型

后端：

1. `Node.js 22`
2. `TypeScript 5`
3. `pnpm workspace`
4. `Vitest`
5. `zod`
6. `execa`
7. `pino`

前端：

1. `React 19`
2. `Vite`
3. `React Router`
4. `Zustand`
5. `TanStack Query`
6. `Tailwind CSS`
7. `Monaco Diff Editor`
8. `Vitest + Testing Library + Playwright`

## Node 版本

项目目标 Node 版本为 `22`。

仓库已经提供了以下版本声明，便于自动切换：

1. [/.nvmrc](/Users/jinminrui/Desktop/code-review-agent/.nvmrc)
2. [/.node-version](/Users/jinminrui/Desktop/code-review-agent/.node-version)
3. [package.json](/Users/jinminrui/Desktop/code-review-agent/package.json) 中的 `engines` 和 `volta`

常见用法：

```bash
# nvm
nvm use

# fnm
fnm use

# volta
volta install node@22.16.0 pnpm@11.5.2
```

如果你的 shell 没有自动切换 Node 版本，建议开启对应工具的 shell hook，例如：

```bash
# nvm 用户可在 shell 配置里配合 cd 自动执行 nvm use
# fnm 用户可启用 shell integration
eval "$(fnm env --use-on-cd)"
```

## 目录规划

当前项目以文档先行为主，目标目录结构如下：

```text
docs/
  superpowers/
    specs/
    plans/
packages/
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
```

## 文档入口

如果你刚接手这个项目，建议按下面顺序读：

1. 产品/架构设计：[docs/superpowers/specs/2026-06-06-visual-code-review-agent-design.md](/Users/jinminrui/Desktop/code-review-agent/docs/superpowers/specs/2026-06-06-visual-code-review-agent-design.md)
2. 后端详细方案：[docs/superpowers/plans/2026-06-06-review-backend-foundation.md](/Users/jinminrui/Desktop/code-review-agent/docs/superpowers/plans/2026-06-06-review-backend-foundation.md)
3. 前端详细方案：[docs/superpowers/plans/2026-06-06-review-frontend-workbench.md](/Users/jinminrui/Desktop/code-review-agent/docs/superpowers/plans/2026-06-06-review-frontend-workbench.md)
4. 协作与实现约束：[AGENTS.md](/Users/jinminrui/Desktop/code-review-agent/AGENTS.md)

## 开发约定

默认遵循这些规则：

1. 先更新文档，再开始较大实现。
2. 优先按计划拆任务，小步推进。
3. 默认采用 TDD：先写失败测试，再补最小实现。
4. 前后端边界通过类型化 contract 统一。
5. 定位不准的问题必须降级为文件级 finding，不能伪造精确行号。

更细的协作约束见 [AGENTS.md](/Users/jinminrui/Desktop/code-review-agent/AGENTS.md)。

## 预期工作流

推荐的落地顺序：

1. 初始化 `pnpm workspace` 和基础包结构。
2. 先搭后端审查引擎骨架。
3. 再搭 renderer 工作台骨架。
4. 最后接入 Electron 主进程、preload 和完整联调。

## 常用命令

项目代码骨架落地后，预期常用命令如下：

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm --filter @app/review-backend test
pnpm --filter @app/review-app test
pnpm --filter @app/review-app build
pnpm --filter @app/review-app test:e2e
```

当前仓库还处在设计和计划落地阶段，所以部分命令要等代码骨架创建后才能真正运行。

## 当前状态

当前已经完成：

1. 产品设计文档
2. 后端详细技术方案
3. 前端详细技术方案
4. 仓库级 `AGENTS.md`

下一步建议直接按计划初始化项目骨架。
