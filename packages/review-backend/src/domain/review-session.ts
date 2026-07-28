/**
 * 模块职责：承载本模块的稳定业务逻辑，并对外提供边界清晰的类型或函数。
 * 边界约束：输入数据应在边界处校验；不要在本模块内绕过既定的分层和 IPC 约束。
 * 维护提示：修改时优先保持现有契约和错误语义，并同步更新相关测试。
 */
import { z } from "zod";
import { reviewFindingSchema } from "./review-finding.js";
import { reviewPlanSchema } from "./review-plan.js";
import { evidenceBundleSchema } from "./review-evidence.js";
import { reflectionResultSchema } from "./reflection-result.js";
import {
  REVIEW_SCHEMA_VERSION,
  reviewRuntimePhaseSchema,
  isValidReviewPhaseTransition,
  stageDiagnosticSchema
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
    phase: reviewRuntimePhaseSchema,
    planVersion: z.number().int().positive().optional(),
    planFingerprint: z.string().min(1).optional(),
    planSnapshot: reviewPlanSchema.optional(),
    unitResult: z.object({
      unitId: z.string().min(1),
      file: z.string().min(1),
      findings: z.array(reviewFindingSchema),
      reflectionResult: reflectionResultSchema,
      evidenceSummary: z.object({
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
      }),
      diff: z.object({ original: z.string(), modified: z.string() }).optional()
    }).optional()
  })
  .superRefine((event, context) => {
    if (!isValidReviewPhaseTransition(event.previousPhase, event.phase)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["phase"],
        message: `非法审查阶段转移: ${event.previousPhase} -> ${event.phase}`
      });
    }
    if ([
      "unit-plan-started",
      "react-evidence-collecting",
      "reflection-validating",
      "evidence-backfill",
      "evidence-incomplete",
      "unit-completed",
      "unit-failed"
    ].includes(event.phase) && !event.unitId) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["unitId"], message: `${event.phase} 阶段必须携带 unitId` });
    }
  });

// 旧事件继续按原 schema 读取；只有新运行时事件强制携带版本和阶段字段。
export const reviewSessionEventSchema = z.union([
  legacyReviewSessionEventSchema,
  reviewRuntimePhaseEventSchema
]);

// 这组 schema 同时服务 renderer、FileSessionStore 和 orchestrator；新增事件时
// 必须同步考虑旧 JSONL 迁移、phase 顺序以及取消/恢复语义。

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
  ),
  diagnostics: z.object({
    stageDiagnostics: z.array(stageDiagnosticSchema).default([]),
    globalFallback: z.object({
      used: z.boolean(),
      reason: z.string().min(1).optional()
    }).optional()
  }).optional()
});

export type ReviewSessionInput = z.infer<typeof reviewSessionInputSchema>;
export type ReviewSessionEvent = z.infer<typeof reviewSessionEventSchema>;
export type ReviewSessionDetail = z.infer<typeof reviewSessionDetailSchema>;
