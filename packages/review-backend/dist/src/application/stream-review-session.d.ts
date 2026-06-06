import type { ReviewSessionEvent, ReviewSessionInput } from "../domain/review-session.js";
export declare function streamReviewSession(input: ReviewSessionInput): AsyncGenerator<ReviewSessionEvent, void, void>;
