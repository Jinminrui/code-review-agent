import { reviewSessionEventSchema, reviewSessionInputSchema } from "../domain/review-session.js";
export const createReviewSessionRequestSchema = reviewSessionInputSchema;
export const reviewSessionEventPayloadSchema = reviewSessionEventSchema;
