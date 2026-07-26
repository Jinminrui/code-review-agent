/**
 * 模块职责：验证模块行为、边界条件和回归场景，作为实现契约的可执行说明。
 * 边界约束：测试应优先验证公开行为，不依赖实现细节；新增分支必须补充失败或边界场景。
 * 维护提示：修改时同步检查相关命令和现有测试，避免配置或断言与实际契约漂移。
 */
import { describe, expect, it } from "vitest";
import { reviewFindingSchema } from "../src/domain/review-finding.js";
import { isValidReviewPhaseTransition } from "../src/domain/review-runtime.js";
import { validateReviewSessionEventSequence } from "../src/infrastructure/storage/file-session-store.js";
import {
  MIGRATION_THRESHOLDS,
  macroAverage,
  passesMigrationGate,
  runDeterministicGoldenRuntime,
  hybridReviewGoldenCorpus,
  type GoldenRunResult,
  type HybridReviewGoldenFixture
} from "./fixtures/hybrid-review-corpus.js";

type EvaluationMetrics = {
  findingPrecision: number;
  falsePositiveRate: number;
  lineAccuracy: number;
  evidenceCompleteness: number;
  traceReplayRate: number;
};

function evaluate(fixture: HybridReviewGoldenFixture, result: GoldenRunResult): EvaluationMetrics {
  assertUniqueFindingIds(fixture.annotation.formalFindings, `${fixture.id}:formal`);
  assertUniqueFindingIds(result.findings, `${fixture.id}:result`);
  const expected = new Map(fixture.annotation.formalFindings.map((finding) => [finding.id, finding]));
  const rejected = new Set(fixture.annotation.rejectedFindingIds);
  const reported = result.findings;
  const truePositives = reported.filter((finding) => expected.has(finding.id));
  const falsePositives = reported.filter((finding) => !expected.has(finding.id) || rejected.has(finding.id));
  const lineExpected = truePositives.filter((finding) => expected.get(finding.id)?.status === "line-level");
  const lineCorrect = lineExpected.filter((finding) => finding.startLine === expected.get(finding.id)?.startLine && finding.endLine === expected.get(finding.id)?.endLine);
  const evidenceExpected = truePositives.filter((finding) => expected.get(finding.id)?.evidence);
  const evidenceComplete = evidenceExpected.filter((finding) => Boolean(finding.evidence));

  return {
    findingPrecision: reported.length === 0 ? 1 : truePositives.length / reported.length,
    falsePositiveRate: reported.length === 0 ? 0 : falsePositives.length / reported.length,
    lineAccuracy: lineExpected.length === 0 ? 1 : lineCorrect.length / lineExpected.length,
    evidenceCompleteness: evidenceExpected.length === 0 ? 1 : evidenceComplete.length / evidenceExpected.length,
    traceReplayRate: replayTrace(fixture, result) ? 1 : 0
  };
}

function assertUniqueFindingIds(findings: readonly { id: string }[], label: string): void {
  const ids = findings.map((finding) => finding.id);
  if (new Set(ids).size !== ids.length) throw new Error(`${label} 包含重复 finding ID`);
}

function replayTrace(fixture: HybridReviewGoldenFixture, result: GoldenRunResult): boolean {
  if (result.trace.length === 0) return false;
  try {
    validateReviewSessionEventSequence(result.trace, `golden-${fixture.id}`);
  } catch {
    return false;
  }
  const phaseEvents = result.trace.filter((event) => event.type === "phase-transitioned");
  const terminalEvents = result.trace.filter((event) => event.type === "session-finished" || event.type === "session-cancelled");
  if (phaseEvents.filter((event) => event.phase === "session-finished" || event.phase === "session-cancelled").length !== 1 || terminalEvents.length !== 1) return false;
  let previousSequence = 0;
  let unitId: string | undefined;
  for (const event of result.trace) {
    const sequence = previousSequence + 1;
    if (sequence <= previousSequence) return false;
    previousSequence = sequence;
    if (event.type === "phase-transitioned") {
      if (!isValidReviewPhaseTransition(event.previousPhase, event.phase)) return false;
      if (event.unitId) unitId ??= event.unitId;
      if (event.unitId && event.unitId !== unitId) return false;
    }
  }
  return true;
}

describe("hybrid review golden corpus", () => {
  it("包含六类结构化 fixture，并且每个 fixture 可通过真实 finding schema 校验", () => {
    expect(hybridReviewGoldenCorpus).toHaveLength(6);
    for (const fixture of hybridReviewGoldenCorpus) {
      expect(fixture.diff.length).toBeGreaterThan(0);
      expect(fixture.annotation.formalFindings.every((finding) => reviewFindingSchema.safeParse(finding).success)).toBe(true);
      expect(fixture.annotation.allowedFileLevelFindingIds.every((id) => fixture.annotation.formalFindings.some((finding) => finding.id === id))).toBe(true);
    }
  });

  it("用确定性 runner 对同一 fixture 产出 legacy/hybrid 可比较的结构化指标", async () => {
    const legacyRunner = runDeterministicGoldenRuntime("legacy");
    const hybridRunner = runDeterministicGoldenRuntime("hybrid");
    const comparison = [];

    for (const fixture of hybridReviewGoldenCorpus) {
      const [legacy, hybrid] = await Promise.all([legacyRunner(fixture), hybridRunner(fixture)]);
      expect(legacy.findings).toEqual(fixture.runs.legacy.findings);
      expect(hybrid.findings).toEqual(fixture.runs.hybrid.findings);
      expect(legacy.status).toBe(fixture.runs.legacy.status);
      expect(hybrid.status).toBe(fixture.runs.hybrid.status);
      expect(legacy.trace.filter((event) => event.type === "phase-transitioned").map((event) => event.phase)).toEqual(fixture.runs.legacy.trace.filter((event) => event.type === "phase-transitioned").map((event) => event.phase));
      expect(hybrid.trace.filter((event) => event.type === "phase-transitioned").map((event) => event.phase)).toEqual(fixture.runs.hybrid.trace.filter((event) => event.type === "phase-transitioned").map((event) => event.phase));
      comparison.push({
        fixtureId: fixture.id,
        legacy: evaluate(fixture, legacy),
        hybrid: evaluate(fixture, hybrid),
        findingDelta: hybrid.findings.length - legacy.findings.length
      });
    }

    expect(comparison).toHaveLength(6);
    expect(comparison.find((item) => item.fixtureId === "security-secret-leak")?.hybrid.findingPrecision).toBe(1);
    expect(comparison.find((item) => item.fixtureId === "imprecise-location")?.hybrid.lineAccuracy).toBe(1);
    expect(comparison.find((item) => item.fixtureId === "tool-model-failure")?.hybrid.traceReplayRate).toBe(1);
    expect(comparison.some((item) => item.hybrid.findingPrecision > item.legacy.findingPrecision)).toBe(true);
    const hybridAverage = macroAverage(comparison.map((item) => item.hybrid));
    expect(Object.keys(MIGRATION_THRESHOLDS)).toEqual(expect.arrayContaining(Object.keys(hybridAverage)));
    expect(passesMigrationGate(hybridAverage)).toBe(true);
    for (const metrics of comparison.flatMap((item) => [item.legacy, item.hybrid])) {
      expect(metrics.findingPrecision).toBeGreaterThanOrEqual(0);
      expect(metrics.findingPrecision).toBeLessThanOrEqual(1);
      expect(metrics.falsePositiveRate).toBeGreaterThanOrEqual(0);
      expect(metrics.falsePositiveRate).toBeLessThanOrEqual(1);
    }
  });

  it("五项迁移门槛均会影响 gate 结果", () => {
    const passing = { ...MIGRATION_THRESHOLDS };
    expect(passesMigrationGate(passing)).toBe(true);
    expect(passesMigrationGate({ ...passing, findingPrecision: passing.findingPrecision - 0.01 })).toBe(false);
    expect(passesMigrationGate({ ...passing, falsePositiveRate: passing.falsePositiveRate + 0.01 })).toBe(false);
    expect(passesMigrationGate({ ...passing, lineAccuracy: passing.lineAccuracy - 0.01 })).toBe(false);
    expect(passesMigrationGate({ ...passing, evidenceCompleteness: passing.evidenceCompleteness - 0.01 })).toBe(false);
    expect(passesMigrationGate({ ...passing, traceReplayRate: 0 })).toBe(false);
  });

  it("拒绝被人工标注为不应采纳的问题，并允许无精确行号时的 file-level 降级", async () => {
    const runner = runDeterministicGoldenRuntime("hybrid");
    for (const fixture of hybridReviewGoldenCorpus) {
      const result = await runner(fixture);
      expect(result.findings.some((finding) => fixture.annotation.rejectedFindingIds.includes(finding.id))).toBe(false);
      for (const findingId of fixture.annotation.allowedFileLevelFindingIds) {
        const reported = result.findings.find((finding) => finding.id === findingId);
        if (reported) expect(reported.status).toBe("file-level");
      }
    }
  });

  it("拒绝重复正式 finding ID，避免指标分母被重复结果污染", () => {
    const fixture = hybridReviewGoldenCorpus[0]!;
    expect(() => evaluate({ ...fixture, annotation: { ...fixture.annotation, formalFindings: [fixture.annotation.formalFindings[0]!, fixture.annotation.formalFindings[0]!] } }, fixture.runs.hybrid)).toThrow("重复 finding ID");
  });

  it("拒绝非法阶段转移、错误 unitId 和重复终态", () => {
    const fixture = hybridReviewGoldenCorpus[0]!;
    const invalid = { ...fixture.runs.hybrid, trace: fixture.runs.hybrid.trace.slice(0, -1) };
    expect(replayTrace(fixture, invalid)).toBe(false);
    expect(replayTrace(fixture, { ...fixture.runs.hybrid, trace: fixture.runs.hybrid.trace.map((event) => event.type === "phase-transitioned" && event.phase === "unit-completed" ? { ...event, unitId: "other-unit" } : event) })).toBe(false);
    expect(replayTrace(fixture, { ...fixture.runs.hybrid, trace: fixture.runs.hybrid.trace.map((event, index) => index === 1 && event.type === "phase-transitioned" ? { ...event, previousPhase: "unit-completed" } as typeof event : event) })).toBe(false);
  });
});
