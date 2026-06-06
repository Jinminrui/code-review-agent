export function toLineRange(finding) {
    if (finding.status === "file-level" || !finding.startLine) {
        return { startLine: 1, endLine: 1 };
    }
    return {
        startLine: finding.startLine,
        endLine: finding.endLine ?? finding.startLine
    };
}
