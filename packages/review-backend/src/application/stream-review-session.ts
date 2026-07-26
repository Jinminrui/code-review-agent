import { buildReviewSummary } from "./build-review-summary.js";
import { completeCancelledSession } from "./cancel-session.js";
import { normalizeFindingFiles } from "./finding-normalize.js";
import { buildDiffText, buildReviewPrompt, buildSystemPrompt } from "./review-prompts.js";
import type { ReviewFinding } from "../domain/review-finding.js";
import type { LlmProvider } from "../domain/provider.js";
import type { ReviewSessionEvent, ReviewSessionInput } from "../domain/review-session.js";
import { DEFAULT_FILTER_CONFIG } from "../domain/review-rules.js";
import { collectUnitContext } from "../infrastructure/context/context-collector.js";
import { filterReviewFiles } from "../infrastructure/filter/file-filter.js";
import type { GitClient } from "../infrastructure/git/git-client.js";
import type { ParsedDiffFile } from "../infrastructure/git/parse-unified-diff.js";
import { logger } from "../infrastructure/logging/logger.js";
import { relocateFinding } from "../infrastructure/llm/line-relocator.js";
import { generateReviewPlan } from "../infrastructure/llm/plan-generator.js";
import { runToolUseLoop } from "../infrastructure/llm/tool-use-loop.js";
import { ReviewOrchestrator } from "./review-orchestrator.js";
import type { ReviewResumeState } from "./review-orchestrator.js";
import type { ReviewRuntimeMode } from "../infrastructure/runtime-feature-flags.js";

type SessionStore = {
  createSession(input: {
    repositoryPath: string;
    baseRef: string;
    targetRef: string;
    runtimeVersion?: string;
    schemaVersion?: number;
    planVersion?: number;
  }): Promise<{ sessionId: string }>;
  appendEvent(sessionId: string, event: ReviewSessionEvent): Promise<void>;
  completeSession(sessionId: string, summary: unknown): Promise<void>;
  getRecoveryPoint?(sessionId: string): Promise<{ phase: string; resumePhase: string; unitId?: string; resumable: boolean }>;
  readEvents?(sessionId: string): Promise<ReviewSessionEvent[]>;
  getSession?(sessionId: string): Promise<{
    plan?: ReviewResumeState["plan"];
    planVersion?: number;
    planFingerprint?: string;
    findings?: ReviewResumeState["findings"];
    fileResults?: ReviewResumeState["fileResults"];
    evidenceSummaries?: ReviewResumeState["evidenceSummaries"];
    diffByFile?: ReviewResumeState["diffByFile"];
    unitResults?: ReviewResumeState["unitResults"];
  }>;
};

export async function* streamReviewSession(
  input: {
    input: ReviewSessionInput;
    mode?: ReviewRuntimeMode;
    resumeSessionId?: string;
    signal?: AbortSignal;
    dependencies: {
      provider: Pick<LlmProvider, "id" | "chat"> & Partial<Pick<LlmProvider, "capabilities">>;
      gitClient: Pick<GitClient, "readDiff" | "readFileAtRef" | "readWorkspaceDiff" | "lsFiles" | "grep">;
      sessionStore: SessionStore;
    };
  }
): AsyncGenerator<ReviewSessionEvent, void, void> {
  if (input.mode === "hybrid") {
    const session = input.resumeSessionId
      ? { sessionId: input.resumeSessionId }
      : await input.dependencies.sessionStore.createSession({
          repositoryPath: input.input.repositoryPath,
          baseRef: input.input.baseRef,
          targetRef: input.input.targetRef,
          runtimeVersion: "1.0.0",
          schemaVersion: 1,
          planVersion: 1
        });
    let resume: ReviewResumeState | undefined;
    if (input.resumeSessionId) {
      const recovery = await input.dependencies.sessionStore.getRecoveryPoint?.(input.resumeSessionId);
      if (!recovery?.resumable) throw new Error(`session ${input.resumeSessionId} is not resumable`);
      const events = await input.dependencies.sessionStore.readEvents?.(input.resumeSessionId);
      const stored = await input.dependencies.sessionStore.getSession?.(input.resumeSessionId);
      const planEvent = events?.find((event): event is Extract<ReviewSessionEvent, { type: "phase-transitioned" }> => event.type === "phase-transitioned" && event.phase === "global-plan-completed" && Boolean(event.planSnapshot));
      const unitEvents = events?.filter((event): event is Extract<ReviewSessionEvent, { type: "phase-transitioned" }> => event.type === "phase-transitioned" && event.phase === "unit-completed" && Boolean(event.unitResult)) ?? [];
      resume = {
        persistedPhase: recovery?.phase as ReviewResumeState["persistedPhase"],
        safeResumePhase: recovery?.resumePhase as ReviewResumeState["safeResumePhase"],
        unitId: recovery?.unitId,
        recoveryPhase: recovery?.resumePhase as ReviewResumeState["recoveryPhase"],
        plan: planEvent?.planSnapshot ?? stored?.plan,
        planVersion: planEvent?.planVersion ?? stored?.planVersion,
        planFingerprint: planEvent?.planFingerprint ?? stored?.planFingerprint,
        completedUnitIds: unitEvents.length > 0 ? unitEvents.map((event) => event.unitId!) : stored?.unitResults?.map((result) => result.unitId),
        findings: unitEvents.length > 0 ? unitEvents.flatMap((event) => event.unitResult!.findings) : stored?.findings,
        fileResults: unitEvents.length > 0 ? unitEvents.map((event) => ({ unitId: event.unitResult!.unitId, reflectionResult: event.unitResult!.reflectionResult, findings: event.unitResult!.findings })) : stored?.fileResults,
        evidenceSummaries: unitEvents.length > 0 ? unitEvents.map((event) => event.unitResult!.evidenceSummary) : stored?.evidenceSummaries,
        diffByFile: unitEvents.length > 0 ? Object.fromEntries(unitEvents.filter((event) => event.unitResult!.diff).map((event) => [event.unitResult!.file, event.unitResult!.diff!])) : stored?.diffByFile,
        unitResults: unitEvents.length > 0 ? unitEvents.map((event) => event.unitResult!) : stored?.unitResults
      };
    }
    const provider = input.dependencies.provider as ConstructorParameters<typeof ReviewOrchestrator>[0]["provider"];
    const orchestrator = new ReviewOrchestrator({
      provider,
      gitClient: input.dependencies.gitClient,
      sessionStore: input.dependencies.sessionStore
    });
    for await (const event of orchestrator.run({ sessionId: session.sessionId, input: input.input, signal: input.signal, resume })) {
      yield event;
    }
    return;
  }
  // 审查以事件流为边界：每个阶段先持久化事件，再向 UI 推送，保证刷新后仍可恢复进度。
  const { repositoryPath, baseRef, targetRef } = input.input;
  const signal = input.signal;

  const session = await input.dependencies.sessionStore.createSession({
    repositoryPath,
    baseRef,
    targetRef
  });
  const log = logger.child({ sid: session.sessionId.slice(0, 8) });
  log.info(`${repositoryPath} [${baseRef}...${targetRef}] 开始审查`);

  const startedEvent = {
    type: "session-started" as const,
    sessionId: session.sessionId
  };
  await input.dependencies.sessionStore.appendEvent(session.sessionId, startedEvent);
  yield startedEvent;

  let diffFiles: ParsedDiffFile[] = [];
  const findings: ReviewFinding[] = [];
  const diffByFile: Record<string, { original: string; modified: string }> = {};
  const cancelSession = async () =>
    completeCancelledSession({
      sessionId: session.sessionId,
      sessionStore: input.dependencies.sessionStore,
      repositoryPath,
      baseRef,
      targetRef,
      findings,
      diffByFile,
      changedFiles: diffFiles.map((file) => file.path)
    });

  if (signal?.aborted) {
    yield await cancelSession();
    return;
  }

  // Read diff
  const diffStartTime = Date.now();
  const allDiffFiles = targetRef === "WORKSPACE"
    ? await input.dependencies.gitClient.readWorkspaceDiff()
    : await input.dependencies.gitClient.readDiff(baseRef, targetRef);
  log.info(`读取 diff 完成: ${allDiffFiles.length} 个文件, ${Date.now() - diffStartTime}ms`);

  // Filter files
  diffFiles = filterReviewFiles({
    files: allDiffFiles as ParsedDiffFile[],
    config: DEFAULT_FILTER_CONFIG
  });

  let hasUnitFailure = false;

  for (const diffFile of diffFiles) {
    if (signal?.aborted) {
      yield await cancelSession();
      return;
    }

    const unitLog = log.child({ file: diffFile.path });
    try {
      // 每个文件是相互隔离的审查单元；单元失败只产生失败事件，不中断整个会话。
      const context = await collectUnitContext({
        gitClient: input.dependencies.gitClient,
        baseRef,
        targetRef,
        filePath: diffFile.path
      });
      const unitDiff = {
        original: context.beforeContent,
        modified: context.afterContent
      };
      diffByFile[diffFile.path] = unitDiff;

      let unitFindings: ReviewFinding[];
      const t0 = Date.now();

      // Generate plan for large changes
      const diffText = buildDiffText(diffFile.path, diffFiles);
      const diffLineCount = diffText.split("\n").length;
      let planGuidance = "";

      if (diffLineCount > 50) {
        // 大 diff 先让模型生成风险导向，减少后续工具调用在无关代码上消耗轮次。
        const plan = await generateReviewPlan({
          provider: input.dependencies.provider,
          diff: diffText,
          fileContent: context.afterContent,
          signal
        });
        const legacyPlan = plan.legacy;
        planGuidance = `\n\nReview plan:\n- Risk points: ${plan.riskAreas.map((r) => `${r.area} (${r.riskLevel})`).join(", ") || "none identified"}\n- Strategy: ${legacyPlan?.reviewStrategy ?? "Standard review: check for bugs, security issues, and code quality."}\n- Complexity: ${legacyPlan?.estimatedComplexity ?? "medium"}`;
        unitLog.info(`计划生成: ${plan.riskAreas.length} 个风险点, 复杂度=${legacyPlan?.estimatedComplexity ?? "medium"}`);
      }

      // Tool-use loop
      const systemPrompt = buildSystemPrompt(diffFile.path) + planGuidance;
      const initialUserMessage = buildReviewPrompt({
        filePath: diffFile.path,
        diff: diffText,
        beforeContent: context.beforeContent,
        afterContent: context.afterContent
      });

      const loopResult = await runToolUseLoop({
        provider: input.dependencies.provider,
        systemPrompt,
        initialUserMessage,
        signal,
        toolExecutorContext: {
          gitClient: input.dependencies.gitClient,
          baseRef,
          targetRef,
          repositoryPath,
          diffFiles
        }
      });
      unitFindings = loopResult.findings;
      unitLog.info(`审查完成: ${unitFindings.length} 个问题, ${loopResult.totalRounds} 轮, ${Date.now() - t0}ms`);

      unitFindings = normalizeFindingFiles({
        findings: unitFindings,
        primaryFile: diffFile.path,
        diffFiles,
        repositoryPath
      });

      // Relocate findings without line numbers
      unitFindings = await Promise.all(
        // 模型可能只知道问题文件和证据，缺少行号时再单独请求一次定位。
        unitFindings.map((finding) =>
          finding.startLine
            ? Promise.resolve(finding)
            : relocateFinding({
                provider: input.dependencies.provider,
                finding,
                fileContent: context.afterContent,
                signal
              })
        )
      );

      if (signal?.aborted) {
        yield await cancelSession();
        return;
      }

      findings.push(...unitFindings);

      const unitCompletedEvent = {
        type: "unit-completed" as const,
        sessionId: session.sessionId,
        unitId: diffFile.path,
        findingsCount: unitFindings.length,
        findings: unitFindings,
        diffByFile: {
          [diffFile.path]: unitDiff
        }
      };
      await input.dependencies.sessionStore.appendEvent(session.sessionId, unitCompletedEvent);
      yield unitCompletedEvent;
    } catch (error) {
      if (signal?.aborted) {
        yield await cancelSession();
        return;
      }

      hasUnitFailure = true;
      unitLog.warn(`审查失败: ${error instanceof Error ? error.message : "未知错误"}`);
      const unitFailedEvent = {
        type: "unit-failed" as const,
        sessionId: session.sessionId,
        unitId: diffFile.path,
        reason: error instanceof Error ? error.message : "unknown error"
      };
      await input.dependencies.sessionStore.appendEvent(session.sessionId, unitFailedEvent);
      yield unitFailedEvent;
    }
  }

  if (signal?.aborted) {
    yield await cancelSession();
    return;
  }

  const finishedEvent = {
    type: "session-finished" as const,
    sessionId: session.sessionId,
    totalFindings: findings.length,
    status: hasUnitFailure ? ("partial" as const) : ("finished" as const)
  };
  const summary = buildReviewSummary({
    findings,
    changedFiles: diffFiles.map((f) => f.path)
  });
  await input.dependencies.sessionStore.appendEvent(session.sessionId, finishedEvent);
  await input.dependencies.sessionStore.completeSession(session.sessionId, {
    sessionId: session.sessionId,
    status: finishedEvent.status,
    repositoryPath,
    baseRef,
    targetRef,
    summary,
    findings,
    diffByFile
  });

  log.info(`审查结束: ${finishedEvent.status}, ${findings.length} 个问题, ${summary.highSeverityCount} 个高风险`);
  yield finishedEvent;
}
