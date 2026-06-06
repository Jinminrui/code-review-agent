type FindingLike = {
    startLine?: number;
    endLine?: number;
    status: "line-level" | "file-level";
};
export declare function toLineRange(finding: FindingLike): {
    startLine: number;
    endLine: number;
};
export {};
