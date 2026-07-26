/**
 * 模块职责：承载本模块的稳定业务逻辑，并对外提供边界清晰的类型或函数。
 * 边界约束：输入数据应在边界处校验；不要在本模块内绕过既定的分层和 IPC 约束。
 * 维护提示：修改时优先保持现有契约和错误语义，并同步更新相关测试。
 */
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
