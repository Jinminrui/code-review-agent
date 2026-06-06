import { jsx as _jsx } from "react/jsx-runtime";
import { DiffEditor } from "@monaco-editor/react";
import { useState } from "react";
import { useMonacoReveal } from "@/hooks/use-monaco-reveal";
export function MonacoDiffViewer({ original, modified, finding }) {
    const [editor, setEditor] = useState(null);
    const [monaco, setMonaco] = useState(null);
    useMonacoReveal(editor, monaco, finding);
    return (_jsx("div", { className: "h-full", children: _jsx(DiffEditor, { height: "100%", language: "typescript", original: original, modified: modified, options: {
                readOnly: true,
                minimap: { enabled: false },
                renderSideBySide: false,
                glyphMargin: true,
                lineNumbersMinChars: 3
            }, beforeMount: (nextMonaco) => {
                nextMonaco.editor.defineTheme("review-workbench", {
                    base: "vs",
                    inherit: true,
                    rules: [],
                    colors: {
                        "editor.background": "#fffdfa",
                        "diffEditor.insertedTextBackground": "#e8f4ec",
                        "diffEditor.removedTextBackground": "#f8e7e1"
                    }
                });
            }, onMount: (nextEditor, nextMonaco) => {
                nextMonaco.editor.setTheme("review-workbench");
                setEditor(nextEditor);
                setMonaco(nextMonaco);
            } }) }));
}
