/**
 * 模块职责：承载本模块的稳定业务逻辑，并对外提供边界清晰的类型或函数。
 * 边界约束：输入数据应在边界处校验；不要在本模块内绕过既定的分层和 IPC 约束。
 * 维护提示：修改时优先保持现有契约和错误语义，并同步更新相关测试。
 */
import { buildReviewSummary } from "./build-review-summary.js";
import { buildReviewPreAnalysis } from "./review-pre-analysis.js";
import { buildDeterministicReviewPlan, generateReviewPlanStage } from "./review-plan-stage.js";
import { runReviewReactStage, type ReviewReactStageResult } from "./review-react-stage.js";
import { runReviewReflectionStage, type ReviewReflectionStageResult } from "./review-reflection-stage.js";
import { runGlobalReviewReflectionStage } from "./global-review-reflection-stage.js";
import { validateAndNormalizeFindings } from "./review-result-validation.js";
import type { ReviewFinding } from "../domain/review-finding.js";
import { DEFAULT_REVIEW_PLAN, type ReviewPlan } from "../domain/review-plan.js";
import type { LlmProvider } from "../domain/provider.js";
import { REVIEW_RUNTIME_VERSION, REVIEW_SCHEMA_VERSION, isValidReviewPhaseTransition, type ReviewRuntimePhase, type StageDiagnostic } from "../domain/review-runtime.js";
import type { ReviewSessionEvent, ReviewSessionInput } from "../domain/review-session.js";
import { collectUnitContext } from "../infrastructure/context/context-collector.js";
import type { GitClient } from "../infrastructure/git/git-client.js";
import type { ParsedDiffFile } from "../infrastructure/git/parse-unified-diff.js";
import { PlanAuthorizer } from "../infrastructure/llm/plan-authorizer.js";
import type { GlobalEvidenceSummary, GlobalReflectionFileResult } from "../infrastructure/llm/reflection-provider.js";
import { createHash } from "node:crypto";
import { logger } from "../infrastructure/logging/logger.js";

const log = logger.child({ component: "review-orchestrator" });

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
  // phase 是唯一的运行时游标；所有跳转都必须经过 transition，保证内存状态
  // 与持久化的 phase-transitioned 事件遵守同一套合法转移表。
  private phase: ReviewRuntimePhase = "session-created";
  // 保护正常完成和取消路径，避免重复写入终态事件或 summary。
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
    // 事件必须先落盘再 yield，避免 renderer 看到了无法在刷新后恢复的进度。
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
    // diff 是后续所有阶段共享的确定性输入；读取失败或取消时不能进入 Plan。
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
    if (diffFiles.length === 0 && !resume) {
      yield* transition(this, "pre-analysis-completed");
      yield* transition(this, "global-plan-completed", undefined, {
        planSnapshot: DEFAULT_REVIEW_PLAN,
        planFingerprint: fingerprintReviewPlan(DEFAULT_REVIEW_PLAN),
        planVersion: DEFAULT_REVIEW_PLAN.version
      });
      yield* transition(this, "global-reflection-validating");
      yield* transition(this, "global-reflection-completed");
      yield* transition(this, "session-finished");

      const finished: ReviewSessionEvent = {
        type: "session-finished",
        sessionId,
        totalFindings: 0,
        status: "finished"
      };
      yield* emit(finished, this.dependencies.sessionStore);
      await this.dependencies.sessionStore.completeSession(sessionId, {
        sessionId,
        status: "finished",
        repositoryPath: sessionInput.repositoryPath,
        baseRef: sessionInput.baseRef,
        targetRef: sessionInput.targetRef,
        summary: buildReviewSummary({ findings: [], changedFiles: [] }),
        findings: [],
        diffByFile: {},
        plan: DEFAULT_REVIEW_PLAN,
        planVersion: DEFAULT_REVIEW_PLAN.version,
        planFingerprint: fingerprintReviewPlan(DEFAULT_REVIEW_PLAN),
        fileResults: [],
        evidenceSummaries: [],
        unitResults: []
      });
      this.completed = true;
      return;
    }
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
        planResult = shouldUseDeterministicPlan(preAnalysis)
          ? { status: "planned" as const, plan: buildDeterministicReviewPlan(preAnalysis) }
          : await this.stages.plan({ provider: this.dependencies.provider, preAnalysis, diffSummary: JSON.stringify(preAnalysis), signal });
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
    // 只有计划版本和 fingerprint 同时匹配才复用历史结果，防止计划变化后证据错配。
    const findings: ReviewFinding[] = canReuseResults ? [...(resume?.findings ?? [])] : [];
    const sessionUsage = { inputTokens: 0, outputTokens: 0, modelCalls: 0, toolCalls: 0, readBytes: 0 };
    const degradationReasons: string[] = [];
    const stageDiagnostics: StageDiagnostic[] = [];
    const addDegradationReason = (reason: string) => {
      if (!degradationReasons.includes(reason)) degradationReasons.push(reason);
    };
    const fileResults: Array<{ unitId: string; reflectionResult: Extract<ReviewReflectionStageResult, { status: "completed" | "evidence-incomplete" }>["reflectionResult"]; findings: ReviewFinding[] }> = canReuseResults ? [...(resume?.fileResults ?? [])] : [];
    const evidenceSummaries: Array<{ schemaVersion: 1; unitId: string; completeness: "complete" | "incomplete"; items: Array<{ id: string; checkId: string; source: "file_read" | "file_find" | "code_search" | "file_read_diff"; contentHash: string; summary: string }> }> = canReuseResults ? [...(resume?.evidenceSummaries ?? [])] : [];
    const diffByFile: Record<string, { original: string; modified: string }> = canReuseResults ? { ...(resume?.diffByFile ?? {}) } : {};
    const unitResults = canReuseResults ? [...(resume?.unitResults ?? [])] : [];
    // Plan 降级仍有确定性的 fallback 计划；只有执行或 Reflection 失败才影响最终状态。
    let partial = false;
    if (planResult.status !== "planned") {
      addDegradationReason(`plan:${planResult.error.code}`);
      log.warn({
        stage: "plan",
        code: planResult.error.code,
        message: planResult.error.message,
        files: planResult.error.files,
        details: planResult.error.details,
        sessionId
      }, "Plan 阶段降级");
    }
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

    // unit 串行执行，保证预算累计、事件顺序和 Global Reflection 输入可回放。
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
        stageDiagnostics.push({
          stage: "react",
          unitId: unit.unitId,
          status: react.status === "completed" ? "completed" : "incomplete",
          usage: react.usage
        });
        if (sessionUsage.inputTokens + sessionUsage.outputTokens > sessionInput.contextBudgetTokens) {
          partial = true;
          addDegradationReason("context-budget-exceeded");
        }
        if (react.status === "evidence-incomplete") {
          partial = true;
          addDegradationReason("evidence-incomplete");
        }
        yield* transition(this, "reflection-validating", unit.unitId);
        const reflection = await this.stages.reflection({ unit, evidenceBundle: react.evidenceBundle, candidateContext: { beforeContent: context.beforeContent, afterContent: context.afterContent }, provider: this.dependencies.provider, authorizers, toolExecutorContext: { gitClient: this.dependencies.gitClient, baseRef: sessionInput.baseRef, targetRef: sessionInput.targetRef, repositoryPath: sessionInput.repositoryPath, diffFiles, signal }, signal });
        if (reflection.usage) {
          sessionUsage.inputTokens += reflection.usage.inputTokens ?? 0;
          sessionUsage.outputTokens += reflection.usage.outputTokens ?? 0;
          sessionUsage.modelCalls += reflection.usage.modelCalls;
          sessionUsage.toolCalls += reflection.usage.toolCalls;
          sessionUsage.readBytes += reflection.usage.readBytes ?? 0;
        }
        stageDiagnostics.push({
          stage: "reflection",
          unitId: unit.unitId,
          status: reflection.status === "reflection-failed" ? "failed" : reflection.status === "evidence-incomplete" ? "incomplete" : "completed",
          ...(reflection.status === "reflection-failed" ? { reason: reflection.error.code } : {}),
          ...(reflection.usage ? { usage: reflection.usage } : {})
        });
        if (reflection.status === "reflection-failed" || reflection.status === "evidence-incomplete") {
          partial = true;
          addDegradationReason(reflection.status);
        }
        if (reflection.status === "reflection-failed") {
          log.warn({ stage: "reflection", code: reflection.error.code, message: reflection.error.message, sessionId, unitId: unit.unitId }, "文件级 Reflection 失败");
          partial = true;
          addDegradationReason("unit-failed");
          const reason = reflection.error.message;
          yield* transition(this, "unit-failed", unit.unitId);
          yield* emit({ type: "unit-failed", sessionId, unitId: unit.unitId, reason }, this.dependencies.sessionStore);
          continue;
        }
        const normalized = validateAndNormalizeFindings({ unit, evidenceBundle: reflection.evidenceBundle, reflectionResult: reflection.reflectionResult, diffFiles });
        findings.push(...normalized.findings);
        fileResults.push({ unitId: unit.unitId, reflectionResult: reflection.reflectionResult, findings: normalized.findings });
        evidenceSummaries.push({ schemaVersion: 1, unitId: unit.unitId, completeness: react.evidenceBundle.completeness, items: react.evidenceBundle.items.map((item) => ({ id: item.id, checkId: item.checkId, source: item.source, contentHash: item.contentHash, summary: item.content.slice(0, 200) || "不可用" })) });
        diffByFile[unit.file] = { original: context.beforeContent, modified: context.afterContent };
        const persistedUnitResult = {
          unitId: unit.unitId,
          file: unit.file,
          findings: normalizedFindingsForPersistence(reflection, unit, react, diffFiles),
          reflectionResult: reflection.reflectionResult,
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
        addDegradationReason("unit-failed");
        log.error({
          stage: "review-unit",
          code: "unhandled-error",
          message: error instanceof Error ? error.message : "unknown error",
          sessionId,
          unitId: unit.unitId
        }, "审查单元执行失败");
        yield* transition(this, "unit-failed", unit.unitId);
        yield* emit({ type: "unit-failed", sessionId, unitId: unit.unitId, reason: error instanceof Error ? error.message : "unknown error" }, this.dependencies.sessionStore);
      }
    }

    if (resume && this.phase === "unit-plan-started" && resume.unitResults?.every((result) => plan.units.some((unit) => unit.unitId === result.unitId && unit.file === result.file))) {
      this.phase = "unit-completed";
    }

    // Global Reflection 只合并或拒绝已有文件级结果，不能绕过证据边界新增问题。
    // 任一 unit 失败时输入不完整，跳过该阶段并保留已完成 unit 的 findings，避免二次失败。
    const missingGlobalUnitIds = plan.units
      .filter((unit) => !fileResults.some((result) => result.unitId === unit.unitId))
      .map((unit) => unit.unitId);
    if (missingGlobalUnitIds.length > 0 && !resume) {
      partial = true;
      addDegradationReason("missing-unit-results");
      log.warn({
        stage: "global-reflection",
        code: "incomplete-unit-results",
        missingUnitIds: missingGlobalUnitIds,
        sessionId
      }, "跳过全局 Reflection：存在失败或缺失的审查单元");
      if (this.phase !== "global-reflection-validating") yield* transition(this, "global-reflection-validating");
      yield* transition(this, "global-reflection-completed");
    } else {
      try {
        if (this.phase !== "unit-completed" && this.phase !== "unit-failed" && this.phase !== "global-plan-completed" && this.phase !== "global-reflection-validating") throw new Error(`全局 Reflection 前状态非法: ${this.phase}`);
        if (this.phase !== "global-reflection-validating") yield* transition(this, "global-reflection-validating");
        if (sessionUsage.inputTokens + sessionUsage.outputTokens > sessionInput.contextBudgetTokens) {
          partial = true;
          addDegradationReason("global-reflection-budget-soft-limit-exceeded");
        }
        const global = await this.stages.globalReflection({ reviewPlan: plan, fileResults, evidenceSummaries, provider: this.dependencies.provider, signal });
        if (global.usage) {
          sessionUsage.inputTokens += global.usage.inputTokens ?? 0;
          sessionUsage.outputTokens += global.usage.outputTokens ?? 0;
          sessionUsage.modelCalls += global.usage.modelCalls;
          sessionUsage.toolCalls += global.usage.toolCalls;
          sessionUsage.readBytes += global.usage.readBytes ?? 0;
        }
        stageDiagnostics.push({
          stage: "global-reflection",
          status: global.status === "reflection-failed" ? "fallback" : "completed",
          ...(global.status === "reflection-failed" ? { reason: global.error.code } : {}),
          ...(global.usage ? { usage: global.usage } : {})
        });
        if (signal?.aborted) return yield* this.cancel(sessionId, sessionInput, findings);
        if (global.status === "reflection-failed") {
          partial = true;
          addDegradationReason("global-reflection-failed");
          log.warn({ stage: "global-reflection", code: global.error.code, message: global.error.message, sessionId }, "全局 Reflection 失败");
        }
        findings.splice(0, findings.length, ...global.findings);
        yield* transition(this, "global-reflection-completed");
      } catch (error) {
        if (isCancellation(error, signal)) return yield* this.cancel(sessionId, sessionInput, findings);
        partial = true;
        addDegradationReason("global-reflection-error");
        log.error({
          stage: "global-reflection",
          code: "unhandled-error",
          message: error instanceof Error ? error.message : "unknown error",
          sessionId
        }, "全局 Reflection 执行失败");
        yield* transition(this, "global-reflection-completed");
      }
    }
    yield* transition(this, "session-finished");
    const status = partial ? "partial" : "finished";
    log.info({
      sessionId,
      budgetUsed: sessionUsage,
      budgetLimit: { contextBudgetTokens: sessionInput.contextBudgetTokens },
      degradationReasons
    }, "审查诊断汇总");
    const finished: ReviewSessionEvent = { type: "session-finished", sessionId, totalFindings: findings.length, status };
    yield* emit(finished, this.dependencies.sessionStore);
    await this.dependencies.sessionStore.completeSession(sessionId, { sessionId, status, repositoryPath: sessionInput.repositoryPath, baseRef: sessionInput.baseRef, targetRef: sessionInput.targetRef, summary: buildReviewSummary({ findings, changedFiles: diffFiles.map((file) => file.path) }), findings, diffByFile, plan, planVersion: plan.version, planFingerprint, fileResults, evidenceSummaries, unitResults, diagnostics: { budgetUsed: sessionUsage, budgetLimit: { contextBudgetTokens: sessionInput.contextBudgetTokens }, degradationReasons, stageDiagnostics, globalFallback: { used: degradationReasons.includes("global-reflection-failed"), ...(degradationReasons.includes("global-reflection-failed") ? { reason: "global-reflection-failed" } : {}) } } });
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

function shouldUseDeterministicPlan(preAnalysis: { files: readonly unknown[]; totals: { insertions: number; deletions: number } }): boolean {
  return preAnalysis.files.length <= 1 && preAnalysis.totals.insertions + preAnalysis.totals.deletions <= 50;
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
