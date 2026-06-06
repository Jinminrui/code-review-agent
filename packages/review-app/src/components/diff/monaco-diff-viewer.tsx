import { DiffEditor } from "@monaco-editor/react";
import { useState } from "react";
import { useMonacoReveal } from "@/hooks/use-monaco-reveal";

type MonacoDiffViewerProps = {
  original: string;
  modified: string;
  finding: { startLine?: number; endLine?: number; status: "line-level" | "file-level" } | null;
};

type EditorLike = {
  revealLineInCenter(lineNumber: number): void;
  createDecorationsCollection(items: unknown[]): { clear(): void };
};

type MonacoLike = {
  editor: {
    defineTheme(themeName: string, data: unknown): void;
    setTheme(themeName: string): void;
  };
  Range: new (startLine: number, startColumn: number, endLine: number, endColumn: number) => unknown;
};

export function MonacoDiffViewer({ original, modified, finding }: MonacoDiffViewerProps) {
  const [editor, setEditor] = useState<EditorLike | null>(null);
  const [monaco, setMonaco] = useState<MonacoLike | null>(null);

  useMonacoReveal(editor, monaco, finding);

  return (
    <div className="h-full">
      <DiffEditor
        height="100%"
        language="typescript"
        original={original}
        modified={modified}
        options={{
          readOnly: true,
          minimap: { enabled: false },
          renderSideBySide: false,
          glyphMargin: true,
          lineNumbersMinChars: 3
        }}
        beforeMount={(nextMonaco) => {
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
        }}
        onMount={(nextEditor, nextMonaco) => {
          nextMonaco.editor.setTheme("review-workbench");
          setEditor(nextEditor as EditorLike);
          setMonaco(nextMonaco as MonacoLike);
        }}
      />
    </div>
  );
}
