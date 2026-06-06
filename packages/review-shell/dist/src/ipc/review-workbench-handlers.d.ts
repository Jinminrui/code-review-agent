import type { CreateReviewSessionRequest } from "@app/review-backend";
type ReviewWorkbenchBackend = {
    listRepositories(): Promise<string[]>;
    listBranches(repositoryPath: string): Promise<string[]>;
    createSession(request: CreateReviewSessionRequest): Promise<{
        sessionId: string;
    }>;
    getSession(sessionId: string): Promise<unknown>;
    listSessions(): Promise<unknown[]>;
};
export declare function createReviewWorkbenchHandlers(input: {
    backend: ReviewWorkbenchBackend;
}): {
    listRepositories: () => Promise<string[]>;
    listBranches: (repositoryPath: string) => Promise<string[]>;
    createSession: (request: unknown) => Promise<{
        sessionId: string;
    }>;
    getSession: (sessionId: string) => Promise<unknown>;
    listSessions: () => Promise<unknown[]>;
};
export {};
