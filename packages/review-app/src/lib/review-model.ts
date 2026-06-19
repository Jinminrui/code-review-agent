import { z } from "zod";

export const reviewFindingSchema = z.object({
  id: z.string(),
  severity: z.enum(["high", "medium", "low"]),
  category: z.string(),
  summary: z.string(),
  explanation: z.string(),
  file: z.string(),
  startLine: z.number().optional(),
  endLine: z.number().optional(),
  evidence: z.string().optional(),
  suggestion: z.string().optional(),
  confidenceSignals: z.array(z.string()),
  status: z.enum(["line-level", "file-level"])
});

// 流式事件类型定义
export type ReviewSessionEvent =
  | { type: "session-started"; sessionId: string }
  | { type: "unit-completed"; sessionId: string; unitId: string; findingsCount: number; findings: ReviewFinding[] }
  | { type: "unit-failed"; sessionId: string; unitId: string; reason: string }
  | { type: "session-finished"; sessionId: string; totalFindings: number; status: "finished" | "partial" }
  | { type: "session-cancelled"; sessionId: string; totalFindings: number };

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
  diffByFile: z.record(
    z.object({
      original: z.string(),
      modified: z.string()
    })
  ),
  findings: z.array(reviewFindingSchema)
});

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

export type ReviewFinding = z.infer<typeof reviewFindingSchema>;
export type ReviewSessionDetail = z.infer<typeof reviewSessionDetailSchema>;
export type SessionSummary = z.infer<typeof sessionSummarySchema>;
