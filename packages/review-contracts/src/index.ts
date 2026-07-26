/**
 * 跨进程共享 contract。
 *
 * 这个包只包含 Zod schema、推导类型和稳定的状态转移规则，不依赖 Node、Electron、Git、LLM
 * 或任何 application/infrastructure 模块。renderer 和 shell 可以安全依赖它，而不会把后端
 * 的文件系统、加密或模型实现打进浏览器 bundle。
 */
import { z } from "zod";

export const REVIEW_SCHEMA_VERSION = 1;

export const reviewFindingSchema = z.object({
  id: z.string().min(1),
  severity: z.enum(["high", "medium", "low"]),
  category: z.string().min(1),
  summary: z.string().min(1),
  explanation: z.string().min(1),
  file: z.string().min(1),
  startLine: z.number().int().positive().optional(),
  endLine: z.number().int().positive().optional(),
  evidence: z.string().optional(),
  suggestion: z.string().optional(),
  confidenceSignals: z.array(z.string()).default([]),
  status: z.enum(["line-level", "file-level"])
});

export type ReviewFinding = z.infer<typeof reviewFindingSchema>;

export const reviewRuntimePhaseSchema = z.enum([
  "session-created",
  "pre-analysis-completed",
  "global-plan-completed",
  "unit-plan-started",
  "react-evidence-collecting",
  "reflection-validating",
  "evidence-backfill",
  "evidence-incomplete",
  "unit-completed",
  "unit-failed",
  "global-reflection-validating",
  "global-reflection-completed",
  "session-finished",
  "session-cancelled"
]);

export type ReviewRuntimePhase = z.infer<typeof reviewRuntimePhaseSchema>;

const nextPhases: Record<ReviewRuntimePhase, readonly ReviewRuntimePhase[]> = {
  "session-created": ["pre-analysis-completed", "session-cancelled"],
  "pre-analysis-completed": ["global-plan-completed", "session-cancelled"],
  "global-plan-completed": ["unit-plan-started", "global-reflection-validating", "session-cancelled"],
  "unit-plan-started": ["react-evidence-collecting", "unit-failed", "session-cancelled"],
  "react-evidence-collecting": ["reflection-validating", "evidence-incomplete", "unit-failed", "session-cancelled"],
  "reflection-validating": ["evidence-backfill", "evidence-incomplete", "unit-completed", "unit-failed", "session-cancelled"],
  "evidence-backfill": ["reflection-validating", "evidence-incomplete", "session-cancelled"],
  "evidence-incomplete": ["unit-plan-started", "global-reflection-validating", "session-cancelled"],
  "unit-completed": ["unit-plan-started", "global-reflection-validating", "session-cancelled"],
  "unit-failed": ["unit-plan-started", "global-reflection-validating", "session-cancelled"],
  "global-reflection-validating": ["global-reflection-completed", "session-cancelled"],
  "global-reflection-completed": ["session-finished", "session-cancelled"],
  "session-finished": [],
  "session-cancelled": []
};

export function isValidReviewPhaseTransition(previous: ReviewRuntimePhase, next: ReviewRuntimePhase): boolean {
  return nextPhases[previous].includes(next);
}

const phaseBudgetSchema = z.object({
  modelCalls: z.number().int().nonnegative(),
  toolCalls: z.number().int().nonnegative(),
  maxInputTokens: z.number().int().nonnegative(),
  maxOutputTokens: z.number().int().nonnegative(),
  maxReadBytes: z.number().int().nonnegative(),
  maxDurationMs: z.number().int().nonnegative()
});

const reviewPlanSchema = z.object({
  version: z.number().int().positive(),
  changeSetSummary: z.object({
    files: z.array(z.string().min(1)),
    totalInsertions: z.number().int().nonnegative(),
    totalDeletions: z.number().int().nonnegative()
  }),
  riskAreas: z.array(z.object({
    id: z.string().min(1),
    area: z.string().min(1),
    riskLevel: z.enum(["high", "medium", "low"]),
    reasoning: z.string().min(1),
    relatedFiles: z.array(z.string().min(1))
  })),
  units: z.array(z.object({
    unitId: z.string().min(1),
    file: z.string().min(1),
    order: z.number().int().nonnegative(),
    checks: z.array(z.object({
      id: z.string().min(1),
      description: z.string().min(1),
      completionCriteria: z.array(z.string().min(1)),
      allowedFiles: z.array(z.string().min(1)),
      evidenceTargets: z.array(z.string().min(1))
    })),
    budget: phaseBudgetSchema
  })),
  revision: z.object({ reason: z.string().min(1), previousVersion: z.number().int().positive() }).optional()
});

type ReviewPlan = z.infer<typeof reviewPlanSchema>;

const evidenceSummarySchema = z.object({
  schemaVersion: z.literal(REVIEW_SCHEMA_VERSION),
  unitId: z.string().min(1),
  completeness: z.enum(["complete", "incomplete"]),
  items: z.array(z.object({
    id: z.string().min(1),
    checkId: z.string().min(1),
    source: z.enum(["file_read", "file_find", "code_search", "file_read_diff"]),
    contentHash: z.string().min(1),
    summary: z.string().min(1)
  }))
});

const reflectionResultSchema = z.object({
  schemaVersion: z.literal(REVIEW_SCHEMA_VERSION),
  unitId: z.string().min(1).optional(),
  candidates: z.array(z.object({
    finding: reviewFindingSchema,
    evidenceIds: z.array(z.string().min(1)),
    counterEvidence: z.string(),
    decision: z.enum(["accept", "reject", "needs-review"]),
    decisionReason: z.string().min(1)
  })),
  backfillRequest: z.object({
    checkId: z.string().min(1),
    reason: z.string().min(1),
    allowedTool: z.enum(["file_read", "file_find", "code_search", "file_read_diff"]),
    arguments: z.record(z.unknown())
  }).optional()
});

const unitResultSchema = z.object({
  unitId: z.string().min(1),
  file: z.string().min(1),
  findings: z.array(reviewFindingSchema),
  reflectionResult: reflectionResultSchema,
  evidenceSummary: evidenceSummarySchema,
  diff: z.object({ original: z.string(), modified: z.string() }).optional()
});

const phaseTransitionedSchema = z.object({
  type: z.literal("phase-transitioned"),
  sessionId: z.string().min(1),
  unitId: z.string().min(1).optional(),
  schemaVersion: z.literal(REVIEW_SCHEMA_VERSION),
  runtimeVersion: z.string().min(1),
  previousPhase: reviewRuntimePhaseSchema,
  phase: reviewRuntimePhaseSchema,
  planVersion: z.number().int().positive().optional(),
  planFingerprint: z.string().min(1).optional(),
  planSnapshot: reviewPlanSchema.optional(),
  unitResult: unitResultSchema.optional()
}).superRefine((event, context) => {
  if (!isValidReviewPhaseTransition(event.previousPhase, event.phase)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["phase"], message: "非法审查阶段转移" });
  }
  const unitPhases = ["unit-plan-started", "react-evidence-collecting", "reflection-validating", "evidence-backfill", "evidence-incomplete", "unit-completed", "unit-failed"];
  if (unitPhases.includes(event.phase) && !event.unitId) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["unitId"], message: "unit 阶段必须携带 unitId" });
  }
});

const legacyEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("session-started"), sessionId: z.string() }),
  z.object({ type: z.literal("unit-completed"), sessionId: z.string(), unitId: z.string(), findingsCount: z.number().int().nonnegative(), findings: z.array(reviewFindingSchema), diffByFile: z.record(z.object({ original: z.string(), modified: z.string() })) }),
  z.object({ type: z.literal("unit-failed"), sessionId: z.string(), unitId: z.string(), reason: z.string() }),
  z.object({ type: z.literal("session-finished"), sessionId: z.string(), totalFindings: z.number().int().nonnegative(), status: z.enum(["finished", "partial"]) }),
  z.object({ type: z.literal("session-cancelled"), sessionId: z.string(), totalFindings: z.number().int().nonnegative() })
]);

export const reviewSessionEventSchema = z.union([legacyEventSchema, phaseTransitionedSchema]);
export type ReviewSessionEvent = z.infer<typeof reviewSessionEventSchema>;
export const reviewSessionEventPayloadSchema = reviewSessionEventSchema;

export const reviewSessionInputSchema = z.object({
  repositoryPath: z.string().min(1),
  baseRef: z.string().min(1),
  targetRef: z.string().min(1),
  contextBudgetTokens: z.number().int().positive().default(12000)
});
export type ReviewSessionInput = z.infer<typeof reviewSessionInputSchema>;
export const createReviewSessionRequestSchema = reviewSessionInputSchema;
export type CreateReviewSessionRequest = z.infer<typeof createReviewSessionRequestSchema>;

export const reviewSessionDetailSchema = z.object({
  sessionId: z.string(),
  status: z.enum(["idle", "running", "partial", "finished", "failed", "cancelled"]),
  createdAt: z.string().optional(),
  repositoryPath: z.string(),
  baseRef: z.string(),
  targetRef: z.string(),
  summary: z.object({ changedFilesCount: z.number(), findingsCount: z.number(), highSeverityCount: z.number(), files: z.array(z.string()) }),
  findings: z.array(reviewFindingSchema),
  diffByFile: z.record(z.object({ original: z.string(), modified: z.string() }))
});
export type ReviewSessionDetail = z.infer<typeof reviewSessionDetailSchema>;
export const reviewSessionDetailPayloadSchema = reviewSessionDetailSchema;
export type ReviewSessionEventPayload = ReviewSessionEvent;
