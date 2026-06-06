export async function* streamReviewSession(input) {
    const sessionId = `session:${input.baseRef}:${input.targetRef}`;
    yield { type: "session-started", sessionId };
    yield { type: "session-finished", sessionId, totalFindings: 0 };
}
