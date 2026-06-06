export function startReviewSession(input) {
    return {
        sessionId: `session:${input.baseRef}:${input.targetRef}`,
        input
    };
}
