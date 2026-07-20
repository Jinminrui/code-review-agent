import type { ReviewFinding } from "../domain/review-finding.js";
import type { ReviewSessionEvent } from "../domain/review-session.js";
import { buildReviewSummary } from "./build-review-summary.js";

type SessionStore = {
  appendEvent(sessionId: string, event: ReviewSessionEvent): Promise<void>;
  completeSession(sessionId: string, summary: unknown): Promise<void>;
};

export async function completeCancelledSession(input: {
  sessionId: string;
  sessionStore: SessionStore;
  repositoryPath: string;
  baseRef: string;
  targetRef: string;
  findings: ReviewFinding[];
  diffByFile: Record<string, { original: string; modified: string }>;
  changedFiles: string[];
}): Promise<ReviewSessionEvent> {
  const cancelledEvent = {
    type: "session-cancelled" as const,
    sessionId: input.sessionId,
    totalFindings: input.findings.length
  };
  const summary = buildReviewSummary({
    findings: input.findings,
    changedFiles: input.changedFiles
  });

  await input.sessionStore.appendEvent(input.sessionId, cancelledEvent);
  await input.sessionStore.completeSession(input.sessionId, {
    sessionId: input.sessionId,
    status: "cancelled",
    repositoryPath: input.repositoryPath,
    baseRef: input.baseRef,
    targetRef: input.targetRef,
    summary,
    findings: input.findings,
    diffByFile: input.diffByFile
  });

  return cancelledEvent;
}
