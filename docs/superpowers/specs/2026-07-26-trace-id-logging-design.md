# TraceId 日志体系设计

## 1. 背景与目标

当前后端已经使用 Pino，但日志上下文主要依赖模块级 `child()`，审查会话只有截短的 `sessionId` 字段，且 IPC 发起的审查没有统一的请求关联标识。当一次审查跨越 diff、上下文收集、LLM、工具调用和异步事件时，排查问题需要人工拼接日志。

本次改造的目标是：一次审查会话生成一个 `traceId`，并让该会话产生的后端日志自动携带同一个 `traceId`，从而可以按 `traceId` 筛选完整调用链。

本次不包含：远程日志平台、日志查询界面、renderer 日志展示、历史会话数据迁移，以及将 traceId 暴露为新的 IPC 响应字段。

## 2. 方案选择

采用 Node.js `AsyncLocalStorage` 建立异步日志上下文，并通过 Pino `mixin` 在每条日志记录中注入当前 `traceId`。

相比显式修改所有函数签名，该方案能覆盖现有模块级 logger 和深层异步调用，改动集中在日志基础设施及审查流入口。相比只把 traceId 写入 session 事件，该方案能保证底层基础设施日志也能被关联。

## 3. 设计

### 3.1 日志上下文

`infrastructure/logging/logger.ts` 提供以下能力：

- `createTraceId()`：使用 Node `randomUUID()` 生成新的 traceId。
- `runWithTraceId(traceId, callback)`：在指定异步上下文中运行 callback。
- `getTraceId()`：读取当前异步上下文中的 traceId。
- Pino `mixin`：每次写日志时读取上下文，并在存在时增加 `traceId` 字段。

生产环境继续输出 JSON，开发环境继续使用 `pino-pretty`；两种格式都保留 `traceId` 字段。日志不记录 API key、完整代码内容或模型原始响应。

### 3.2 审查流关联

`streamReviewSession` 在一次执行开始时创建 traceId。为保持 AsyncGenerator 的流式行为，公共 generator 在推进内部 generator 的每次 `next()` 时恢复同一 traceId 上下文。这样可以覆盖跨 `await` 的日志，并不会把上下文泄漏到调用方。

同一会话日志保留已有字段：

- `traceId`：本次审查执行的主关联键；
- `sid`：已有的审查会话短 ID；
- `file`：审查单元文件路径；
- `component` / `provider`：已有模块和 provider 标识。

恢复已有 session 时生成新的 traceId，因为这是一次新的执行链；原 sessionId 保持不变，便于同时按 session 和 trace 排查。

## 4. 错误处理

traceId 生成和上下文设置失败时直接抛出错误，不伪造 ID。日志上下文不改变现有业务错误语义；单元失败仍按现有逻辑隔离并产生 `unit-failed` 事件。

## 5. 验证标准

1. traceId 是稳定格式的 UUID。
2. 在 trace 上下文内写出的 Pino 日志包含对应 traceId；上下文外日志不携带伪造 traceId。
3. 同一个 `streamReviewSession` 执行期间的后端日志使用同一个 traceId。
4. 恢复会话会产生新的 traceId。
5. 现有后端测试和类型检查通过。
