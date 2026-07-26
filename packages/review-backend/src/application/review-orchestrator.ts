import { buildReviewSummary } from "./build-review-summary.js";
import { buildReviewPreAnalysis } from "./review-pre-analysis.js";
import { generateReviewPlanStage } from "./review-plan-stage.js";
import { runReviewReactStage, type ReviewReactStageResult } from "./review-react-stage.js";
import { runReviewReflectionStage, type ReviewReflectionStageResult } from "./review-reflection-stage.js";
import { runGlobalReviewReflectionStage } from "./global-review-reflection-stage.js";
import { validateAndNormalizeFindings } from "./review-result-validation.js";
import type { ReviewFinding } from "../domain/review-finding.js";
import type { ReviewPlan } from "../domain/review-plan.js";
import type { LlmProvider } from "../domain/provider.js";
import { REVIEW_RUNTIME_VERSION, REVIEW_SCHEMA_VERSION, isValidReviewPhaseTransition, type ReviewRuntimePhase } from "../domain/review-runtime.js";
import type { ReviewSessionEvent, ReviewSessionInput } from "../domain/review-session.js";
import { collectUnitContext } from "../infrastructure/context/context-collector.js";
import type { GitClient } from "../infrastructure/git/git-client.js";
import type { ParsedDiffFile } from "../infrastructure/git/parse-unified-diff.js";
import { PlanAuthorizer } from "../infrastructure/llm/plan-authorizer.js";
import type { GlobalEvidenceSummary, GlobalReflectionFileResult } from "../infrastructure/llm/reflection-provider.js";
import { createHash } from "node:crypto";

type Store = {
  appendEvent(sessionId: string, event: ReviewSessionEvent): Promise<void>;
  completeSession(sessionId: string, summary: unknown): Promise<void>;
};

export type ReviewOrchestratorStages = {
  plan: typeof generateReviewPlanStage;
  react: typeof runReviewReactStage;
  reflection: typeof runReviewReflectionStage;
  globalReflection: typeof runGlobalReviewReflectionStage;
};

export type ReviewOrchestratorDependencies = {
  provider: Pick<LlmProvider, "id" | "capabilities" | "chat">;
  gitClient: Pick<GitClient, "readDiff" | "readFileAtRef" | "readWorkspaceDiff" | "lsFiles" | "grep">;
  sessionStore: Store;
  stages?: Partial<ReviewOrchestratorStages>;
};

export type ReviewResumeState = {
  persistedPhase?: ReviewRuntimePhase;
  safeResumePhase?: ReviewRuntimePhase;
  unitId?: string;
  completedUnitIds?: readonly string[];
  recoveryPhase?: ReviewRuntimePhase;
  plan?: ReviewPlan;
  planVersion?: number;
  planFingerprint?: string;
  findings?: ReviewFinding[];
  fileResults?: GlobalReflectionFileResult[];
  evidenceSummaries?: GlobalEvidenceSummary[];
  diffByFile?: Record<string, { original: string; modified: string }>;
  unitResults?: Array<{
    unitId: string;
    file: string;
    findings: ReviewFinding[];
    reflectionResult: GlobalReflectionFileResult["reflectionResult"];
    evidenceSummary: GlobalEvidenceSummary;
    diff?: { original: string; modified: string };
  }>;
};

export class ReviewOrchestrator {
  private phase: ReviewRuntimePhase = "session-created";
  private completed = false;

  private readonly stages: ReviewOrchestratorStages;

  constructor(private readonly dependencies: ReviewOrchestratorDependencies) {
    this.stages = {
      plan: generateReviewPlanStage,
      react: runReviewReactStage,
      reflection: runReviewReflectionStage,
      globalReflection: runGlobalReviewReflectionStage,
      ...dependencies.stages
    };
  }

  transition(previousPhase: ReviewRuntimePhase, phase: ReviewRuntimePhase): ReviewRuntimePhase {
    if (!isValidReviewPhaseTransition(previousPhase, phase)) {
      throw new Error(`非法审查阶段转移: ${previousPhase} -> ${phase}`);
    }
    this.phase = phase;
    return phase;
  }

  static planFingerprint(plan: ReviewPlan): string {
    return fingerprintReviewPlan(plan);
  }

  async *run(input: { sessionId: string; input: ReviewSessionInput; signal?: AbortSignal; resume?: ReviewResumeState }): AsyncGenerator<ReviewSessionEvent> {
    const { sessionId, input: sessionInput, signal } = input;
    const emit = async function* (event: ReviewSessionEvent, store: Store): AsyncGenerator<ReviewSessionEvent> {
      await store.appendEvent(sessionId, event);
      yield event;
    };
    const transition = async function* (orchestrator: ReviewOrchestrator, phase: ReviewRuntimePhase, unitId?: string, details?: {
      planVersion?: number;
      planFingerprint?: string;
      planSnapshot?: ReviewPlan;
      unitResult?: NonNullable<Extract<ReviewSessionEvent, { type: "phase-transitioned" }>['unitResult']>;
    }): AsyncGenerator<ReviewSessionEvent> {
      const previousPhase = orchestrator.phase;
      orchestrator.transition(previousPhase, phase);
      yield* emit({ type: "phase-transitioned", sessionId, schemaVersion: REVIEW_SCHEMA_VERSION, runtimeVersion: REVIEW_RUNTIME_VERSION, previousPhase, phase, ...(unitId ? { unitId } : {}), ...details }, orchestrator.dependencies.sessionStore);
    };
    let allDiffFiles: ParsedDiffFile[];
    if (signal?.aborted) return yield* this.cancel(sessionId, sessionInput, []);
    try {
      allDiffFiles = (sessionInput.targetRef === "WORKSPACE"
        ? await this.dependencies.gitClient.readWorkspaceDiff()
        : await this.dependencies.gitClient.readDiff(sessionInput.baseRef, sessionInput.targetRef)) as ParsedDiffFile[];
    } catch (error) {
      if (isCancellation(error, signal)) return yield* this.cancel(sessionId, sessionInput, []);
      throw error;
    }
    const diffFiles = allDiffFiles;
    const preAnalysis = buildReviewPreAnalysis(diffFiles);
    const resume = input.resume;
    if (resume) {
      const persistedPhase = resume.persistedPhase;
      const safeResumePhase = resume.safeResumePhase;
      if (!persistedPhase || !safeResumePhase) throw new Error("恢复失败：缺少 persistedPhase 或 safeResumePhase");
      if (persistedPhase === "session-finished" || persistedPhase === "session-cancelled" || safeResumePhase === "session-finished" || safeResumePhase === "session-cancelled") {
        throw new Error("session is not resumable");
      }
      this.phase = persistedPhase;
    }
    if (!resume) yield* transition(this, "pre-analysis-completed");
    if (signal?.aborted) return yield* this.cancel(sessionId, sessionInput, []);

    let planResult;
    if (resume?.plan) {
      planResult = { status: "planned" as const, plan: resume.plan };
      if (this.phase === "pre-analysis-completed") {
        yield* transition(this, "global-plan-completed", undefined, { planSnapshot: resume.plan, planFingerprint: fingerprintReviewPlan(resume.plan), planVersion: resume.plan.version });
      }
    } else {
      if (resume && resume.recoveryPhase !== "pre-analysis-completed") {
        throw new Error("恢复失败：缺少已持久化的有效计划快照");
      }
      try {
        planResult = await this.stages.plan({ provider: this.dependencies.provider, preAnalysis, diffSummary: JSON.stringify(preAnalysis), signal });
      } catch (error) {
        if (isCancellation(error, signal)) return yield* this.cancel(sessionId, sessionInput, []);
        throw error;
      }
      if (signal?.aborted) return yield* this.cancel(sessionId, sessionInput, []);
      yield* transition(this, "global-plan-completed", undefined, { planSnapshot: planResult.plan, planFingerprint: fingerprintReviewPlan(planResult.plan), planVersion: planResult.plan.version });
    }
    const plan = planResult.plan;
    const planFingerprint = fingerprintReviewPlan(plan);
    const canReuseResults = Boolean(resume?.planVersion === plan.version && resume.planFingerprint && resume.planFingerprint === planFingerprint);
    const findings: ReviewFinding[] = canReuseResults ? [...(resume?.findings ?? [])] : [];
    const sessionUsage = { inputTokens: 0, outputTokens: 0, modelCalls: 0, toolCalls: 0, readBytes: 0 };
    const fileResults: Array<{ unitId: string; reflectionResult: Extract<ReviewReflectionStageResult, { status: "completed" | "evidence-incomplete" }>["reflectionResult"]; findings: ReviewFinding[] }> = canReuseResults ? [...(resume?.fileResults ?? [])] : [];
    const evidenceSummaries: Array<{ schemaVersion: 1; unitId: string; completeness: "complete" | "incomplete"; items: Array<{ id: string; checkId: string; source: "file_read" | "file_find" | "code_search" | "file_read_diff"; contentHash: string; summary: string }> }> = canReuseResults ? [...(resume?.evidenceSummaries ?? [])] : [];
    const diffByFile: Record<string, { original: string; modified: string }> = canReuseResults ? { ...(resume?.diffByFile ?? {}) } : {};
    const unitResults = canReuseResults ? [...(resume?.unitResults ?? [])] : [];
    let partial = planResult.status !== "planned";
    const allRestoredUnits = plan.units.every((unit) => resume?.unitResults?.some((result) => result.unitId === unit.unitId && result.file === unit.file));
    if (resume && (resume.recoveryPhase === "global-reflection-validating" || resume.recoveryPhase === "global-reflection-completed") && (!canReuseResults || !allRestoredUnits)) {
      throw new Error("恢复失败：全局 Reflection 边界缺少匹配计划或完整 unit 结果");
    }
    if (resume && resume.persistedPhase !== resume.safeResumePhase) {
      if (resume.safeResumePhase !== "unit-plan-started") throw new Error("恢复失败：执行中阶段只能安全回退到 unit-plan-started");
      const rollbackUnitId = resume.unitId ?? plan.units.find((unit) => !resume.completedUnitIds?.includes(unit.unitId))?.unitId;
      if (!rollbackUnitId) throw new Error("恢复失败：缺少执行中 unitId");
      yield* transition(this, "unit-plan-started", rollbackUnitId);
    }

    for (const unit of [...plan.units].sort((a, b) => a.order - b.order)) {
      if (signal?.aborted) return yield* this.cancel(sessionId, sessionInput, findings);
      const restoredUnit = resume?.unitResults?.find((result) => result.unitId === unit.unitId && result.file === unit.file);
      if (canReuseResults && (resume?.recoveryPhase === "global-reflection-validating" || resume?.recoveryPhase === "global-reflection-completed" || (resume?.completedUnitIds?.includes(unit.unitId) && restoredUnit))) continue;
      const resumingUnitBoundary = Boolean(resume && this.phase === "unit-plan-started");
      try {
        if (!resumingUnitBoundary) yield* transition(this, "unit-plan-started", unit.unitId);
        const context = await collectUnitContext({ gitClient: this.dependencies.gitClient, baseRef: sessionInput.baseRef, targetRef: sessionInput.targetRef, filePath: unit.file });
        const authorizers = new Map(unit.checks.map((check) => [check.id, new PlanAuthorizer({ checkId: check.id, allowedFiles: check.allowedFiles, evidenceTargets: check.evidenceTargets, budget: unit.budget })]));
        yield* transition(this, "react-evidence-collecting", unit.unitId);
        const react = await this.stages.react({ unit, authorizers, provider: this.dependencies.provider, toolExecutorContext: { gitClient: this.dependencies.gitClient, baseRef: sessionInput.baseRef, targetRef: sessionInput.targetRef, repositoryPath: sessionInput.repositoryPath, diffFiles, signal }, signal });
        sessionUsage.inputTokens += react.usage.inputTokens ?? 0;
        sessionUsage.outputTokens += react.usage.outputTokens ?? 0;
        sessionUsage.modelCalls += react.usage.modelCalls;
        sessionUsage.toolCalls += react.usage.toolCalls;
        sessionUsage.readBytes += react.usage.readBytes;
        if (sessionUsage.inputTokens + sessionUsage.outputTokens > sessionInput.contextBudgetTokens) {
          partial = true;
        }
        if (react.status === "evidence-incomplete") partial = true;
        yield* transition(this, "reflection-validating", unit.unitId);
        const reflection = await this.stages.reflection({ unit, evidenceBundle: react.evidenceBundle, candidateContext: { beforeContent: context.beforeContent, afterContent: context.afterContent }, provider: this.dependencies.provider, authorizers, toolExecutorContext: { gitClient: this.dependencies.gitClient, baseRef: sessionInput.baseRef, targetRef: sessionInput.targetRef, repositoryPath: sessionInput.repositoryPath, diffFiles, signal }, signal });
        if (reflection.status === "reflection-failed" || reflection.status === "evidence-incomplete") partial = true;
        if (reflection.status !== "reflection-failed") {
          const normalized = validateAndNormalizeFindings({ unit, evidenceBundle: reflection.evidenceBundle, reflectionResult: reflection.reflectionResult, diffFiles });
          findings.push(...normalized.findings);
          fileResults.push({ unitId: unit.unitId, reflectionResult: reflection.reflectionResult, findings: normalized.findings });
        }
        evidenceSummaries.push({ schemaVersion: 1, unitId: unit.unitId, completeness: react.evidenceBundle.completeness, items: react.evidenceBundle.items.map((item) => ({ id: item.id, checkId: item.checkId, source: item.source, contentHash: item.contentHash, summary: item.content.slice(0, 200) || "不可用" })) });
        diffByFile[unit.file] = { original: context.beforeContent, modified: context.afterContent };
        const persistedUnitResult = {
          unitId: unit.unitId,
          file: unit.file,
          findings: normalizedFindingsForPersistence(reflection, unit, react, diffFiles),
          reflectionResult: reflection.status !== "reflection-failed" ? reflection.reflectionResult : { schemaVersion: 1 as const, unitId: unit.unitId, candidates: [] },
          evidenceSummary: evidenceSummaries.at(-1)!,
          diff: diffByFile[unit.file]
        };
        const existingUnitResultIndex = unitResults.findIndex((result) => result.unitId === unit.unitId);
        if (existingUnitResultIndex >= 0) unitResults[existingUnitResultIndex] = persistedUnitResult;
        else unitResults.push(persistedUnitResult);
        yield* transition(this, "unit-completed", unit.unitId, {
          unitResult: persistedUnitResult
        });
      } catch (error) {
        if (isCancellation(error, signal)) return yield* this.cancel(sessionId, sessionInput, findings);
        partial = true;
        yield* transition(this, "unit-failed", unit.unitId);
        yield* emit({ type: "unit-failed", sessionId, unitId: unit.unitId, reason: error instanceof Error ? error.message : "unknown error" }, this.dependencies.sessionStore);
      }
    }

    if (resume && this.phase === "unit-plan-started" && resume.unitResults?.every((result) => plan.units.some((unit) => unit.unitId === result.unitId && unit.file === result.file))) {
      this.phase = "unit-completed";
    }

    try {
      if (this.phase !== "unit-completed" && this.phase !== "unit-failed" && this.phase !== "global-plan-completed" && this.phase !== "global-reflection-validating") throw new Error(`全局 Reflection 前状态非法: ${this.phase}`);
      if (this.phase !== "global-reflection-validating") yield* transition(this, "global-reflection-validating");
      const global = await this.stages.globalReflection({ reviewPlan: plan, fileResults, evidenceSummaries, provider: this.dependencies.provider, signal });
      if (signal?.aborted) return yield* this.cancel(sessionId, sessionInput, findings);
      if (global.status === "reflection-failed") partial = true;
      findings.splice(0, findings.length, ...global.findings);
      yield* transition(this, "global-reflection-completed");
    } catch (error) {
      if (isCancellation(error, signal)) return yield* this.cancel(sessionId, sessionInput, findings);
      partial = true;
      yield* transition(this, "global-reflection-completed");
    }
    yield* transition(this, "session-finished");
    const status = partial ? "partial" : "finished";
    const finished: ReviewSessionEvent = { type: "session-finished", sessionId, totalFindings: findings.length, status };
    yield* emit(finished, this.dependencies.sessionStore);
    await this.dependencies.sessionStore.completeSession(sessionId, { sessionId, status, repositoryPath: sessionInput.repositoryPath, baseRef: sessionInput.baseRef, targetRef: sessionInput.targetRef, summary: buildReviewSummary({ findings, changedFiles: diffFiles.map((file) => file.path) }), findings, diffByFile, plan, planVersion: plan.version, planFingerprint, fileResults, evidenceSummaries, unitResults });
    this.completed = true;
  }

  private async *cancel(sessionId: string, sessionInput: ReviewSessionInput, findings: ReviewFinding[]): AsyncGenerator<ReviewSessionEvent> {
    if (this.completed || this.phase === "session-cancelled") return;
    const previousPhase = this.phase;
    this.transition(previousPhase, "session-cancelled");
    await this.dependencies.sessionStore.appendEvent(sessionId, {
      type: "phase-transitioned",
      sessionId,
      schemaVersion: REVIEW_SCHEMA_VERSION,
      runtimeVersion: REVIEW_RUNTIME_VERSION,
      previousPhase,
      phase: "session-cancelled"
    });
    const event: ReviewSessionEvent = { type: "session-cancelled", sessionId, totalFindings: findings.length };
    await this.dependencies.sessionStore.appendEvent(sessionId, event);
    await this.dependencies.sessionStore.completeSession(sessionId, { sessionId, status: "cancelled", repositoryPath: sessionInput.repositoryPath, baseRef: sessionInput.baseRef, targetRef: sessionInput.targetRef, summary: buildReviewSummary({ findings, changedFiles: [] }), findings, diffByFile: {} });
    this.completed = true;
    yield event;
  }
}

function fingerprintReviewPlan(plan: ReviewPlan): string {
  return createHash("sha256").update(JSON.stringify(plan)).digest("hex");
}

function normalizedFindingsForPersistence(
  reflection: ReviewReflectionStageResult,
  unit: ReviewPlan["units"][number],
  react: ReviewReactStageResult,
  diffFiles: readonly ParsedDiffFile[]
): ReviewFinding[] {
  if (reflection.status === "reflection-failed") return [];
  return validateAndNormalizeFindings({ unit, evidenceBundle: react.evidenceBundle, reflectionResult: reflection.reflectionResult, diffFiles }).findings;
}

export function createReviewOrchestrator(dependencies: ReviewOrchestratorDependencies): ReviewOrchestrator {
  return new ReviewOrchestrator(dependencies);
}

function isCancellation(error: unknown, signal?: AbortSignal): boolean {
  if (signal?.aborted) return true;
  if (!error || typeof error !== "object") return false;
  const candidate = error as { name?: unknown; code?: unknown };
  return candidate.name === "AbortError" || candidate.code === "ABORT_ERR";
}
