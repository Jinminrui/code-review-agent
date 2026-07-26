/**
 * 模块职责：承载本模块的稳定业务逻辑，并对外提供边界清晰的类型或函数。
 * 边界约束：输入数据应在边界处校验；不要在本模块内绕过既定的分层和 IPC 约束。
 * 维护提示：修改时优先保持现有契约和错误语义，并同步更新相关测试。
 */
import { z } from "zod";

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
