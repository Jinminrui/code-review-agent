/**
 * 审查引擎过渡入口。
 * 当前实现仍位于 review-backend，先通过稳定 facade 迁移 Electron shell；后续可以把
 * application/domain/stages 逐步搬入本包，而不再让消费者依赖 backend 总入口。
 */
export {
  streamReviewSession,
  startReviewSession,
  getReviewSession,
  listReviewSessions
} from "@app/review-backend";
export type {
  ReviewSessionEvent,
  ReviewSessionInput,
  ReviewSessionDetail
} from "@app/review-backend";
