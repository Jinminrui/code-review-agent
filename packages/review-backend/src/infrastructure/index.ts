/**
 * 模块职责：承载本模块的稳定业务逻辑，并对外提供边界清晰的类型或函数。
 * 边界约束：输入数据应在边界处校验；不要在本模块内绕过既定的分层和 IPC 约束。
 * 维护提示：修改时优先保持现有契约和错误语义，并同步更新相关测试。
 */
export * from "./context/context-collector.js";
export * from "./filter/file-filter.js";
export * from "./git/git-client.js";
export * from "./git/parse-unified-diff.js";
export * from "./llm/normalize-provider-output.js";
export * from "./llm/openai-compatible-provider.js";
export * from "./llm/line-relocator.js";
export * from "./llm/plan-generator.js";
export * from "./llm/tool-use-loop.js";
export * from "./llm/tool-executors.js";
export * from "./logging/logger.js";
export * from "./logging/trace-context.js";
export * from "./logging/log-file-sink.js";
export * from "./logging/read-logs.js";

export * from "./storage/file-session-store.js";
export * from "./storage/paths.js";
export * from "./runtime-feature-flags.js";
