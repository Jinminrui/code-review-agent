/**
 * 模块职责：承载本模块的稳定业务逻辑，并对外提供边界清晰的类型或函数。
 * 边界约束：输入数据应在边界处校验；不要在本模块内绕过既定的分层和 IPC 约束。
 * 维护提示：修改时优先保持现有契约和错误语义，并同步更新相关测试。
 */
import { z } from "zod";
import { REVIEW_SCHEMA_VERSION } from "./review-runtime.js";

// ReAct 阶段只能使用这组只读工具生成证据。
export const evidenceSourceSchema = z.enum([
  "file_read",
  "file_find",
  "code_search",
  "file_read_diff"
]);

export const evidenceItemSchema = z.object({
  id: z.string().min(1),
  checkId: z.string().min(1),
  source: evidenceSourceSchema,
  arguments: z.record(z.unknown()),
  content: z.string(),
  contentHash: z.string().min(1)
});

export const evidenceBundleSchema = z.object({
  schemaVersion: z.literal(REVIEW_SCHEMA_VERSION),
  unitId: z.string().min(1),
  items: z.array(evidenceItemSchema),
  completeness: z.enum(["complete", "incomplete"])
});

export type EvidenceSource = z.infer<typeof evidenceSourceSchema>;
export type EvidenceItem = z.infer<typeof evidenceItemSchema>;
export type EvidenceBundle = z.infer<typeof evidenceBundleSchema>;
