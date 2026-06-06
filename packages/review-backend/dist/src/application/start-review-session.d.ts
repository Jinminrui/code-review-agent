import type { ReviewSessionInput } from "../domain/review-session.js";
import { streamReviewSession } from "./stream-review-session.js";
export declare function startReviewSession(input: {
    input: ReviewSessionInput;
    dependencies: Parameters<typeof streamReviewSession>[0]["dependencies"];
}): Promise<{
    sessionId: string;
    events: ({
        type: "session-started";
        sessionId: string;
    } | {
        type: "unit-completed";
        sessionId: string;
        unitId: string;
        findingsCount: number;
    } | {
        type: "unit-failed";
        sessionId: string;
        unitId: string;
        reason: string;
    } | {
        status: "finished" | "partial";
        type: "session-finished";
        sessionId: string;
        totalFindings: number;
    })[];
}>;
