import { toLineRange } from "./line-range";
export function toFindingDecorations(monaco, finding) {
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
