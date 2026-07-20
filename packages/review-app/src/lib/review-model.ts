import { z } from "zod";
import {
  reviewFindingSchema,
  reviewSessionDetailSchema,
  reviewSessionEventSchema
} from "@app/review-backend";
import type {
  ReviewFinding,
  ReviewSessionDetail,
  ReviewSessionEvent
} from "@app/review-backend";

// Re-export 后端类型，保持前端导入路径不变
export type { ReviewFinding, ReviewSessionDetail, ReviewSessionEvent };
export { reviewFindingSchema, reviewSessionDetailSchema, reviewSessionEventSchema };

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
