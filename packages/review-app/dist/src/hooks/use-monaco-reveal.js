import { useEffect } from "react";
import { toFindingDecorations } from "@/components/diff/finding-decorations";
import { toLineRange } from "@/components/diff/line-range";
export function useMonacoReveal(editor, monaco, finding) {
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
