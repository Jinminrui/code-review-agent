import { z } from "zod";
import { providerCapabilitiesSchema } from "./provider.js";

export const REVIEW_SCHEMA_VERSION = 1;
export const REVIEW_RUNTIME_VERSION = "1.0.0";

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
  "global-reflection-completed",
  "session-finished",
  "session-cancelled"
]);

export const phaseBudgetSchema = z.object({
  modelCalls: z.number().int().nonnegative(),
  toolCalls: z.number().int().nonnegative(),
  maxInputTokens: z.number().int().nonnegative(),
  maxOutputTokens: z.number().int().nonnegative(),
  maxReadBytes: z.number().int().nonnegative(),
  maxDurationMs: z.number().int().nonnegative()
});

export const reviewRuntimeMetadataSchema = z.object({
  runtimeVersion: z.string().min(1),
  planVersion: z.number().int().positive(),
  schemaVersion: z.literal(REVIEW_SCHEMA_VERSION),
  providerCapabilities: providerCapabilitiesSchema
});

export type ReviewRuntimePhase = z.infer<typeof reviewRuntimePhaseSchema>;
export type PhaseBudget = z.infer<typeof phaseBudgetSchema>;
export type ReviewRuntimeMetadata = z.infer<typeof reviewRuntimeMetadataSchema>;

const legalNextPhases: Record<ReviewRuntimePhase, readonly ReviewRuntimePhase[]> = {
  "session-created": ["pre-analysis-completed", "session-cancelled"],
  "pre-analysis-completed": ["global-plan-completed", "session-cancelled"],
  "global-plan-completed": [
    "unit-plan-started",
    "global-reflection-completed",
    "session-cancelled"
  ],
  "unit-plan-started": [
    "react-evidence-collecting",
    "unit-failed",
    "session-cancelled"
  ],
  "react-evidence-collecting": [
    "reflection-validating",
    "evidence-incomplete",
    "unit-failed",
    "session-cancelled"
  ],
  "reflection-validating": [
    "evidence-backfill",
    "evidence-incomplete",
    "unit-completed",
    "unit-failed",
    "session-cancelled"
  ],
  "evidence-backfill": ["reflection-validating", "evidence-incomplete", "session-cancelled"],
  "evidence-incomplete": [
    "unit-plan-started",
    "global-reflection-completed",
    "session-cancelled"
  ],
  "unit-completed": ["unit-plan-started", "global-reflection-completed", "session-cancelled"],
  "unit-failed": ["unit-plan-started", "global-reflection-completed", "session-cancelled"],
  "global-reflection-completed": ["session-finished", "session-cancelled"],
  "session-finished": [],
  "session-cancelled": []
};

export function isValidReviewPhaseTransition(
  previousPhase: ReviewRuntimePhase,
  phase: ReviewRuntimePhase
): boolean {
  return legalNextPhases[previousPhase].includes(phase);
}

export const reviewPhaseTransitionSchema = z
  .object({
    previousPhase: reviewRuntimePhaseSchema,
    phase: reviewRuntimePhaseSchema
  })
  .superRefine((transition, context) => {
    if (!isValidReviewPhaseTransition(transition.previousPhase, transition.phase)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["phase"],
        message: `非法审查阶段转移: ${transition.previousPhase} -> ${transition.phase}`
      });
    }
  });

export type ReviewPhaseTransition = z.infer<typeof reviewPhaseTransitionSchema>;
