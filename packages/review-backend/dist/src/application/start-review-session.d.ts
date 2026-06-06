import type { ReviewSessionInput } from "../domain/review-session.js";
export declare function startReviewSession(input: ReviewSessionInput): {
    sessionId: string;
    input: {
        repositoryPath: string;
        baseRef: string;
        targetRef: string;
        providerProfileId: string;
        contextBudgetTokens: number;
    };
};
