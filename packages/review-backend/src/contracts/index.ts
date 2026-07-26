/**
 * 模块职责：承载本模块的稳定业务逻辑，并对外提供边界清晰的类型或函数。
 * 边界约束：输入数据应在边界处校验；不要在本模块内绕过既定的分层和 IPC 约束。
 * 维护提示：修改时优先保持现有契约和错误语义，并同步更新相关测试。
 */
// renderer 只通过此入口消费跨进程契约，避免引入 application 或 infrastructure。
export {
  createReviewSessionRequestSchema,
  reviewSessionEventPayloadSchema,
  reviewSessionDetailPayloadSchema
} from "./ipc.js";
export type {
  CreateReviewSessionRequest,
  ReviewSessionEventPayload,
  ReviewSessionDetailPayload
} from "./ipc.js";

export { reviewFindingSchema } from "../domain/review-finding.js";
export type { ReviewFinding } from "../domain/review-finding.js";
export {
  reviewSessionInputSchema,
  reviewSessionEventSchema,
  reviewSessionDetailSchema
} from "../domain/review-session.js";
export type {
  ReviewSessionInput,
  ReviewSessionEvent,
  ReviewSessionDetail
} from "../domain/review-session.js";
