type FindingLike = {
    startLine?: number;
    endLine?: number;
    status: "line-level" | "file-level";
};
type EditorLike = {
    revealLineInCenter(lineNumber: number): void;
    createDecorationsCollection(items: unknown[]): {
        clear(): void;
    };
};
type MonacoLike = {
    Range: new (startLine: number, startColumn: number, endLine: number, endColumn: number) => unknown;
};
export declare function useMonacoReveal(editor: EditorLike | null, monaco: MonacoLike | null, finding: FindingLike | null): void;
export {};
