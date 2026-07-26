/**
 * 模块职责：承载本模块的稳定业务逻辑，并对外提供边界清晰的类型或函数。
 * 边界约束：输入数据应在边界处校验；不要在本模块内绕过既定的分层和 IPC 约束。
 * 维护提示：修改时优先保持现有契约和错误语义，并同步更新相关测试。
 */
import { toLineRange } from "./line-range";

type FindingLike = {
  startLine?: number;
  endLine?: number;
  status: "line-level" | "file-level";
};

type MonacoModule = {
  Range: new (startLine: number, startColumn: number, endLine: number, endColumn: number) => unknown;
};

export function toFindingDecorations(monaco: MonacoModule, finding: FindingLike) {
  const range = toLineRange(finding);

  return [
    {
      range: new monaco.Range(range.startLine, 1, range.endLine, 1),
      options: {
        isWholeLine: true,
        className: "review-finding-line",
        linesDecorationsClassName: "review-finding-gutter"
      }
    }
  ];
}
