export declare class FileSessionStore {
    private readonly rootDir;
    constructor(rootDir: string);
    createSession(input: {
        repositoryPath: string;
        baseRef: string;
        targetRef: string;
    }): Promise<{
        sessionId: `${string}-${string}-${string}-${string}-${string}`;
        sessionDir: string;
    }>;
}
