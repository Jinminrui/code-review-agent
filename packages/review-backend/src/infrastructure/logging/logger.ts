/**
 * 模块职责：承载本模块的稳定业务逻辑，并对外提供边界清晰的类型或函数。
 * 边界约束：输入数据应在边界处校验；不要在本模块内绕过既定的分层和 IPC 约束。
 * 维护提示：修改时优先保持现有契约和错误语义，并同步更新相关测试。
 */
import pino from "pino";
import { LogFileSink } from "./log-file-sink.js";
import { getTraceId } from "./trace-context.js";

const level = process.env.REVIEW_LOG_LEVEL ?? process.env.LOG_LEVEL ?? "info";
const stream = pino.multistream([
  {
    level,
    stream:
      process.env.NODE_ENV !== "production"
        ? pino.transport({ target: "pino-pretty", options: { colorize: true } })
        : process.stdout
  }
]);

export const logger = pino({
  name: "review-backend",
  level,
  mixin() {
    const traceId = getTraceId();
    return traceId ? { traceId } : {};
  },
  redact: ["apiKey", "authorization", "headers.authorization"]
}, stream);

let configuredDirectory: string | undefined;

export function configureLogging(options: {
  directory: string;
  level?: string;
  maxBytes?: number;
  retentionDays?: number;
  console?: boolean;
}): void {
  if (configuredDirectory === options.directory) return;

  const sink = new LogFileSink({
    directory: options.directory,
    maxBytes: options.maxBytes ?? parsePositiveInteger(process.env.REVIEW_LOG_FILE_SIZE, 10 * 1024 * 1024),
    retentionDays: options.retentionDays ?? parsePositiveInteger(process.env.REVIEW_LOG_RETENTION_DAYS, 7)
  });
  stream.add({ level: options.level ?? level, stream: sink });
  configuredDirectory = options.directory;
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
