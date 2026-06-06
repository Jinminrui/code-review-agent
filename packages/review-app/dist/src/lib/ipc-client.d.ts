import type { ReviewSessionDetail } from "./review-model";
export type CreateSessionInput = {
    repositoryPath: string;
    baseRef: string;
    targetRef: string;
    providerProfileId: string;
};
export type ReviewWorkbenchApi = {
    listRepositories(): Promise<string[]>;
    listBranches(repositoryPath: string): Promise<string[]>;
    createSession(input: CreateSessionInput): Promise<{
        sessionId: string;
    }>;
    getSession(sessionId: string): Promise<ReviewSessionDetail>;
    listSessions(): Promise<ReviewSessionDetail[]>;
    subscribeSession(sessionId: string, onEvent: (event: unknown) => void): () => void;
};
declare global {
    interface Window {
        reviewWorkbenchApi: ReviewWorkbenchApi;
    }
}
export declare const ipcClient: {
    listRepositories: () => Promise<string[]>;
    listBranches: (repositoryPath: string) => Promise<string[]>;
    createSession: (input: CreateSessionInput) => Promise<{
        sessionId: string;
    }>;
    getSession: (sessionId: string) => Promise<{
        status: "idle" | "running" | "partial" | "finished" | "failed";
        summary: {
            changedFilesCount: number;
            findingsCount: number;
            highSeverityCount: number;
            files: string[];
        };
        sessionId: string;
        repositoryPath: string;
        baseRef: string;
        targetRef: string;
        diffByFile: Record<string, {
            original: string;
            modified: string;
        }>;
        findings: {
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
    }>;
    listSessions: () => Promise<{
        status: "idle" | "running" | "partial" | "finished" | "failed";
        summary: {
            changedFilesCount: number;
            findingsCount: number;
            highSeverityCount: number;
            files: string[];
        };
        sessionId: string;
        repositoryPath: string;
        baseRef: string;
        targetRef: string;
        diffByFile: Record<string, {
            original: string;
            modified: string;
        }>;
        findings: {
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
    }[]>;
    subscribeSession: (sessionId: string, onEvent: (event: unknown) => void) => () => void;
};
