/**
 * 模块职责：验证模块行为、边界条件和回归场景，作为实现契约的可执行说明。
 * 边界约束：测试应优先验证公开行为，不依赖实现细节；新增分支必须补充失败或边界场景。
 * 维护提示：修改时同步检查相关命令和现有测试，避免配置或断言与实际契约漂移。
 */
import { describe, expect, it, vi } from "vitest";
import { ReviewOrchestrator, type ReviewOrchestratorStages } from "../src/application/review-orchestrator.js";
import type { ReviewSessionEvent } from "../src/domain/review-session.js";

const files = [
  { path: "src/a.ts", isNew: false, isDeleted: false, isBinary: false, insertions: 1, deletions: 0, hunks: [] },
  { path: "src/b.ts", isNew: false, isDeleted: false, isBinary: false, insertions: 1, deletions: 0, hunks: [] }
];

function deps(stages: Partial<ReviewOrchestratorStages> = {}) {
  return {
    provider: { id: "fake", capabilities: { structuredOutput: true, toolCalling: true, usage: true, cancellation: true }, chat: vi.fn() },
    gitClient: {
      readDiff: vi.fn().mockResolvedValue(files), readWorkspaceDiff: vi.fn().mockResolvedValue(files),
      readFileAtRef: vi.fn().mockResolvedValue("const value = 1;\n"), lsFiles: vi.fn().mockResolvedValue([]), grep: vi.fn().mockResolvedValue([])
    },
    stages: {
      plan: vi.fn().mockResolvedValue({ status: "planned", plan: { version: 1, changeSetSummary: { files: ["src/a.ts", "src/b.ts"], totalInsertions: 2, totalDeletions: 0 }, riskAreas: [], units: [
        { unitId: "u-a", file: "src/a.ts", order: 0, checks: [], budget: { modelCalls: 1, toolCalls: 0, maxInputTokens: 100, maxOutputTokens: 100, maxReadBytes: 1000, maxDurationMs: 1000 } },
        { unitId: "u-b", file: "src/b.ts", order: 1, checks: [], budget: { modelCalls: 1, toolCalls: 0, maxInputTokens: 100, maxOutputTokens: 100, maxReadBytes: 1000, maxDurationMs: 1000 } }
      ] } }),
      react: vi.fn().mockResolvedValue({ status: "completed", evidenceBundle: { schemaVersion: 1, unitId: "u", completeness: "complete", items: [] }, usage: { modelCalls: 1, toolCalls: 0, readBytes: 0, inputTokens: 0, outputTokens: 0, usageUnavailable: false, durationMs: 1 } }),
      reflection: vi.fn().mockResolvedValue({ status: "completed", reflectionResult: { schemaVersion: 1, unitId: "u", candidates: [] }, evidenceBundle: { schemaVersion: 1, unitId: "u", completeness: "complete", items: [] }, backfill: { requested: false, requestCount: 0, toolCalls: 0, requestDenied: false } }),
      globalReflection: vi.fn().mockResolvedValue({ status: "completed", findings: [], unadopted: [] }),
      ...stages
    }
  } as const;
}

describe("ReviewOrchestrator", () => {
  it("计划降级但各审查单元成功时仍完成会话", async () => {
    const plan = vi.fn().mockResolvedValue({
      status: "plan-degraded",
      plan: {
        version: 1,
        changeSetSummary: { files: ["src/a.ts", "src/b.ts"], totalInsertions: 2, totalDeletions: 0 },
        riskAreas: [],
        units: [
          { unitId: "u-a", file: "src/a.ts", order: 0, checks: [], budget: { modelCalls: 1, toolCalls: 0, maxInputTokens: 100, maxOutputTokens: 100, maxReadBytes: 1000, maxDurationMs: 1000 } },
          { unitId: "u-b", file: "src/b.ts", order: 1, checks: [], budget: { modelCalls: 1, toolCalls: 0, maxInputTokens: 100, maxOutputTokens: 100, maxReadBytes: 1000, maxDurationMs: 1000 } }
        ]
      },
      error: { code: "provider-error", message: "Plan provider unavailable" }
    });
    const store = { appendEvent: vi.fn(), completeSession: vi.fn() };
    const orchestrator = new ReviewOrchestrator({ ...deps({ plan }), sessionStore: store });

    const events: ReviewSessionEvent[] = [];
    for await (const event of orchestrator.run({ sessionId: "s-plan-degraded", input: { repositoryPath: "/repo", baseRef: "main", targetRef: "feature", contextBudgetTokens: 1000 } })) events.push(event);

    expect(events.some((event) => event.type === "session-finished" && event.status === "finished")).toBe(true);
    expect(events.some((event) => event.type === "session-finished" && event.status === "partial")).toBe(false);
  });

  it("rejects an illegal phase transition and emits the hybrid phase order", async () => {
    const store = { appendEvent: vi.fn(), completeSession: vi.fn() };
    const orchestrator = new ReviewOrchestrator({ ...deps(), sessionStore: store });
    expect(() => orchestrator.transition("session-created", "reflection-validating")).toThrow("非法审查阶段转移");
    const events: ReviewSessionEvent[] = [];
    for await (const event of orchestrator.run({ sessionId: "s_1", input: { repositoryPath: "/repo", baseRef: "main", targetRef: "feature", contextBudgetTokens: 1000 } })) events.push(event);
    expect(events.filter((event) => event.type === "phase-transitioned").map((event) => event.phase)).toEqual([
      "pre-analysis-completed", "global-plan-completed", "unit-plan-started", "react-evidence-collecting", "reflection-validating", "unit-completed", "unit-plan-started", "react-evidence-collecting", "reflection-validating", "unit-completed", "global-reflection-validating", "global-reflection-completed", "session-finished"
    ]);
    expect(store.appendEvent.mock.invocationCallOrder.length).toBeGreaterThan(0);
  });

  it("isolates a failed unit and marks global reflection failure as partial", async () => {
    const globalReflection = vi.fn().mockResolvedValue({ status: "reflection-failed", findings: [], unadopted: [], error: { code: "provider-failed", message: "down" } });
    const react = vi.fn().mockRejectedValueOnce(new Error("unit failed")).mockResolvedValue({ status: "completed", evidenceBundle: { schemaVersion: 1, unitId: "u-b", completeness: "complete", items: [] }, usage: { modelCalls: 1, toolCalls: 0, readBytes: 0, inputTokens: 0, outputTokens: 0, usageUnavailable: false, durationMs: 1 } });
    const store = { appendEvent: vi.fn(), completeSession: vi.fn() };
    const orchestrator = new ReviewOrchestrator({ ...deps({ react, globalReflection }), sessionStore: store });
    const events: ReviewSessionEvent[] = [];
    for await (const event of orchestrator.run({ sessionId: "s_2", input: { repositoryPath: "/repo", baseRef: "main", targetRef: "feature", contextBudgetTokens: 1000 } })) events.push(event);
    expect(events.some((event) => event.type === "unit-failed" && event.unitId === "u-a")).toBe(true);
    expect(events.some((event) => event.type === "phase-transitioned" && event.phase === "unit-failed" && event.unitId === "u-a")).toBe(true);
    expect(events.some((event) => event.type === "session-finished" && event.status === "partial")).toBe(true);
    expect(globalReflection).not.toHaveBeenCalled();
  });

  it("Reflection 失败时发出 unit-failed，而不是伪装成 unit-completed", async () => {
    const reflection = vi.fn().mockResolvedValue({
      status: "reflection-failed",
      evidenceBundle: { schemaVersion: 1, unitId: "u-a", completeness: "complete", items: [] },
      backfill: { requested: false, requestCount: 0, toolCalls: 0, requestDenied: false },
      error: { code: "invalid-result", message: "candidates missing" }
    });
    const store = { appendEvent: vi.fn(), completeSession: vi.fn() };
    const orchestrator = new ReviewOrchestrator({ ...deps({ reflection }), sessionStore: store });
    const events: ReviewSessionEvent[] = [];

    for await (const event of orchestrator.run({ sessionId: "s-reflection-failed", input: { repositoryPath: "/repo", baseRef: "main", targetRef: "feature", contextBudgetTokens: 1000 } })) events.push(event);

    expect(events.some((event) => event.type === "unit-failed" && event.unitId === "u-a" && event.reason === "candidates missing")).toBe(true);
    expect(events.some((event) => event.type === "phase-transitioned" && event.phase === "unit-completed" && event.unitId === "u-a")).toBe(false);
  });

  it("cancels during plan and global reflection without finishing the session", async () => {
    const planAbort = new AbortController();
    const plan = vi.fn(async () => { planAbort.abort(); throw new DOMException("cancelled", "AbortError"); });
    const planStore = { appendEvent: vi.fn(), completeSession: vi.fn() };
    const planOrchestrator = new ReviewOrchestrator({ ...deps({ plan }), sessionStore: planStore });
    const planEvents: ReviewSessionEvent[] = [];
    for await (const event of planOrchestrator.run({ sessionId: "s-plan-cancel", signal: planAbort.signal, input: { repositoryPath: "/repo", baseRef: "main", targetRef: "feature", contextBudgetTokens: 1000 } })) planEvents.push(event);
    expect(planEvents.filter((event) => event.type === "session-cancelled")).toHaveLength(1);
    expect(planEvents.some((event) => event.type === "session-finished")).toBe(false);
    expect(planStore.completeSession).toHaveBeenCalledTimes(1);

    const globalAbort = new AbortController();
    const globalReflection = vi.fn(async () => { globalAbort.abort(); throw new DOMException("cancelled", "AbortError"); });
    const globalStore = { appendEvent: vi.fn(), completeSession: vi.fn() };
    const globalOrchestrator = new ReviewOrchestrator({ ...deps({ globalReflection }), sessionStore: globalStore });
    const globalEvents: ReviewSessionEvent[] = [];
    for await (const event of globalOrchestrator.run({ sessionId: "s-global-cancel", signal: globalAbort.signal, input: { repositoryPath: "/repo", baseRef: "main", targetRef: "feature", contextBudgetTokens: 1000 } })) globalEvents.push(event);
    expect(globalEvents.filter((event) => event.type === "session-cancelled")).toHaveLength(1);
    expect(globalEvents.some((event) => event.type === "session-finished")).toBe(false);
    expect(globalStore.completeSession).toHaveBeenCalledTimes(1);
  });

  it("resumes a persisted session by skipping completed units", async () => {
    const react = vi.fn().mockResolvedValue({ status: "completed", evidenceBundle: { schemaVersion: 1, unitId: "u-b", completeness: "complete", items: [] }, usage: { modelCalls: 1, toolCalls: 0, readBytes: 0, inputTokens: 0, outputTokens: 0, usageUnavailable: false, durationMs: 1 } });
    const store = { appendEvent: vi.fn(), completeSession: vi.fn() };
    const orchestrator = new ReviewOrchestrator({ ...deps({ react }), sessionStore: store });
    const plan = (await deps().stages.plan({ provider: deps().provider, preAnalysis: { files: [], totals: { filesChanged: 0, insertions: 0, deletions: 0 }, sensitivePathHints: [] }, diffSummary: "" })).plan;
    expect(plan.units).toHaveLength(2);
    const events: ReviewSessionEvent[] = [];
    for await (const event of orchestrator.run({ sessionId: "s-resume", resume: { persistedPhase: "unit-completed", safeResumePhase: "unit-plan-started", recoveryPhase: "unit-plan-started", plan, planVersion: plan.version, planFingerprint: ReviewOrchestrator.planFingerprint(plan), completedUnitIds: ["u-a"], unitResults: [{ unitId: "u-a", file: "src/a.ts", findings: [], reflectionResult: { schemaVersion: 1, unitId: "u-a", candidates: [] }, evidenceSummary: { schemaVersion: 1, unitId: "u-a", completeness: "complete", items: [] } }] }, input: { repositoryPath: "/repo", baseRef: "main", targetRef: "feature", contextBudgetTokens: 1000 } })) events.push(event);
    expect(react).toHaveBeenCalledTimes(1);
    expect(react.mock.calls[0]?.[0].unit.unitId).toBe("u-b");
    expect(events.some((event) => event.type === "phase-transitioned" && event.previousPhase === "unit-completed" && event.phase === "unit-plan-started" && event.unitId === "u-b")).toBe(true);
  });

  it("persists a legal rollback from an in-flight phase before resuming the unit", async () => {
    const store = { appendEvent: vi.fn(), completeSession: vi.fn() };
    const baseDeps = deps();
    const plan = (await baseDeps.stages.plan({ provider: baseDeps.provider, preAnalysis: { files: [], totals: { filesChanged: 0, insertions: 0, deletions: 0 }, sensitivePathHints: [] }, diffSummary: "" })).plan;
    const orchestrator = new ReviewOrchestrator({ ...baseDeps, sessionStore: store });
    const events: ReviewSessionEvent[] = [];
    for await (const event of orchestrator.run({ sessionId: "s-in-flight", resume: { persistedPhase: "react-evidence-collecting", safeResumePhase: "unit-plan-started", recoveryPhase: "unit-plan-started", plan, planVersion: plan.version, planFingerprint: ReviewOrchestrator.planFingerprint(plan), completedUnitIds: [], unitResults: [] }, input: { repositoryPath: "/repo", baseRef: "main", targetRef: "feature", contextBudgetTokens: 1000 } })) events.push(event);
    expect(events.some((event) => event.type === "phase-transitioned" && event.previousPhase === "react-evidence-collecting" && event.phase === "unit-plan-started" && event.unitId === "u-a")).toBe(true);
  });

  it("rebuilds completed findings and evidence for global reflection and final summary", async () => {
    const restoredFinding = { id: "f-restored", severity: "high" as const, category: "bug", summary: "restored", explanation: "restored", file: "src/a.ts", status: "file-level" as const, confidenceSignals: [] };
    const globalReflection = vi.fn().mockResolvedValue({ status: "completed", findings: [restoredFinding], unadopted: [] });
    const store = { appendEvent: vi.fn(), completeSession: vi.fn() };
    const baseDeps = deps({ globalReflection });
    const orchestrator = new ReviewOrchestrator({ ...baseDeps, sessionStore: store });
    const plan = (await baseDeps.stages.plan({ provider: baseDeps.provider, preAnalysis: { files: [], totals: { filesChanged: 0, insertions: 0, deletions: 0 }, sensitivePathHints: [] }, diffSummary: "" })).plan;
    for await (const _event of orchestrator.run({ sessionId: "s-restored", resume: {
      persistedPhase: "global-reflection-validating", safeResumePhase: "global-reflection-validating", recoveryPhase: "global-reflection-validating", planVersion: plan.version, planFingerprint: ReviewOrchestrator.planFingerprint(plan),
      plan,
      completedUnitIds: ["u-a", "u-b"],
      findings: [restoredFinding],
      fileResults: [{ unitId: "u-a", reflectionResult: { schemaVersion: 1, unitId: "u-a", candidates: [] }, findings: [restoredFinding] }],
      evidenceSummaries: [{ schemaVersion: 1, unitId: "u-a", completeness: "complete", items: [] }],
      unitResults: [
        { unitId: "u-a", file: "src/a.ts", findings: [restoredFinding], reflectionResult: { schemaVersion: 1, unitId: "u-a", candidates: [] }, evidenceSummary: { schemaVersion: 1, unitId: "u-a", completeness: "complete", items: [] } },
        { unitId: "u-b", file: "src/b.ts", findings: [], reflectionResult: { schemaVersion: 1, unitId: "u-b", candidates: [] }, evidenceSummary: { schemaVersion: 1, unitId: "u-b", completeness: "complete", items: [] } }
      ]
    }, input: { repositoryPath: "/repo", baseRef: "main", targetRef: "feature", contextBudgetTokens: 1000 } })) { /* consume */ }
    expect(globalReflection).toHaveBeenCalledWith(expect.objectContaining({ fileResults: expect.arrayContaining([expect.objectContaining({ unitId: "u-a", findings: [restoredFinding] })]), evidenceSummaries: expect.arrayContaining([expect.objectContaining({ unitId: "u-a" })]) }));
    expect(store.completeSession).toHaveBeenCalledWith("s-restored", expect.objectContaining({ findings: [restoredFinding] }));
  });

  it("does not skip a completed unit when the persisted plan fingerprint changes", async () => {
    const react = vi.fn().mockResolvedValue({ status: "completed", evidenceBundle: { schemaVersion: 1, unitId: "u-a", completeness: "complete", items: [] }, usage: { modelCalls: 1, toolCalls: 0, readBytes: 0, inputTokens: 0, outputTokens: 0, usageUnavailable: false, durationMs: 1 } });
    const store = { appendEvent: vi.fn(), completeSession: vi.fn() };
    const orchestrator = new ReviewOrchestrator({ ...deps({ react }), sessionStore: store });
    const plan = (await deps().stages.plan({ provider: deps().provider, preAnalysis: { files: [], totals: { filesChanged: 0, insertions: 0, deletions: 0 }, sensitivePathHints: [] }, diffSummary: "" })).plan;
    for await (const _event of orchestrator.run({ sessionId: "s-plan-changed", resume: { persistedPhase: "unit-plan-started", safeResumePhase: "unit-plan-started", recoveryPhase: "unit-plan-started", plan, planVersion: plan.version, planFingerprint: "different", completedUnitIds: ["u-a"], unitResults: [{ unitId: "u-a", file: "src/a.ts", findings: [], reflectionResult: { schemaVersion: 1, unitId: "u-a", candidates: [] }, evidenceSummary: { schemaVersion: 1, unitId: "u-a", completeness: "complete", items: [] } }] }, input: { repositoryPath: "/repo", baseRef: "main", targetRef: "feature", contextBudgetTokens: 1000 } })) { /* consume */ }
    expect(react).toHaveBeenCalledTimes(2);
  });

  it("cancels when reading the diff aborts", async () => {
    const controller = new AbortController();
    const store = { appendEvent: vi.fn(), completeSession: vi.fn() };
    const orchestrator = new ReviewOrchestrator({ ...deps({}), gitClient: { ...deps().gitClient, readDiff: vi.fn(async () => { controller.abort(); throw new DOMException("cancelled", "AbortError"); }) }, sessionStore: store });
    const events: ReviewSessionEvent[] = [];
    for await (const event of orchestrator.run({ sessionId: "s-diff-cancel", signal: controller.signal, input: { repositoryPath: "/repo", baseRef: "main", targetRef: "feature", contextBudgetTokens: 1000 } })) events.push(event);
    expect(events.filter((event) => event.type === "session-cancelled")).toHaveLength(1);
    expect(events.some((event) => event.type === "session-finished")).toBe(false);
  });
});
