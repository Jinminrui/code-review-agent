import { z } from "zod";
export declare const createReviewSessionRequestSchema: z.ZodObject<{
    repositoryPath: z.ZodString;
    baseRef: z.ZodString;
    targetRef: z.ZodString;
    providerProfileId: z.ZodString;
    contextBudgetTokens: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    repositoryPath: string;
    baseRef: string;
    targetRef: string;
    providerProfileId: string;
    contextBudgetTokens: number;
}, {
    repositoryPath: string;
    baseRef: string;
    targetRef: string;
    providerProfileId: string;
    contextBudgetTokens?: number | undefined;
}>;
export declare const reviewSessionEventPayloadSchema: z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
    type: z.ZodLiteral<"session-started">;
    sessionId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: "session-started";
    sessionId: string;
}, {
    type: "session-started";
    sessionId: string;
}>, z.ZodObject<{
    type: z.ZodLiteral<"unit-completed">;
    sessionId: z.ZodString;
    unitId: z.ZodString;
    findingsCount: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    type: "unit-completed";
    sessionId: string;
    unitId: string;
    findingsCount: number;
}, {
    type: "unit-completed";
    sessionId: string;
    unitId: string;
    findingsCount: number;
}>, z.ZodObject<{
    type: z.ZodLiteral<"unit-failed">;
    sessionId: z.ZodString;
    unitId: z.ZodString;
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: "unit-failed";
    sessionId: string;
    unitId: string;
    reason: string;
}, {
    type: "unit-failed";
    sessionId: string;
    unitId: string;
    reason: string;
}>, z.ZodObject<{
    type: z.ZodLiteral<"session-finished">;
    sessionId: z.ZodString;
    totalFindings: z.ZodNumber;
    status: z.ZodEnum<["finished", "partial"]>;
}, "strip", z.ZodTypeAny, {
    status: "finished" | "partial";
    type: "session-finished";
    sessionId: string;
    totalFindings: number;
}, {
    status: "finished" | "partial";
    type: "session-finished";
    sessionId: string;
    totalFindings: number;
}>]>;
export declare const reviewSessionDetailPayloadSchema: z.ZodObject<{
    sessionId: z.ZodString;
    status: z.ZodEnum<["idle", "running", "partial", "finished", "failed"]>;
    repositoryPath: z.ZodString;
    baseRef: z.ZodString;
    targetRef: z.ZodString;
    summary: z.ZodObject<{
        changedFilesCount: z.ZodNumber;
        findingsCount: z.ZodNumber;
        highSeverityCount: z.ZodNumber;
        files: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        findingsCount: number;
        changedFilesCount: number;
        highSeverityCount: number;
        files: string[];
    }, {
        findingsCount: number;
        changedFilesCount: number;
        highSeverityCount: number;
        files: string[];
    }>;
    findings: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        severity: z.ZodEnum<["high", "medium", "low"]>;
        category: z.ZodString;
        summary: z.ZodString;
        explanation: z.ZodString;
        file: z.ZodString;
        startLine: z.ZodOptional<z.ZodNumber>;
        endLine: z.ZodOptional<z.ZodNumber>;
        evidence: z.ZodOptional<z.ZodString>;
        suggestion: z.ZodOptional<z.ZodString>;
        confidenceSignals: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        status: z.ZodEnum<["line-level", "file-level"]>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        severity: "high" | "medium" | "low";
        status: "line-level" | "file-level";
        category: string;
        summary: string;
        explanation: string;
        file: string;
        confidenceSignals: string[];
        startLine?: number | undefined;
        endLine?: number | undefined;
        evidence?: string | undefined;
        suggestion?: string | undefined;
    }, {
        id: string;
        severity: "high" | "medium" | "low";
        status: "line-level" | "file-level";
        category: string;
        summary: string;
        explanation: string;
        file: string;
        startLine?: number | undefined;
        endLine?: number | undefined;
        evidence?: string | undefined;
        suggestion?: string | undefined;
        confidenceSignals?: string[] | undefined;
    }>, "many">;
    diffByFile: z.ZodRecord<z.ZodString, z.ZodObject<{
        original: z.ZodString;
        modified: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        original: string;
        modified: string;
    }, {
        original: string;
        modified: string;
    }>>;
}, "strip", z.ZodTypeAny, {
    status: "finished" | "partial" | "idle" | "running" | "failed";
    summary: {
        findingsCount: number;
        changedFilesCount: number;
        highSeverityCount: number;
        files: string[];
    };
    repositoryPath: string;
    baseRef: string;
    targetRef: string;
    sessionId: string;
    findings: {
        id: string;
        severity: "high" | "medium" | "low";
        status: "line-level" | "file-level";
        category: string;
        summary: string;
        explanation: string;
        file: string;
        confidenceSignals: string[];
        startLine?: number | undefined;
        endLine?: number | undefined;
        evidence?: string | undefined;
        suggestion?: string | undefined;
    }[];
    diffByFile: Record<string, {
        original: string;
        modified: string;
    }>;
}, {
    status: "finished" | "partial" | "idle" | "running" | "failed";
    summary: {
        findingsCount: number;
        changedFilesCount: number;
        highSeverityCount: number;
        files: string[];
    };
    repositoryPath: string;
    baseRef: string;
    targetRef: string;
    sessionId: string;
    findings: {
        id: string;
        severity: "high" | "medium" | "low";
        status: "line-level" | "file-level";
        category: string;
        summary: string;
        explanation: string;
        file: string;
        startLine?: number | undefined;
        endLine?: number | undefined;
        evidence?: string | undefined;
        suggestion?: string | undefined;
        confidenceSignals?: string[] | undefined;
    }[];
    diffByFile: Record<string, {
        original: string;
        modified: string;
    }>;
}>;
export type CreateReviewSessionRequest = z.infer<typeof createReviewSessionRequestSchema>;
export type ReviewSessionEventPayload = z.infer<typeof reviewSessionEventPayloadSchema>;
export type ReviewSessionDetailPayload = z.infer<typeof reviewSessionDetailPayloadSchema>;
