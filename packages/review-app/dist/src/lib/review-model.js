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
export const reviewSessionDetailSchema = z.object({
    sessionId: z.string(),
    status: z.enum(["idle", "running", "partial", "finished", "failed"]),
    repositoryPath: z.string(),
    baseRef: z.string(),
    targetRef: z.string(),
    summary: z.object({
        changedFilesCount: z.number(),
        findingsCount: z.number(),
        highSeverityCount: z.number(),
        files: z.array(z.string())
    }),
    diffByFile: z.record(z.object({
        original: z.string(),
        modified: z.string()
    })),
    findings: z.array(reviewFindingSchema)
});
