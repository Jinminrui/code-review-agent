/**
 * 模块职责：验证模块行为、边界条件和回归场景，作为实现契约的可执行说明。
 * 边界约束：测试应优先验证公开行为，不依赖实现细节；新增分支必须补充失败或边界场景。
 * 维护提示：修改时同步检查相关命令和现有测试，避免配置或断言与实际契约漂移。
 */
import type { ReviewFinding } from "../../src/domain/review-finding.js";
import { REVIEW_RUNTIME_VERSION, REVIEW_SCHEMA_VERSION, isValidReviewPhaseTransition } from "../../src/domain/review-runtime.js";
import { reviewFindingSchema } from "../../src/domain/review-finding.js";
import { reviewSessionEventSchema, type ReviewSessionEvent } from "../../src/domain/review-session.js";
import { validateReviewSessionEventSequence } from "../../src/infrastructure/storage/file-session-store.js";
import type { ParsedDiffFile } from "../../src/infrastructure/git/parse-unified-diff.js";

export type GoldenRunResult = {
  findings: ReviewFinding[];
  trace: ReviewSessionEvent[];
  status: "finished" | "partial";
};

export type GoldenRuntimeRunner = (fixture: HybridReviewGoldenFixture) => Promise<GoldenRunResult>;
export type GoldenRunner = GoldenRuntimeRunner;

export type GoldenEvaluationMetrics = {
  findingPrecision: number;
  falsePositiveRate: number;
  lineAccuracy: number;
  evidenceCompleteness: number;
  traceReplayRate: number;
};

export const MIGRATION_THRESHOLDS = {
  findingPrecision: 0.9,
  falsePositiveRate: 0.1,
  lineAccuracy: 0.9,
  evidenceCompleteness: 0.95,
  traceReplayRate: 1
} as const;

export type HybridReviewGoldenFixture = {
  id: string;
  title: string;
  diff: ParsedDiffFile[];
  annotation: {
    formalFindings: ReviewFinding[];
    allowedFileLevelFindingIds: string[];
    rejectedFindingIds: string[];
    candidateFindings: ReviewFinding[];
    runnerFindingIds: { legacy: string[]; hybrid: string[] };
  };
  runs: {
    legacy: GoldenRunResult;
    hybrid: GoldenRunResult;
  };
};

const diff = (path: string, content: string, line = 1): ParsedDiffFile => ({
  path,
  isNew: false,
  isDeleted: false,
  isBinary: false,
  insertions: 1,
  deletions: 0,
  hunks: [{ oldStart: line, oldCount: 1, newStart: line, newCount: 1, lines: [{ type: "added", content, oldLineNum: null, newLineNum: line }] }]
});

const finding = (id: string, file: string, summary: string, overrides: Partial<ReviewFinding> = {}): ReviewFinding => ({
  id,
  severity: "high",
  category: "bug",
  summary,
  explanation: `${summary} 的人工标注证据。`,
  file,
  evidence: "人工标注证据",
  suggestion: "补充测试并修复变更。",
  confidenceSignals: ["golden-corpus"],
  status: "line-level",
  startLine: 1,
  endLine: 1,
  ...overrides
});

const trace = (fixtureId: string, unitId: string, failed = false, totalFindings = 0): ReviewSessionEvent[] => {
  const sessionId = `golden-${fixtureId}`;
  const phase = (previousPhase: Parameters<typeof isValidReviewPhaseTransition>[0], nextPhase: Parameters<typeof isValidReviewPhaseTransition>[1], eventUnitId?: string): ReviewSessionEvent => {
    if (!isValidReviewPhaseTransition(previousPhase, nextPhase)) throw new Error(`非法 golden phase: ${previousPhase} -> ${nextPhase}`);
    const event = { type: "phase-transitioned" as const, sessionId, schemaVersion: REVIEW_SCHEMA_VERSION, runtimeVersion: REVIEW_RUNTIME_VERSION, previousPhase, phase: nextPhase, ...(eventUnitId ? { unitId: eventUnitId } : {}) };
    return reviewSessionEventSchema.parse(event);
  };
  const completedPhase = failed ? "unit-failed" as const : "unit-completed" as const;
  const events: ReviewSessionEvent[] = [
    phase("session-created", "pre-analysis-completed"),
    phase("pre-analysis-completed", "global-plan-completed"),
    phase("global-plan-completed", "unit-plan-started", unitId),
    phase("unit-plan-started", "react-evidence-collecting", unitId),
    phase("react-evidence-collecting", "reflection-validating", unitId),
    phase("reflection-validating", completedPhase, unitId),
    phase(completedPhase, "global-reflection-validating"),
    phase("global-reflection-validating", "global-reflection-completed"),
    phase("global-reflection-completed", "session-finished"),
    { type: "session-finished", sessionId, totalFindings, status: failed ? "partial" : "finished" }
  ];
  validateReviewSessionEventSequence(events, sessionId);
  return events;
};

const bugFinding = finding("bug-null-check", "src/parser.ts", "空值未处理", { category: "bug", startLine: 1, endLine: 1 });
const securityFinding = finding("security-secret-leak", "src/logger.ts", "日志泄露访问令牌", { category: "security", startLine: 7, endLine: 7 });
const contractFinding = finding("contract-api-type", "src/api.ts", "API 返回类型与调用方不一致", { category: "contract", file: "src/api.ts", startLine: 4, endLine: 4 });
const impreciseFinding = finding("imprecise-location", "src/config.ts", "配置覆盖规则可能失效", { severity: "medium", status: "file-level", startLine: undefined, endLine: undefined });
const bugFalsePositive = { ...bugFinding, id: "bug-false-positive", summary: "无依据的边界问题" };
const securityGuess = { ...securityFinding, id: "security-guess", summary: "可能存在注入风险" };
const contractLocalOnly = { ...contractFinding, id: "contract-local-only", file: "src/client.ts", summary: "调用方类型需要检查" };
const cleanStyle = { ...bugFinding, id: "clean-style", file: "src/format.ts", summary: "风格不一致" };
const configLineGuess = { ...impreciseFinding, id: "config-line-guess", status: "line-level" as const, startLine: 99, endLine: 99 };
const paymentGuess = { ...bugFinding, id: "payment-guess", file: "src/payment.ts", summary: "支付流程可能重复扣款" };

function annotation(input: {
  formalFindings: ReviewFinding[];
  candidateFindings: ReviewFinding[];
  legacy: string[];
  hybrid: string[];
  allowedFileLevelFindingIds?: string[];
  rejectedFindingIds?: string[];
}) {
  return {
    formalFindings: input.formalFindings,
    candidateFindings: input.candidateFindings,
    runnerFindingIds: { legacy: input.legacy, hybrid: input.hybrid },
    allowedFileLevelFindingIds: input.allowedFileLevelFindingIds ?? [],
    rejectedFindingIds: input.rejectedFindingIds ?? []
  };
}

export const hybridReviewGoldenCorpus: HybridReviewGoldenFixture[] = [
  {
    id: "obvious-bug",
    title: "明显 bug",
    diff: [diff("src/parser.ts", "return input.value;", 1)],
    annotation: annotation({ formalFindings: [bugFinding], candidateFindings: [bugFinding, bugFalsePositive], legacy: ["bug-null-check", "bug-false-positive"], hybrid: ["bug-null-check"], rejectedFindingIds: ["bug-false-positive"] }),
    runs: {
      legacy: { findings: [bugFinding, bugFalsePositive], trace: trace("obvious-bug", "unit-parser"), status: "finished" },
      hybrid: { findings: [bugFinding], trace: trace("obvious-bug", "unit-parser"), status: "finished" }
    }
  },
  {
    id: "security-secret-leak",
    title: "安全问题",
    diff: [diff("src/logger.ts", "logger.info(token);", 7)],
    annotation: annotation({ formalFindings: [securityFinding], candidateFindings: [securityFinding, securityGuess], legacy: ["security-guess"], hybrid: ["security-secret-leak"], rejectedFindingIds: ["security-guess"] }),
    runs: {
      legacy: { findings: [securityGuess], trace: trace("security-secret-leak", "unit-logger"), status: "finished" },
      hybrid: { findings: [securityFinding], trace: trace("security-secret-leak", "unit-logger"), status: "finished" }
    }
  },
  {
    id: "cross-file-contract",
    title: "跨文件契约",
    diff: [diff("src/api.ts", "return response.data;", 4), diff("src/client.ts", "const name: string = await getUser();", 8)],
    annotation: annotation({ formalFindings: [contractFinding], candidateFindings: [contractFinding, contractLocalOnly], legacy: ["contract-local-only"], hybrid: ["contract-api-type"], rejectedFindingIds: ["contract-local-only"] }),
    runs: {
      legacy: { findings: [contractLocalOnly], trace: trace("cross-file-contract", "unit-api"), status: "finished" },
      hybrid: { findings: [contractFinding], trace: trace("cross-file-contract", "unit-api"), status: "finished" }
    }
  },
  {
    id: "clean-change",
    title: "无问题变更",
    diff: [diff("src/format.ts", "return value.trim();", 3)],
    annotation: annotation({ formalFindings: [], candidateFindings: [cleanStyle], legacy: ["clean-style"], hybrid: [], rejectedFindingIds: ["clean-style"] }),
    runs: {
      legacy: { findings: [cleanStyle], trace: trace("clean-change", "unit-format"), status: "finished" },
      hybrid: { findings: [], trace: trace("clean-change", "unit-format"), status: "finished" }
    }
  },
  {
    id: "imprecise-location",
    title: "无法精确定位",
    diff: [diff("src/config.ts", "...defaults, ...overrides", 20)],
    annotation: annotation({ formalFindings: [impreciseFinding], candidateFindings: [impreciseFinding, configLineGuess], legacy: ["config-line-guess"], hybrid: ["imprecise-location"], allowedFileLevelFindingIds: ["imprecise-location"], rejectedFindingIds: ["config-line-guess"] }),
    runs: {
      legacy: { findings: [configLineGuess], trace: trace("imprecise-location", "unit-config"), status: "finished" },
      hybrid: { findings: [impreciseFinding], trace: trace("imprecise-location", "unit-config"), status: "finished" }
    }
  },
  {
    id: "tool-model-failure",
    title: "工具或模型失败",
    diff: [diff("src/payment.ts", "return provider.charge(input);", 12)],
    annotation: annotation({ formalFindings: [], candidateFindings: [paymentGuess], legacy: ["payment-guess"], hybrid: [], rejectedFindingIds: ["payment-guess"] }),
    runs: {
      legacy: { findings: [paymentGuess], trace: trace("tool-model-failure", "unit-payment", true), status: "partial" },
      hybrid: { findings: [], trace: trace("tool-model-failure", "unit-payment", true), status: "partial" }
    }
  }
];

export function runDeterministicGoldenRuntime(mode: "legacy" | "hybrid"): GoldenRuntimeRunner {
  return async (fixture) => {
    const changedFiles = new Set(fixture.diff.map((file) => file.path));
    const candidates = new Map(fixture.annotation.candidateFindings.map((candidate) => [candidate.id, candidate]));
    if (candidates.size !== fixture.annotation.candidateFindings.length) throw new Error(`${fixture.id} runner candidates 包含重复 finding ID`);
    const findings = fixture.annotation.runnerFindingIds[mode].map((id) => {
      const candidate = candidates.get(id);
      if (!candidate) throw new Error(`${fixture.id} runner 找不到 candidate: ${id}`);
      if (!changedFiles.has(candidate.file)) throw new Error(`${fixture.id} runner 越过变更文件范围: ${candidate.file}`);
      if (candidate.status === "file-level" && !fixture.annotation.allowedFileLevelFindingIds.includes(candidate.id)) throw new Error(`${fixture.id} runner 拒绝未授权 file-level finding: ${candidate.id}`);
      return reviewFindingSchema.parse({ ...candidate });
    });
    const status = fixture.id === "tool-model-failure" ? "partial" : "finished";
    const unitId = `unit-${fixture.diff[0]!.path.split("/").at(-1)!.replace(/\.[^.]+$/, "")}`;
    const result = { findings, trace: trace(fixture.id, unitId, status === "partial", findings.length), status } satisfies GoldenRunResult;
    validateReviewSessionEventSequence(result.trace, `golden-${fixture.id}`);
    return result;
  };
}

export function macroAverage(metrics: readonly GoldenEvaluationMetrics[]): GoldenEvaluationMetrics {
  if (metrics.length === 0) throw new Error("不能对空评测集合求平均");
  return {
    findingPrecision: metrics.reduce((sum, value) => sum + value.findingPrecision, 0) / metrics.length,
    falsePositiveRate: metrics.reduce((sum, value) => sum + value.falsePositiveRate, 0) / metrics.length,
    lineAccuracy: metrics.reduce((sum, value) => sum + value.lineAccuracy, 0) / metrics.length,
    evidenceCompleteness: metrics.reduce((sum, value) => sum + value.evidenceCompleteness, 0) / metrics.length,
    traceReplayRate: metrics.reduce((sum, value) => sum + value.traceReplayRate, 0) / metrics.length
  };
}

export function passesMigrationGate(metrics: GoldenEvaluationMetrics): boolean {
  return metrics.findingPrecision >= MIGRATION_THRESHOLDS.findingPrecision
    && metrics.falsePositiveRate <= MIGRATION_THRESHOLDS.falsePositiveRate
    && metrics.lineAccuracy >= MIGRATION_THRESHOLDS.lineAccuracy
    && metrics.evidenceCompleteness >= MIGRATION_THRESHOLDS.evidenceCompleteness
    && metrics.traceReplayRate === MIGRATION_THRESHOLDS.traceReplayRate;
}
