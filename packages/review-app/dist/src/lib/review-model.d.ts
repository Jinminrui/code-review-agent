import { z } from "zod";
export declare const reviewFindingSchema: z.ZodObject<{
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
    confidenceSignals: z.ZodArray<z.ZodString, "many">;
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
    confidenceSignals: string[];
    startLine?: number | undefined;
    endLine?: number | undefined;
    evidence?: string | undefined;
    suggestion?: string | undefined;
}>;
export declare const reviewSessionDetailSchema: z.ZodObject<{
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
        changedFilesCount: number;
        findingsCount: number;
        highSeverityCount: number;
        files: string[];
    }, {
        changedFilesCount: number;
        findingsCount: number;
        highSeverityCount: number;
        files: string[];
    }>;
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
        confidenceSignals: z.ZodArray<z.ZodString, "many">;
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
        confidenceSignals: string[];
        startLine?: number | undefined;
        endLine?: number | undefined;
        evidence?: string | undefined;
        suggestion?: string | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    status: "idle" | "running" | "partial" | "finished" | "failed";
    summary: {
        changedFilesCount: number;
        findingsCount: number;
        highSeverityCount: number;
        files: string[];
    };
    sessionId: string;
    repositoryPath: string;
    baseRef: string;
    targetRef: string;
    diffByFile: Record<string, {
        original: string;
        modified: string;
    }>;
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
}, {
    status: "idle" | "running" | "partial" | "finished" | "failed";
    summary: {
        changedFilesCount: number;
        findingsCount: number;
        highSeverityCount: number;
        files: string[];
    };
    sessionId: string;
    repositoryPath: string;
    baseRef: string;
    targetRef: string;
    diffByFile: Record<string, {
        original: string;
        modified: string;
    }>;
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
}>;
export type ReviewFinding = z.infer<typeof reviewFindingSchema>;
export type ReviewSessionDetail = z.infer<typeof reviewSessionDetailSchema>;
