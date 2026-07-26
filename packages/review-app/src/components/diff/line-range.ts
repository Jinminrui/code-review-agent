/**
 * 模块职责：承载本模块的稳定业务逻辑，并对外提供边界清晰的类型或函数。
 * 边界约束：输入数据应在边界处校验；不要在本模块内绕过既定的分层和 IPC 约束。
 * 维护提示：修改时优先保持现有契约和错误语义，并同步更新相关测试。
 */
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
