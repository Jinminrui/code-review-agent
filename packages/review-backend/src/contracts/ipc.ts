import { z } from "zod";
import {
  reviewSessionDetailSchema,
  reviewSessionEventSchema,
  reviewSessionInputSchema
} from "../domain/review-session.js";

export const createReviewSessionRequestSchema = reviewSessionInputSchema;
export const reviewSessionEventPayloadSchema = reviewSessionEventSchema;
export const reviewSessionDetailPayloadSchema = reviewSessionDetailSchema;

export type CreateReviewSessionRequest = z.infer<typeof createReviewSessionRequestSchema>;
export type ReviewSessionEventPayload = z.infer<typeof reviewSessionEventPayloadSchema>;
export type ReviewSessionDetailPayload = z.infer<typeof reviewSessionDetailPayloadSchema>;
