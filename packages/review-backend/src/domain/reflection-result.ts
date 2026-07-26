/**
 * 模块职责：承载本模块的稳定业务逻辑，并对外提供边界清晰的类型或函数。
 * 边界约束：输入数据应在边界处校验；不要在本模块内绕过既定的分层和 IPC 约束。
 * 维护提示：修改时优先保持现有契约和错误语义，并同步更新相关测试。
 */
import { z } from "zod";
import { reviewFindingSchema } from "./review-finding.js";
import { evidenceSourceSchema } from "./review-evidence.js";
import { REVIEW_SCHEMA_VERSION } from "./review-runtime.js";

export const reflectionCandidateSchema = z.object({
  finding: reviewFindingSchema,
  evidenceIds: z.array(z.string().min(1)),
  counterEvidence: z.string(),
  decision: z.enum(["accept", "reject", "needs-review"]),
  decisionReason: z.string().min(1)
});

export const reflectionBackfillRequestSchema = z.object({
  checkId: z.string().min(1),
  reason: z.string().min(1),
  allowedTool: evidenceSourceSchema,
  // 使用固定的只读工具参数集合，避免 JSON Schema 退化为 additionalProperties。
  arguments: z.object({
    path: z.string().optional(),
    keyword: z.string().optional(),
    pattern: z.string().optional(),
    regex: z.boolean().optional(),
    start_line: z.number().int().positive().optional(),
    end_line: z.number().int().positive().optional(),
    calls: z.array(z.object({
      allowedTool: evidenceSourceSchema.optional(),
      name: evidenceSourceSchema.optional(),
      tool: evidenceSourceSchema.optional(),
      arguments: z.object({
        path: z.string().optional(),
        keyword: z.string().optional(),
        pattern: z.string().optional(),
        regex: z.boolean().optional(),
        start_line: z.number().int().positive().optional(),
        end_line: z.number().int().positive().optional()
      })
    })).optional(),
    toolCalls: z.array(z.object({
      allowedTool: evidenceSourceSchema.optional(),
      name: evidenceSourceSchema.optional(),
      tool: evidenceSourceSchema.optional(),
      arguments: z.object({
        path: z.string().optional(),
        keyword: z.string().optional(),
        pattern: z.string().optional(),
        regex: z.boolean().optional(),
        start_line: z.number().int().positive().optional(),
        end_line: z.number().int().positive().optional()
      })
    })).optional()
  })
});

export const reflectionResultSchema = z.object({
  schemaVersion: z.literal(REVIEW_SCHEMA_VERSION),
  unitId: z.string().min(1).optional(),
  candidates: z.array(reflectionCandidateSchema),
  backfillRequest: reflectionBackfillRequestSchema.optional()
});

export type ReflectionCandidate = z.infer<typeof reflectionCandidateSchema>;
export type ReflectionBackfillRequest = z.infer<typeof reflectionBackfillRequestSchema>;
export type ReflectionResult = z.infer<typeof reflectionResultSchema>;
