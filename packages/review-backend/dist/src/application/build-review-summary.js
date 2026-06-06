export function buildReviewSummary(input) {
    return {
        changedFilesCount: input.changedFiles.length,
        findingsCount: input.findings.length,
        highSeverityCount: input.findings.filter((item) => item.severity === "high").length,
        files: input.changedFiles
    };
}
