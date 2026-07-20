# 使用 AsyncGenerator 实现流式事件推送

## 状态

已采纳

## 背景

审查结果需要渐进式展示给用户，可选方案：

1. 回调函数
2. EventEmitter
3. AsyncGenerator（async function*）
4. RxJS Observable

## 决策

使用 AsyncGenerator（`async function* streamReviewSession()`）作为审查结果的流式推送机制。

## 原因

1. AsyncGenerator 是 TypeScript 原生语法，无需引入额外库。
2. 支持 `for await...of` 消费，代码简洁。
3. 天然支持背压：消费者处理完一个事件后才会请求下一个。
4. 与 Electron IPC 结合良好：主进程消费 generator，通过 `webContents.send()` 推送给渲染器。
5. 支持 `AbortSignal` 取消。

## 后果

- 无法在 generator 外部主动推送事件（只能在函数内部 yield）。
- 需要将 generator 包装为 IPC 事件流（主进程负责桥接）。
- 前端需要订阅机制（`subscribeSession`）来接收事件。
