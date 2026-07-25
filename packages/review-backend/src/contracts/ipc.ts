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
