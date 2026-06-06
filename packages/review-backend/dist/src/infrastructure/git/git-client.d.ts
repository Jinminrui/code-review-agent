export declare class GitClient {
    private readonly repositoryPath;
    constructor(repositoryPath: string);
    getRepositoryPath(): string;
    listBranches(): Promise<string[]>;
    readDiff(baseRef: string, targetRef: string): Promise<import("./parse-unified-diff.js").ParsedDiffFile[]>;
    readFileAtRef(ref: string, filePath: string): Promise<string>;
}
