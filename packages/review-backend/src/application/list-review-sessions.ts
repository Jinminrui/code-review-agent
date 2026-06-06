export async function listReviewSessions(input: {
  sessionStore: { listSessions(): Promise<unknown[]> };
}) {
  return input.sessionStore.listSessions();
}
