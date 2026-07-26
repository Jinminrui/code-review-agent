/**
 * 模块职责：保存一次异步审查执行的 traceId，供日志基础设施读取。
 * 边界约束：上下文缺失时返回 undefined，不自动生成无法关联的 traceId。
 */
import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

const traceStorage = new AsyncLocalStorage<string>();

export function createTraceId(): string {
  return randomUUID();
}

export function getTraceId(): string | undefined {
  return traceStorage.getStore();
}

export function runWithTraceId<T>(traceId: string, callback: () => T): T {
  return traceStorage.run(traceId, callback);
}
