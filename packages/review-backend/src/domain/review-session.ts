import { z } from "zod";
import { reviewFindingSchema } from "./review-finding.js";
import {
  REVIEW_SCHEMA_VERSION,
  reviewRuntimePhaseSchema,
  isValidReviewPhaseTransition
} from "./review-runtime.js";

// 领域 schema 同时承担运行时校验和 TypeScript 类型推导，避免跨进程数据漂移。
export const reviewSessionInputSchema = z.object({
  repositoryPath: z.string().min(1),
  baseRef: z.string().min(1),
  targetRef: z.string().min(1),
  contextBudgetTokens: z.number().int().positive().default(12000)
});

const legacyReviewSessionEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("session-started"),
    sessionId: z.string()
  }),
  z.object({
    type: z.literal("unit-completed"),
    sessionId: z.string(),
    unitId: z.string(),
    findingsCount: z.number().int().nonnegative(),
    findings: z.array(reviewFindingSchema),
    diffByFile: z.record(
      z.object({
        original: z.string(),
        modified: z.string()
      })
    )
  }),
  z.object({
    type: z.literal("unit-failed"),
    sessionId: z.string(),
    unitId: z.string(),
    reason: z.string()
  }),
  z.object({
    type: z.literal("session-finished"),
    sessionId: z.string(),
    totalFindings: z.number().int().nonnegative(),
    status: z.enum(["finished", "partial"])
  }),
  z.object({
    type: z.literal("session-cancelled"),
    sessionId: z.string(),
    totalFindings: z.number().int().nonnegative()
  })
]);

export const reviewRuntimePhaseEventSchema = z
  .object({
    type: z.literal("phase-transitioned"),
    sessionId: z.string().min(1),
    unitId: z.string().min(1).optional(),
    schemaVersion: z.literal(REVIEW_SCHEMA_VERSION),
    runtimeVersion: z.string().min(1),
    previousPhase: reviewRuntimePhaseSchema,
    phase: reviewRuntimePhaseSchema
  })
  .superRefine((event, context) => {
    if (!isValidReviewPhaseTransition(event.previousPhase, event.phase)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["phase"],
        message: `非法审查阶段转移: ${event.previousPhase} -> ${event.phase}`
      });
    }
  });

// 旧事件继续按原 schema 读取；只有新运行时事件强制携带版本和阶段字段。
export const reviewSessionEventSchema = z.union([
  legacyReviewSessionEventSchema,
  reviewRuntimePhaseEventSchema
]);

export const reviewSessionDetailSchema = z.object({
  sessionId: z.string(),
  status: z.enum(["idle", "running", "partial", "finished", "failed", "cancelled"]),
  createdAt: z.string().optional(),
  repositoryPath: z.string(),
  baseRef: z.string(),
  targetRef: z.string(),
  summary: z.object({
    changedFilesCount: z.number(),
    findingsCount: z.number(),
    highSeverityCount: z.number(),
    files: z.array(z.string())
  }),
  findings: z.array(reviewFindingSchema),
  diffByFile: z.record(
    z.object({
      original: z.string(),
      modified: z.string()
    })
  )
});

export type ReviewSessionInput = z.infer<typeof reviewSessionInputSchema>;
export type ReviewSessionEvent = z.infer<typeof reviewSessionEventSchema>;
export type ReviewSessionDetail = z.infer<typeof reviewSessionDetailSchema>;
