/**
 * 模块职责：承载本模块的稳定业务逻辑，并对外提供边界清晰的类型或函数。
 * 边界约束：输入数据应在边界处校验；不要在本模块内绕过既定的分层和 IPC 约束。
 * 维护提示：修改时优先保持现有契约和错误语义，并同步更新相关测试。
 */
import { DiffEditor } from "@monaco-editor/react";
import { useState } from "react";
import { findingStatusLabel, severityLabel } from "@/lib/review-copy";
import { useMonacoReveal } from "@/hooks/use-monaco-reveal";
import { Icon } from "@/components/ui/icon";
import { StatusBadge } from "@/components/ui/status-badge";
import { SectionLabel } from "@/components/ui/section-label";
import { Lock, FileText, MessageSquare, Lightbulb } from "lucide-react";
import { DiffToolbar, type DiffMode } from "./diff-toolbar";

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
  const [diffMode, setDiffMode] = useState<DiffMode>("side-by-side");

  useMonacoReveal(editor, monaco, finding);

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_auto_auto_1fr] gap-3 rounded-lg border border-border-default bg-bg-surface p-4">
      <header className="flex items-start justify-between gap-4 rounded-md border border-border-subtle bg-bg-elevated px-4 py-3">
        <div className="grid gap-1">
          <SectionLabel icon={Lock} command="上下文" />
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
        <SectionLabel icon={MessageSquare} command="问题详情" />
        {finding ? (
          <div className="mt-3 space-y-3 text-sm leading-6 text-text-primary">
            <p>{finding.explanation}</p>
            <div className="flex items-start gap-2 rounded-md border border-border-subtle bg-bg-surface px-3 py-2">
              <Icon icon={Lightbulb} size="sm" variant="warning" className="mt-0.5 flex-shrink-0" />
              <div className="space-y-2">
                <p><span className="text-xs text-text-tertiary">证据：</span>{finding.evidence ?? '暂无证据摘要'}</p>
                <p><span className="text-xs text-text-tertiary">建议：</span>{finding.suggestion ?? '暂无处理建议'}</p>
              </div>
            </div>
          </div>
        ) : (
          <p className="mt-2 text-sm text-text-tertiary">等待选择问题后显示详情。</p>
        )}
      </section>
      <div className="min-h-0 overflow-hidden rounded-md border border-border-subtle">
        <DiffToolbar
          file={finding?.file ?? "暂无文件上下文"}
          status={finding?.status ?? "file-level"}
          mode={diffMode}
          onModeChange={setDiffMode}
        />
        <div className="h-[calc(100%-45px)]">
          <DiffEditor
            height="100%"
            language="typescript"
            original={original}
            modified={modified}
            loading="正在加载差异视图..."
            options={{
              readOnly: true,
              minimap: { enabled: false },
              renderSideBySide: diffMode === "side-by-side",
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
    </div>
  );
}
