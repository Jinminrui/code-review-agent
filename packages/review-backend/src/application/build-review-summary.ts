import type { ReviewFinding } from "../domain/review-finding.js";

export function buildReviewSummary(input: {
  findings: ReviewFinding[];
  changedFiles: string[];
}) {
  return {
    changedFilesCount: input.changedFiles.length,
    findingsCount: input.findings.length,
    highSeverityCount: input.findings.filter((item) => item.severity === "high").length,
    files: input.changedFiles
  };
}
