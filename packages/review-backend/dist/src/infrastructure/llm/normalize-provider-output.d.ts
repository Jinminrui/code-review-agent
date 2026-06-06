export declare function normalizeProviderOutput(input: {
    content: string;
    fallbackFile: string;
}): {
    status: "line-level" | "file-level";
    id: string;
    severity: "high" | "medium" | "low";
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
