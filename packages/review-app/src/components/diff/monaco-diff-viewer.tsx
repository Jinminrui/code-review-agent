import { DiffEditor } from "@monaco-editor/react";
import { useState } from "react";
import { findingStatusLabel, severityLabel } from "@/lib/review-copy";
import { useMonacoReveal } from "@/hooks/use-monaco-reveal";

type MonacoDiffViewerProps = {
  original: string;
  modified: string;
  finding: {
    file: string;
    summary: string;
    severity: "high" | "medium" | "low";
    explanation: string;
    evidence?: string;
    suggestion?: string;
    startLine?: number;
    endLine?: number;
    status: "line-level" | "file-level";
  } | null;
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
  const evidence = finding?.evidence ?? finding?.suggestion ?? finding?.explanation ?? "等待选择问题后显示证据摘要。";

  useMonacoReveal(editor, monaco, finding);

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_auto_1fr] gap-3 rounded-[28px] border border-[rgb(var(--border))] bg-[rgb(var(--panel))] p-4">
      <header className="flex items-start justify-between gap-4 rounded-[22px] border border-[rgb(var(--border-subtle))] bg-[rgb(var(--panel-elevated))] px-4 py-3">
        <div className="grid gap-1">
          <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[rgb(var(--muted))]">上下文</div>
          <div className="text-base font-semibold text-[rgb(var(--ink))]">{finding?.summary ?? "等待选择问题"}</div>
          <div className="text-sm text-[rgb(var(--muted-strong))]">{finding?.file ?? "暂无文件上下文"}</div>
        </div>
        <div className="grid justify-items-end gap-2 text-right">
          <span className="rounded-full bg-[rgb(var(--accent-soft))] px-2.5 py-1 text-[11px] font-semibold tracking-[0.08em] text-[rgb(var(--accent-ink))]">
            {finding ? severityLabel[finding.severity] : "提示"}
          </span>
          <span className="text-xs tracking-[0.08em] text-[rgb(var(--muted))]">
            {finding ? findingStatusLabel[finding.status] : "等待定位"}
          </span>
        </div>
      </header>
      <section className="rounded-[20px] bg-[rgb(var(--panel-muted))] px-4 py-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[rgb(var(--muted))]">证据摘要</div>
        <p className="mt-2 text-sm leading-6 text-[rgb(var(--ink))]">{evidence}</p>
      </section>
      <div className="min-h-0 overflow-hidden rounded-[24px] border border-[rgb(var(--border-subtle))]">
        <DiffEditor
          height="100%"
          language="typescript"
          original={original}
          modified={modified}
          loading="正在加载差异视图..."
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
    </div>
  );
}
