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
