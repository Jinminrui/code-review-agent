export async function getReviewSession(input: {
  sessionId: string;
  sessionStore: { getSession(sessionId: string): Promise<unknown> };
}) {
  return input.sessionStore.getSession(input.sessionId);
}
