import { z } from "zod";
import { reviewSessionEventSchema, reviewSessionInputSchema } from "../domain/review-session.js";

export const createReviewSessionRequestSchema = reviewSessionInputSchema;
export const reviewSessionEventPayloadSchema = reviewSessionEventSchema;

export type CreateReviewSessionRequest = z.infer<typeof createReviewSessionRequestSchema>;
export type ReviewSessionEventPayload = z.infer<typeof reviewSessionEventPayloadSchema>;
