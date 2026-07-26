/**
 * 模块职责：承载本模块的稳定业务逻辑，并对外提供边界清晰的类型或函数。
 * 边界约束：输入数据应在边界处校验；不要在本模块内绕过既定的分层和 IPC 约束。
 * 维护提示：修改时优先保持现有契约和错误语义，并同步更新相关测试。
 */
// Application layer
export * from "./application/stream-review-session.js";
export * from "./application/build-review-summary.js";
export * from "./application/start-review-session.js";
export * from "./application/review-orchestrator.js";
export * from "./application/get-review-session.js";
export * from "./application/list-review-sessions.js";

// Contracts
export * from "./contracts/ipc.js";

// Domain types
export * from "./domain/provider.js";
export * from "./domain/review-finding.js";
export * from "./domain/review-session.js";
export * from "./domain/review-runtime.js";
export * from "./domain/review-evidence.js";
export * from "./domain/reflection-result.js";

export * from "./domain/tool.js";
export * from "./domain/review-plan.js";
export * from "./domain/review-rules.js";

import { logger } from "./infrastructure/logging/logger.js";

export const backendVersion = "0.1.0";

if (process.env.NODE_ENV !== "test") {
  logger.info(`review-backend v${backendVersion}`);
}
