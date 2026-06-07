# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

桌面端可视化代码审查 Agent（Electron + TypeScript）。基于本地 git 仓库的两个分支对比，生成改动摘要和风险问题卡片，支持 diff 定位跳转。UI 为中文。不做 GitHub/GitLab PR 拉取、自动回写评论或自动修复。

## 常用命令

```bash
pnpm install                         # 安装依赖
pnpm build                           # 构建全部三个包（backend -> app -> shell）
pnpm typecheck                       # TypeScript 类型检查（project references）
pnpm test                            # 运行所有测试
pnpm dev:web                         # 前端独立开发（mock API，端口 5173）
pnpm dev:desktop                     # 完整 Electron 桌面应用

# 单包测试
pnpm --filter @app/review-backend test
pnpm --filter @app/review-app test
pnpm --filter @app/review-shell test

# 前端 E2E
pnpm --filter @app/review-app test:e2e

# 前端 watch 模式
pnpm test:watch
```

## 架构

三层 monorepo（pnpm workspace）：

1. **`packages/review-shell`** — Electron 主进程：窗口、preload（`preload.cts` 暴露 `window.reviewWorkbenchApi`）、IPC handler 注册。
2. **`packages/review-app`** — React 前端渲染器：路由（hash）、组件、Monaco diff、状态管理。
3. **`packages/review-backend`** — 审查引擎：git diff → 审查单元拆分 → 上下文收集 → LLM 调用 → 结构化输出 → 会话存储。

关键数据流：前端通过 `window.reviewWorkbenchApi`（IPC bridge）调用主进程 → 主进程调用 `streamReviewSession()`（async generator）→ 流式事件（`session-started`/`unit-completed`/`unit-failed`/`session-finished`）通过 `webContents.send()` 推送回前端。

### 后端分层（`packages/review-backend/src/`）

- `domain/` — Zod schema 和类型定义（ReviewFinding、ReviewSession、ReviewUnit、LlmProvider）
- `application/` — 编排层：`streamReviewSession`、`buildReviewSummary`、`startReviewSession`
- `infrastructure/` — 具体实现：GitClient（execa）、LLM provider（OpenAI 兼容）、diff 解析、上下文收集、文件存储、pino 日志
- `contracts/` — IPC 契约 schema（zod）

### 前端结构（`packages/review-app/src/`）

- `app/` — router（三条路由：`/`、`/sessions`、`/sessions/:sessionId`）、providers
- `pages/` — ReviewLaunchPage、SessionHistoryPage、ReviewSessionPage
- `components/launch/` — 仓库选择、分支选择、启动表单
- `components/session/` — finding 卡片列表、摘要面板、风险文件
- `components/diff/` — Monaco diff viewer、finding 装饰、行定位
- `hooks/` — use-review-session-stream、use-selected-finding、use-monaco-reveal
- `store/` — Zustand（review-session-store、workbench-ui-store）
- `lib/` — ipc-client、review-model（客户端 zod schema）、severity

## 技术栈

- Node 22、TypeScript 5（strict）、pnpm 11.5 workspace
- 后端：zod、execa、pino、vitest
- 前端：React 19、Vite 6、React Router 7（hash）、TanStack Query 5、Zustand 5、Tailwind 3、Monaco Editor
- 测试：Vitest、Testing Library、Playwright

## 开发约束

- **TDD**：先写失败测试，再写最小实现让测试通过。
- **前后端边界**：前端只消费结构化结果，不直接访问 git/文件系统/LLM 原始文本。一切通过 IPC。
- **zod schema 统一**：前后端 contract 用 zod schema + inferred types 统一，前端不自行猜测缺失字段。
- **错误隔离**：单个审查单元失败时必须隔离（`unit-failed` 事件），不能拖垮整个 session。
- **定位降级**：无法精确定位行号时返回 `status: file-level`，不允许伪造精确行号。
- **git 操作统一**：所有 git 能力走 `GitClient`，禁止业务层散落 shell 调用。
- **先文档后代码**：实现与文档冲突时先更新文档，避免架构漂移。设计文档在 `docs/superpowers/`。
- **不要提前引入新框架**替换既定技术栈，不做与当前任务无关的大规模重构。

## Mock 模式

前端开发可使用 mock API（无需 Electron）：`pnpm dev:web` 自动设置 `VITE_USE_MOCK_API=true`。Mock 实现在 `packages/review-app/src/test/mock-review-workbench-api.ts`。
