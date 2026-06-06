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
    appendEvent(sessionId: string, event: unknown): Promise<void>;
    completeSession(sessionId: string, summary: unknown): Promise<void>;
    getSession(sessionId: string): Promise<any>;
    listSessions(): Promise<any[]>;
}
