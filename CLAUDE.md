# CLAUDE.md

本文件为 Claude Code (claude.ai/code) 提供本仓库的工作指引。

**通用项目约定（架构、分层、开发方式、测试要求等）见 [AGENTS.md](AGENTS.md)。** 以下仅记录 Claude Code 特有的补充信息。

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

## Mock 模式

前端开发可使用 mock API（无需 Electron）：`pnpm dev:web` 自动设置 `VITE_USE_MOCK_API=true`。Mock 实现在 `packages/review-app/src/test/mock-review-workbench-api.ts`。

## Agent skills

详见 [AGENTS.md § Agent skills](AGENTS.md#11-agent-skills)。以下为 skill 文档索引：

- **Issue tracker** — `docs/agents/issue-tracker.md`
- **Triage labels** — `docs/agents/triage-labels.md`
- **Domain docs** — `docs/agents/domain.md`
- **TDD** — `docs/agents/tdd.md`
- **IPC 边界** — `docs/agents/ipc-boundary.md`

## 补充约束

以下约束是对 AGENTS.md 的补充，Claude Code 在本仓库工作时同样必须遵守：

- **先文档后代码**：实现与文档冲突时先更新文档，避免架构漂移。设计文档在 `docs/superpowers/`。
- **不要提前引入新框架**替换既定技术栈，不做与当前任务无关的大规模重构。
- **领域术语**：使用 `CONTEXT.md` 中定义的术语，不要发明同义词。
- **架构决策**：修改关键架构前先检查 `docs/adr/` 中的相关决策记录。
