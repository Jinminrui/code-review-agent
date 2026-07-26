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
