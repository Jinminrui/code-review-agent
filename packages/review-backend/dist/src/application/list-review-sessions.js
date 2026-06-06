export async function listReviewSessions(input) {
    return input.sessionStore.listSessions();
}
