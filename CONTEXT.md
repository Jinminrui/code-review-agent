# 可视化代码审查 Agent

本上下文描述桌面端审查本地代码变更集，并保存审查会话供后续回看的业务语言。Agent 在输出 issue 标题、重构建议、测试名称等内容时，应使用此处定义的术语，不要发明同义词。

## 语言

**审查会话**：
一次针对本地代码变更集的持久化审查尝试，包含仓库、引用、流式事件、问题、摘要和 diff 快照。
_避免使用_：任务、作业、运行

**会话历史**：
用户发起过的审查会话时间线，按审查会话创建时间排序。
_避免使用_：完成日志、活动流

**已中止审查会话**：
用户在所有审查单元完成前主动停止的审查会话。它保留在会话历史中，并保存中止请求前已经提交的问题和 diff 快照；中止请求后产生的问题不再加入会话。
_避免使用_：已 abort 会话、失败会话、已删除会话

**已中断审查会话**：
后续可引入的会话状态，用于表示应用重启、后台任务崩溃或运行中任务丢失导致审查无法继续。它不同于用户主动中止的审查会话。
_避免使用_：已中止审查会话、失败会话

**中止审查**：
用户主动请求停止正在运行的审查会话的操作。代码状态值使用 `cancelled`，中文终态展示为”已中止”，按钮文案使用”中止审查”，过渡态使用”正在中止...”。
_避免使用_：取消审查、停止审查、终止审查

## 核心领域概念

| 术语 | 说明 | 避免使用 |
|---|---|---|
| **Review Session** | 一次完整的代码审查过程，从用户发起开始到结束。每个 session 有唯一 `sessionId`。 | 审查任务、review task、审查流程 |
| **Review Unit** | 一次 session 中的最小审查单元，通常对应一个变更文件。每个 unit 有唯一 `unitId`。 | 审查分组、unit group、审查块 |
| **Review Finding** | LLM 在审查中发现的一个具体问题，包含严重级别、位置、证据等。 | 审查结果、issue、缺陷、bug report |
| **Review Plan** | LLM 在审查前生成的风险分析和审查策略，包含 riskPoints、reviewStrategy、estimatedComplexity。 | 审查策略、分析计划 |
| **Diff** | 两个分支之间的代码差异，以 unified diff 格式表示。 | 差异、变更、patch |
| **Base Ref** | 对比的基准分支/提交（通常是 `main`）。 | 基准、base branch |
| **Target Ref** | 被审查的目标分支/提交（可以是分支名或 `WORKSPACE` 表示未提交变更）。 | 目标、feature branch |

## 严重级别

| 级别 | 含义 |
|---|---|
| **high** | 高风险：可能导致崩溃、安全漏洞、数据丢失 |
| **medium** | 中风险：可能导致功能异常、性能下降 |
| **low** | 低风险：代码质量、可维护性问题 |

## Finding 状态

| 状态 | 含义 |
|---|---|
| **line-level** | 问题已精确定位到具体行范围（有 `startLine`） |
| **file-level** | 问题只能定位到文件级别，无法确定具体行 |

## Session 状态流转

```
idle → running → finished
                → partial（部分单元失败）
                → failed（整体失败）
                → cancelled（用户中止）
```

| 状态 | 含义 |
|---|---|
| **idle** | 会话已创建但未开始 |
| **running** | 审查正在进行 |
| **finished** | 审查正常完成 |
| **partial** | 部分单元失败，但其他单元已完成 |
| **failed** | 审查整体失败 |
| **cancelled** | 用户主动中止 |

## 流式事件类型

| 事件 | 触发时机 |
|---|---|
| **session-started** | session 创建成功 |
| **unit-completed** | 一个审查单元完成，携带该单元的 findings 和 diff |
| **unit-failed** | 一个审查单元失败，携带失败原因 |
| **session-finished** | 所有单元处理完毕 |
| **session-cancelled** | 用户中止了审查 |

## LLM Provider 相关

| 术语 | 说明 |
|---|---|
| **Provider Profile** | LLM 服务配置（baseUrl、apiKey、model） |
| **Tool-use Loop** | LLM 通过工具调用与代码交互的多轮循环 |
| **Tool Call** | LLM 在循环中发起的一次工具调用 |

## 可用工具

| 工具名 | 用途 |
|---|---|
| **file_read** | 读取指定路径的文件内容 |
| **file_find** | 按文件名关键词搜索 |
| **code_search** | 在仓库中搜索文本或正则 |
| **code_comment** | 提交审查发现的问题 |
| **file_read_diff** | 获取变更文件的 diff |
| **task_done** | 标记审查任务完成 |

## 架构分层

| 层 | 包 | 职责 |
|---|---|---|
| **domain** | `packages/review-backend/src/domain/` | Zod schema 和类型定义，不包含业务逻辑 |
| **application** | `packages/review-backend/src/application/` | 编排层，串联审查流程 |
| **infrastructure** | `packages/review-backend/src/infrastructure/` | 具体实现（git、LLM、存储、日志） |
| **contracts** | `packages/review-backend/src/contracts/` | IPC 契约 schema |

## 禁止使用的术语

以下术语在本项目中没有明确含义，不要使用：

- ~~智能审查~~ — 使用 “代码审查” 或 “review session”
- ~~缺陷检测~~ — 使用 “finding”
- ~~自动修复~~ — 本项目明确不做自动修复
- ~~PR 审查~~ — 本项目不做 GitHub/GitLab PR 集成
