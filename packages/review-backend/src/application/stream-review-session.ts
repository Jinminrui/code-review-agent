import type { ReviewSessionEvent, ReviewSessionInput } from "../domain/review-session.js";

export async function* streamReviewSession(
  input: ReviewSessionInput
): AsyncGenerator<ReviewSessionEvent, void, void> {
  const sessionId = `session:${input.baseRef}:${input.targetRef}`;
  yield { type: "session-started", sessionId };
  yield { type: "session-finished", sessionId, totalFindings: 0 };
}
