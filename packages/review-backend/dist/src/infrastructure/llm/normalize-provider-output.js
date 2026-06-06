import { randomUUID } from "node:crypto";
import { z } from "zod";
import { reviewFindingSchema } from "../../domain/review-finding.js";
const providerOutputSchema = z.object({
    findings: z
        .array(z.object({
        severity: z.enum(["high", "medium", "low"]),
        category: z.string(),
        summary: z.string(),
        explanation: z.string(),
        file: z.string().optional(),
        startLine: z.number().int().positive().optional(),
        endLine: z.number().int().positive().optional(),
        evidence: z.string().optional(),
        suggestion: z.string().optional(),
        confidenceSignals: z.array(z.string()).default([])
    }))
        .default([])
});
export function normalizeProviderOutput(input) {
    let parsedJson;
    try {
        parsedJson = JSON.parse(input.content);
    }
    catch {
        return [];
    }
    const parsed = providerOutputSchema.safeParse(parsedJson);
    if (!parsed.success) {
        return [];
    }
    return parsed.data.findings.map((finding) => reviewFindingSchema.parse({
        id: randomUUID(),
        ...finding,
        file: finding.file ?? input.fallbackFile,
        status: finding.startLine ? "line-level" : "file-level"
    }));
}
