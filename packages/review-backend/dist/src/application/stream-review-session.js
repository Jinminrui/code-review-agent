import { buildReviewSummary } from "./build-review-summary.js";
import { collectUnitContext } from "../infrastructure/context/context-collector.js";
import { normalizeProviderOutput } from "../infrastructure/llm/normalize-provider-output.js";
import { buildReviewUnits } from "../infrastructure/planner/review-unit-planner.js";
export async function* streamReviewSession(input) {
    const session = await input.dependencies.sessionStore.createSession({
        repositoryPath: input.input.repositoryPath,
        baseRef: input.input.baseRef,
        targetRef: input.input.targetRef
    });
    const startedEvent = {
        type: "session-started",
        sessionId: session.sessionId
    };
    await input.dependencies.sessionStore.appendEvent(session.sessionId, startedEvent);
    yield startedEvent;
    const diffFiles = await input.dependencies.gitClient.readDiff(input.input.baseRef, input.input.targetRef);
    const units = buildReviewUnits(diffFiles);
    const findings = [];
    const diffByFile = {};
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
                providerProfileId: input.input.providerProfileId,
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
                type: "unit-completed",
                sessionId: session.sessionId,
                unitId: unit.id,
                findingsCount: unitFindings.length
            };
            await input.dependencies.sessionStore.appendEvent(session.sessionId, unitCompletedEvent);
            yield unitCompletedEvent;
        }
        catch (error) {
            hasUnitFailure = true;
            const unitFailedEvent = {
                type: "unit-failed",
                sessionId: session.sessionId,
                unitId: unit.id,
                reason: error instanceof Error ? error.message : "unknown error"
            };
            await input.dependencies.sessionStore.appendEvent(session.sessionId, unitFailedEvent);
            yield unitFailedEvent;
        }
    }
    const finishedEvent = {
        type: "session-finished",
        sessionId: session.sessionId,
        totalFindings: findings.length,
        status: hasUnitFailure ? "partial" : "finished"
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
