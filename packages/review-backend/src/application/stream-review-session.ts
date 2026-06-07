import { buildReviewSummary } from "./build-review-summary.js";
import type { ReviewFinding } from "../domain/review-finding.js";
import type { LlmProvider } from "../domain/provider.js";
import type { ReviewSessionEvent, ReviewSessionInput } from "../domain/review-session.js";
import { collectUnitContext } from "../infrastructure/context/context-collector.js";
import type { GitClient } from "../infrastructure/git/git-client.js";
import type { ParsedDiffFile } from "../infrastructure/git/parse-unified-diff.js";
import { normalizeProviderOutput } from "../infrastructure/llm/normalize-provider-output.js";
import { buildReviewUnits } from "../infrastructure/planner/review-unit-planner.js";

type SessionStore = {
  createSession(input: {
    repositoryPath: string;
    baseRef: string;
    targetRef: string;
  }): Promise<{ sessionId: string }>;
  appendEvent(sessionId: string, event: ReviewSessionEvent): Promise<void>;
  completeSession(sessionId: string, summary: unknown): Promise<void>;
};

export async function* streamReviewSession(
  input: {
    input: ReviewSessionInput;
    dependencies: {
      provider: Pick<LlmProvider, "id" | "review">;
      gitClient: Pick<GitClient, "readDiff" | "readFileAtRef" | "readWorkspaceDiff">;
      sessionStore: SessionStore;
    };
  }
): AsyncGenerator<ReviewSessionEvent, void, void> {
  const session = await input.dependencies.sessionStore.createSession({
    repositoryPath: input.input.repositoryPath,
    baseRef: input.input.baseRef,
    targetRef: input.input.targetRef
  });

  const startedEvent = {
    type: "session-started" as const,
    sessionId: session.sessionId
  };
  await input.dependencies.sessionStore.appendEvent(session.sessionId, startedEvent);
  yield startedEvent;

  const diffFiles = input.input.targetRef === "WORKSPACE"
    ? await input.dependencies.gitClient.readWorkspaceDiff()
    : await input.dependencies.gitClient.readDiff(
        input.input.baseRef,
        input.input.targetRef
      );
  const units = buildReviewUnits(diffFiles as ParsedDiffFile[]);
  const findings: ReviewFinding[] = [];
  const diffByFile: Record<string, { original: string; modified: string }> = {};
  let hasUnitFailure = false;

  for (const unit of units) {
    try {
      const context = await collectUnitContext({
        gitClient: input.dependencies.gitClient,
        baseRef: input.input.baseRef,
        targetRef: input.input.targetRef,
        unit
      });
      diffByFile[unit.primaryFile] = {
        original: context.beforeContent,
        modified: context.afterContent
      };

      const prompt = JSON.stringify({
        task: "review",
        contextBudgetTokens: input.input.contextBudgetTokens,
        unit,
        context
      });
      const result = await input.dependencies.provider.review({ prompt });
      const unitFindings = normalizeProviderOutput({
        content: result.content,
        fallbackFile: unit.primaryFile
      });
      findings.push(...unitFindings);

      const unitCompletedEvent = {
        type: "unit-completed" as const,
        sessionId: session.sessionId,
        unitId: unit.id,
        findingsCount: unitFindings.length
      };
      await input.dependencies.sessionStore.appendEvent(session.sessionId, unitCompletedEvent);
      yield unitCompletedEvent;
    } catch (error) {
      hasUnitFailure = true;
      const unitFailedEvent = {
        type: "unit-failed" as const,
        sessionId: session.sessionId,
        unitId: unit.id,
        reason: error instanceof Error ? error.message : "unknown error"
      };
      await input.dependencies.sessionStore.appendEvent(session.sessionId, unitFailedEvent);
      yield unitFailedEvent;
    }
  }

  const finishedEvent = {
    type: "session-finished" as const,
    sessionId: session.sessionId,
    totalFindings: findings.length,
    status: hasUnitFailure ? ("partial" as const) : ("finished" as const)
  };
  const summary = buildReviewSummary({
    findings,
    changedFiles: units.map((unit) => unit.primaryFile)
  });
  await input.dependencies.sessionStore.appendEvent(session.sessionId, finishedEvent);
  await input.dependencies.sessionStore.completeSession(session.sessionId, {
    sessionId: session.sessionId,
    status: finishedEvent.status,
    repositoryPath: input.input.repositoryPath,
    baseRef: input.input.baseRef,
    targetRef: input.input.targetRef,
    summary,
    findings,
    diffByFile
  });
  yield finishedEvent;
}
