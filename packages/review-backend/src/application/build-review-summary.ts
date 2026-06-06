import type { ReviewFinding } from "../domain/review-finding.js";

export function buildReviewSummary(input: {
  findings: ReviewFinding[];
  changedFiles: string[];
}) {
  const files = Array.from(new Set(input.changedFiles));

  return {
    changedFilesCount: files.length,
    findingsCount: input.findings.length,
    highSeverityCount: input.findings.filter((item) => item.severity === "high").length,
    files
  };
}
