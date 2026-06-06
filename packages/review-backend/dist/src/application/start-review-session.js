import { streamReviewSession } from "./stream-review-session.js";
export async function startReviewSession(input) {
    const events = [];
    for await (const event of streamReviewSession(input)) {
        events.push(event);
    }
    const sessionId = events[0]?.sessionId ?? `session:${input.input.baseRef}:${input.input.targetRef}`;
    return {
        sessionId,
        events
    };
}
