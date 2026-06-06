type MonacoDiffViewerProps = {
    original: string;
    modified: string;
    finding: {
        startLine?: number;
        endLine?: number;
        status: "line-level" | "file-level";
    } | null;
};
export declare function MonacoDiffViewer({ original, modified, finding }: MonacoDiffViewerProps): import("react").JSX.Element;
export {};
