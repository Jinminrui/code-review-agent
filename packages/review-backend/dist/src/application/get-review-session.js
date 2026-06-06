export async function getReviewSession(input) {
    return input.sessionStore.getSession(input.sessionId);
}
