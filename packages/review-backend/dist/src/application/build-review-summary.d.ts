import type { ReviewFinding } from "../domain/review-finding.js";
export declare function buildReviewSummary(input: {
    findings: ReviewFinding[];
    changedFiles: string[];
}): {
    changedFilesCount: number;
    findingsCount: number;
    highSeverityCount: number;
    files: string[];
};
