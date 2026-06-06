export declare function getReviewSession(input: {
    sessionId: string;
    sessionStore: {
        getSession(sessionId: string): Promise<unknown>;
    };
}): Promise<unknown>;
