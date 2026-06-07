import { DiffEditor } from "@monaco-editor/react";
import { useState } from "react";
import { findingStatusLabel, severityLabel } from "@/lib/review-copy";
import { useMonacoReveal } from "@/hooks/use-monaco-reveal";
import { Icon } from "@/components/ui/icon";
import { StatusBadge } from "@/components/ui/status-badge";
import { SectionLabel } from "@/components/ui/section-label";
import { Lock, FileText, MessageSquare, Lightbulb } from "lucide-react";

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
    <div className="grid h-full min-h-0 grid-rows-[auto_auto_1fr] gap-3 rounded-lg border border-border-default bg-bg-surface p-4">
      <header className="flex items-start justify-between gap-4 rounded-md border border-border-subtle bg-bg-elevated px-4 py-3">
        <div className="grid gap-1">
          <SectionLabel icon={Lock} command="context" />
          <div className="text-base font-semibold text-text-primary">{finding?.summary ?? "等待选择问题"}</div>
          <div className="flex items-center gap-1.5">
            <Icon icon={FileText} size="xs" variant="muted" />
            <span className="text-sm font-mono text-text-secondary">{finding?.file ?? "暂无文件上下文"}</span>
          </div>
        </div>
        <div className="grid justify-items-end gap-2 text-right">
          <StatusBadge
            severity={finding?.severity}
            label={finding ? severityLabel[finding.severity] : "提示"}
          />
          <span className="text-xs font-mono tracking-wider text-text-tertiary">
            {finding ? findingStatusLabel[finding.status] : "等待定位"}
          </span>
        </div>
      </header>
      <section className="rounded-md bg-bg-base border border-border-subtle px-4 py-3">
        <SectionLabel icon={MessageSquare} command="evidence" />
        <div className="flex items-start gap-2 mt-2">
          <Icon icon={Lightbulb} size="sm" variant="warning" className="mt-0.5 flex-shrink-0" />
          <p className="text-sm leading-6 text-text-primary font-mono">{evidence}</p>
        </div>
      </section>
      <div className="min-h-0 overflow-hidden rounded-md border border-border-subtle">
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
              base: "vs-dark",
              inherit: true,
              rules: [
                { token: "comment", foreground: "6e7681" },
                { token: "keyword", foreground: "ff7b72" },
                { token: "string", foreground: "a5d6ff" },
                { token: "number", foreground: "79c0ff" },
                { token: "type", foreground: "ffa657" },
                { token: "function", foreground: "d2a8ff" },
                { token: "variable", foreground: "e6edf3" },
              ],
              colors: {
                "editor.background": "#0d1117",
                "editor.foreground": "#e6edf3",
                "editor.lineHighlightBackground": "#161b22",
                "editorLineNumber.foreground": "#484f58",
                "editorLineNumber.activeForeground": "#8b949e",
                "diffEditor.insertedTextBackground": "rgba(46,160,67,0.25)",
                "diffEditor.removedTextBackground": "rgba(210,153,34,0.2)",
                "diffEditor.insertedLineBackground": "rgba(46,160,67,0.12)",
                "diffEditor.removedLineBackground": "rgba(210,153,34,0.08)",
                "diffEditor.insertedTextBorder": "rgba(46,160,67,0.4)",
                "diffEditor.removedTextBorder": "rgba(210,153,34,0.3)"
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
