type FindingLike = {
    startLine?: number;
    endLine?: number;
    status: "line-level" | "file-level";
};
type MonacoModule = {
    Range: new (startLine: number, startColumn: number, endLine: number, endColumn: number) => unknown;
};
export declare function toFindingDecorations(monaco: MonacoModule, finding: FindingLike): {
    range: unknown;
    options: {
        isWholeLine: boolean;
        className: string;
        linesDecorationsClassName: string;
    };
}[];
export {};
