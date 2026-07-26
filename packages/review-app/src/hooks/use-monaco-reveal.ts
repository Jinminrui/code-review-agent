/**
 * 模块职责：承载本模块的稳定业务逻辑，并对外提供边界清晰的类型或函数。
 * 边界约束：输入数据应在边界处校验；不要在本模块内绕过既定的分层和 IPC 约束。
 * 维护提示：修改时优先保持现有契约和错误语义，并同步更新相关测试。
 */
import { useEffect } from "react";
import { toFindingDecorations } from "@/components/diff/finding-decorations";
import { toLineRange } from "@/components/diff/line-range";

type FindingLike = {
  startLine?: number;
  endLine?: number;
  status: "line-level" | "file-level";
};

type EditorLike = {
  revealLineInCenter(lineNumber: number): void;
  createDecorationsCollection(items: unknown[]): { clear(): void };
};

type MonacoLike = {
  Range: new (startLine: number, startColumn: number, endLine: number, endColumn: number) => unknown;
};

export function useMonacoReveal(
  editor: EditorLike | null,
  monaco: MonacoLike | null,
  finding: FindingLike | null
) {
  useEffect(() => {
    if (!editor || !monaco || !finding) {
      return;
    }

    const range = toLineRange(finding);
    // 同时滚动和加高亮；清理函数确保切换 finding 时不会残留旧装饰。
    editor.revealLineInCenter(range.startLine);

    const decorations = editor.createDecorationsCollection(toFindingDecorations(monaco, finding));

    return () => {
      decorations.clear();
    };
  }, [editor, monaco, finding]);
}
