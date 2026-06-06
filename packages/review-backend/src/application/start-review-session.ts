import type { ReviewSessionInput } from "../domain/review-session.js";

export function startReviewSession(input: ReviewSessionInput) {
  return {
    sessionId: `session:${input.baseRef}:${input.targetRef}`,
    input
  };
}
