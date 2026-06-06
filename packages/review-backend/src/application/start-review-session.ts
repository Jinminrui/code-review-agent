import type { ReviewSessionEvent, ReviewSessionInput } from "../domain/review-session.js";
import { streamReviewSession } from "./stream-review-session.js";

export async function startReviewSession(input: {
  input: ReviewSessionInput;
  dependencies: Parameters<typeof streamReviewSession>[0]["dependencies"];
}) {
  const events: ReviewSessionEvent[] = [];

  for await (const event of streamReviewSession(input)) {
    events.push(event);
  }

  const sessionId = events[0]?.sessionId ?? `session:${input.input.baseRef}:${input.input.targetRef}`;

  return {
    sessionId,
    events
  };
}
