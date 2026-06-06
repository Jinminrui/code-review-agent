import type { LlmProvider } from "../domain/provider.js";
import type { ReviewSessionEvent, ReviewSessionInput } from "../domain/review-session.js";
import type { GitClient } from "../infrastructure/git/git-client.js";
type SessionStore = {
    createSession(input: {
        repositoryPath: string;
        baseRef: string;
        targetRef: string;
    }): Promise<{
        sessionId: string;
    }>;
    appendEvent(sessionId: string, event: ReviewSessionEvent): Promise<void>;
    completeSession(sessionId: string, summary: unknown): Promise<void>;
};
export declare function streamReviewSession(input: {
    input: ReviewSessionInput;
    dependencies: {
        provider: Pick<LlmProvider, "id" | "review">;
        gitClient: Pick<GitClient, "readDiff" | "readFileAtRef">;
        sessionStore: SessionStore;
    };
}): AsyncGenerator<ReviewSessionEvent, void, void>;
export {};
