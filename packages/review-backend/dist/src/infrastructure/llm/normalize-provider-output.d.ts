export declare function normalizeProviderOutput(input: {
    content: string;
    fallbackFile: string;
}): {
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
