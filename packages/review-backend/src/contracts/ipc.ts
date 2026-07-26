/**
 * 模块职责：承载本模块的稳定业务逻辑，并对外提供边界清晰的类型或函数。
 * 边界约束：输入数据应在边界处校验；不要在本模块内绕过既定的分层和 IPC 约束。
 * 维护提示：修改时优先保持现有契约和错误语义，并同步更新相关测试。
 */
import { z } from "zod";
import {
  reviewSessionDetailSchema,
  reviewSessionEventSchema,
  reviewSessionInputSchema
} from "../domain/review-session.js";

// IPC 复用领域 schema，确保 renderer 看到的事件和主进程持久化的数据使用同一份契约。
export const createReviewSessionRequestSchema = reviewSessionInputSchema;
export const reviewSessionEventPayloadSchema = reviewSessionEventSchema;
export const reviewSessionDetailPayloadSchema = reviewSessionDetailSchema;

export type CreateReviewSessionRequest = z.infer<typeof createReviewSessionRequestSchema>;
export type ReviewSessionEventPayload = z.infer<typeof reviewSessionEventPayloadSchema>;
export type ReviewSessionDetailPayload = z.infer<typeof reviewSessionDetailPayloadSchema>;
