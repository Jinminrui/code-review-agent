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
