type FindingLike = {
  startLine?: number;
  endLine?: number;
  status: "line-level" | "file-level";
};

export function toLineRange(finding: FindingLike) {
  // 文件级 finding 没有可信行号，统一定位到首行，避免伪造精确位置。
  if (finding.status === "file-level" || !finding.startLine) {
    return { startLine: 1, endLine: 1 };
  }

  return {
    startLine: finding.startLine,
    endLine: finding.endLine ?? finding.startLine
  };
}
