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
    editor.revealLineInCenter(range.startLine);

    const decorations = editor.createDecorationsCollection(toFindingDecorations(monaco, finding));

    return () => {
      decorations.clear();
    };
  }, [editor, monaco, finding]);
}
