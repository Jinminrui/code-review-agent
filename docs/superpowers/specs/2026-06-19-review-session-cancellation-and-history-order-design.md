# 审查历史排序与中止审查设计

- **Status:** Active

## 背景

当前审查工作台已经支持创建审查会话、流式接收审查事件、保存历史记录和回看会话详情。新的体验目标是：

1. 审查历史记录按时间倒序展示，最近的会话在上方。
2. 审查进行中可以主动中止。
3. 审查进行中侧边栏不提供返回首页入口，避免用户误以为审查已经停止。

中止后的会话必须保留在历史记录中，状态显示为“已中止”，并保留中止前已经产生的部分审查结果。

## 范围

本设计覆盖：

1. 会话时间字段和历史排序。
2. 中止审查的前端、IPC、shell 任务管理和后端流式事件。
3. 审查中侧边栏顶部按钮行为。
4. 相关测试要求。

本设计不覆盖：

1. 批量中止多个审查。
2. 恢复已中止审查。
3. 自动重跑已中止审查。
4. 关闭窗口时的后台任务恢复。

## 数据模型

### 会话时间

`FileSessionStore.createSession` 在 `session.json` 中写入：

```json
{
  "createdAt": "2026-06-19T00:00:00.000Z"
}
```

`listSessions` 返回的会话摘要包含 `createdAt`。历史列表按 `createdAt` 降序排序。旧会话没有 `createdAt` 时应兼容读取，并排在有时间字段的会话之后；旧会话之间保持文件系统读取顺序，不使用目录 mtime 推断创建时间。

### 会话状态

会话状态新增：

```ts
"cancelled"
```

状态含义：

1. `running`：审查正在执行。
2. `partial`：审查结束，但至少一个 review unit 失败。
3. `finished`：审查正常完成。
4. `failed`：会话级失败。
5. `cancelled`：用户主动中止审查。

### 事件模型

`ReviewSessionEvent` 新增：

```ts
{
  type: "session-cancelled";
  sessionId: string;
  totalFindings: number;
}
```

`session-cancelled` 是终止事件，语义上等价于“流已结束，但不是正常完成”。它必须触发会话持久化，保留取消请求前已经提交的 `findings` 和 `diffByFile`。取消请求之后才产生的 finding 不写入会话。

## 后端设计

`streamReviewSession` 接收可选 `AbortSignal`。

检查点：

1. 读取 diff 前。
2. 每个 review unit 开始前。
3. LLM tool-use loop 内已有 signal 参数，应继续向下透传。
4. finding relocation 前后。

当 signal 已中止时：

1. 不再启动新的 review unit。
2. 生成 `session-cancelled` 事件。
3. 调用 `completeSession` 写入当前已收集结果。
4. summary 使用全量 diff 文件数和取消请求前已提交的 findings 生成。
5. 会话最终状态为 `cancelled`。

已完成的 unit 不回滚，已产生的 findings 继续展示。
一旦系统接受取消请求，最终状态优先收敛为 `cancelled`，即使剩余执行本来可以自然完成。
如果取消时还没有任何 unit 完成，会话仍然保留为 `cancelled`，问题数为 0。若 diff 已成功读取，变更文件数仍来自全量 diff；若 diff 尚未成功读取，变更文件数为 0，不推断或伪造变更规模。

## Shell 与 IPC 设计

新增 IPC：

```ts
cancelSession(sessionId: string): Promise<void>
```

Shell 在 `createSession` 中维护运行中任务表：

```ts
Map<string, { abortController: AbortController }>
```

流程：

1. `createSession` 创建 `AbortController`，把 `signal` 传给 `streamReviewSession`。
2. `session-started` 后将 `sessionId -> controller` 存入任务表。
3. 后台消费 async iterator 时继续转发所有事件。
4. 收到 `session-finished` 或 `session-cancelled` 后删除任务表条目。
5. `cancelSession(sessionId)` 找到 controller 后调用 `abort()`。
6. 如果 session 不在运行中，`cancelSession` 应返回成功，保持幂等。

IPC 层只暴露结构化方法，不让 renderer 直接接触后台任务对象。

如果 `cancelSession(sessionId)` 找不到运行中任务，但持久化会话状态仍是 `running`，本轮不把它改写为 `cancelled`。这种情况可能来自应用重启、后台任务崩溃或任务刚好完成并清理，不能等同于用户主动中止。后续应单独设计“遗留运行中会话清理”能力，在应用启动或历史加载时识别 stale running session，并用独立状态或提示处理。

## 前端设计

### 历史记录

后端 `listSessions` 保证 sessions 按时间倒序。`SessionHistoryStore.fetchSessions` 直接保存后端返回结果，页面直接渲染，避免多个消费者排序不一致。

### 审查页头部

`SidebarHeader` 根据状态切换主操作：

1. `running`、`streaming`、`pending`：显示“中止审查”按钮，不显示“返回首页”。
2. `finished`、`partial`、`failed`、`cancelled`、`idle`：显示“返回首页”按钮。

点击“中止审查”：

1. 弹出确认对话框，说明“中止后会保留当前已产生的审查结果”。
2. 用户确认后调用 `ipcClient.cancelSession(sessionId)`。
3. 按钮进入 loading/disabled 状态，避免重复点击。
4. 中止完成后留在当前会话页，状态显示为“已中止”。

### 流式订阅

`useReviewSessionStream` 新增对 `session-cancelled` 的处理：

1. 更新状态为 `cancelled`。
2. 重新拉取 session detail，拿到持久化后的 summary、findings 和 diffByFile。

## 错误处理

1. `cancelSession` 调用失败时，前端显示错误提示，仍保持当前审查页。
2. 如果取消请求发出时审查刚好完成，shell 返回成功，前端随后以最终事件为准。
3. 如果后台 provider 不立即响应 abort，UI 保持“正在中止...”状态，最终由 `session-cancelled` 收敛。
4. 旧历史记录缺少 `createdAt` 时不能导致列表加载失败。
5. 如果 shell 找不到运行中任务但会话仍显示 `running`，本轮不自动标记为“已中止”；该遗留状态交给后续 stale running session 清理设计处理。

## 测试计划

### 后端

1. `streamReviewSession` 在 signal 中止后产生 `session-cancelled`。
2. 中止会话保留已完成 unit 的 findings。
3. `reviewSessionDetailSchema` 接受 `cancelled` 和 `createdAt`。
4. `FileSessionStore.listSessions` 按 `createdAt` 降序返回。
5. 旧 session 缺少 `createdAt` 时仍可读取。

### Shell

1. `cancelSession` 会 abort 对应运行中 session。
2. 已完成或不存在的 session 调用 `cancelSession` 幂等成功。
3. 收到终止事件后清理运行中任务表。

### 前端

1. 历史记录最近的会话显示在最上方。
2. 审查中不显示“返回首页”。
3. 审查中显示“中止审查”并弹确认。
4. 确认中止后调用 `cancelSession`。
5. 收到 `session-cancelled` 后显示“已中止”，并允许返回首页。

## 验收标准

1. 历史记录始终按最近时间在上展示。
2. 审查运行中侧边栏不提供返回首页入口。
3. 用户可以中止运行中的审查。
4. 中止后会话保留在历史记录中，状态为“已中止”。
5. 中止后已产生的问题和 diff 仍可回看。
6. 中止时没有已完成 unit 的会话也会保留，问题数为 0；若 diff 已读取则展示全量变更文件数，若 diff 未读取则展示 0。
7. 全量类型检查和相关测试通过。
