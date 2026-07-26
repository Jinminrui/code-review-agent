import { z } from "zod";
import {
  reviewFindingSchema,
  reviewSessionDetailSchema,
  reviewSessionEventSchema
} from "@app/review-backend/contracts";
import type {
  ReviewFinding,
  ReviewSessionDetail,
  ReviewSessionEvent
} from "@app/review-backend/contracts";

// Re-export 后端类型，保持前端导入路径不变
export type { ReviewFinding, ReviewSessionDetail, ReviewSessionEvent };
export { reviewFindingSchema, reviewSessionDetailSchema, reviewSessionEventSchema };

export type ReviewUiPhase = "pre-analysis" | "planning" | "evidence" | "validation" | "complete";
export type ReviewCheckProgress = { id: string; description: string; status: string };
export type ReviewTrace = {
  planSummary: string | null;
  toolSummaries: string[] | null;
  evidenceSources: string[];
  reflectionConclusion: string | null;
  degradation: string | null;
};
export type ReviewProgressState = {
  phase: ReviewUiPhase;
  currentUnit: string | null;
  checks: ReviewCheckProgress[];
  budget: {
    modelCalls: number;
    toolCalls: number;
    maxInputTokens: number;
    maxOutputTokens: number;
    maxReadBytes: number;
    maxDurationMs: number;
  } | null;
  degradation: string | null;
  trace: ReviewTrace;
};

const initialTrace = (): ReviewTrace => ({
  planSummary: null,
  toolSummaries: null,
  evidenceSources: [],
  reflectionConclusion: null,
  degradation: null
});

export function createInitialReviewProgress(): ReviewProgressState {
  return {
    phase: "pre-analysis",
    currentUnit: null,
    checks: [],
    budget: null,
    degradation: null,
    trace: initialTrace()
  };
}

function phaseToUi(phase: ReviewSessionEvent extends infer T ? T extends { type: "phase-transitioned"; phase: infer P } ? P : never : never): ReviewUiPhase {
  switch (phase) {
    case "pre-analysis-completed": return "pre-analysis";
    case "global-plan-completed": return "planning";
    case "global-reflection-validating":
    case "global-reflection-completed":
    case "reflection-validating":
    case "evidence-backfill":
    case "evidence-incomplete": return "validation";
    case "unit-plan-started":
    case "react-evidence-collecting": return "evidence";
    case "unit-completed":
    case "unit-failed":
    case "session-finished": return "complete";
    default: return "pre-analysis";
  }
}

function planSummary(plan: NonNullable<Extract<ReviewSessionEvent, { type: "phase-transitioned" }>['planSnapshot']>): string {
  const summary = plan.changeSetSummary;
  return `变更文件 ${summary.files.length} 个，新增 ${summary.totalInsertions} 行，删除 ${summary.totalDeletions} 行`;
}

export function reduceReviewProgress(previous: ReviewProgressState | undefined, event: ReviewSessionEvent): ReviewProgressState {
  const state = previous ?? createInitialReviewProgress();
  if (event.type !== "phase-transitioned") {
    return {
      ...state,
      phase: event.type === "session-finished" ? "complete" : state.phase,
      degradation: event.type === "unit-failed" ? event.reason : state.degradation
    };
  }

  const unit = event.planSnapshot?.units.find((item) => item.unitId === event.unitId);
  const nextTrace = { ...state.trace };
  if (event.planSnapshot) nextTrace.planSummary = planSummary(event.planSnapshot);
  if (event.unitResult) {
    nextTrace.evidenceSources = event.unitResult.evidenceSummary.items.map((item) => `${item.source}: ${item.summary}`);
    nextTrace.reflectionConclusion = event.unitResult.reflectionResult.candidates.map((candidate) => candidate.decisionReason).join('；') || null;
  }
  const degradation = event.phase === "evidence-incomplete" ? "证据不完整" : state.degradation;
  nextTrace.degradation = degradation;
  return {
    phase: phaseToUi(event.phase),
    currentUnit: event.unitId ?? state.currentUnit,
    checks: unit?.checks.map((check) => ({ id: check.id, description: check.description, status: "不可用" })) ?? state.checks,
    budget: unit?.budget ?? state.budget,
    degradation,
    trace: nextTrace
  };
}

// SessionSummary 是前端独有的 schema（后端无对应物）
export const sessionSummarySchema = z.object({
  sessionId: z.string(),
  repositoryPath: z.string(),
  baseRef: z.string(),
  targetRef: z.string(),
  status: z.enum(["running", "finished", "failed", "partial", "cancelled"]),
  createdAt: z.string().optional(),
  summary: z.object({
    changedFilesCount: z.number(),
    findingsCount: z.number(),
    highSeverityCount: z.number(),
    files: z.array(z.string())
  })
});

export type SessionSummary = z.infer<typeof sessionSummarySchema>;
