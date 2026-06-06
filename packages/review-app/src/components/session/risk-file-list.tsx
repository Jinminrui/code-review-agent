type RiskFileListProps = {
  files: string[];
};

export function RiskFileList({ files }: RiskFileListProps) {
  return (
    <section className="grid gap-3 rounded-[24px] border border-[rgb(var(--border))] bg-[rgb(var(--panel-elevated))] p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[rgb(var(--muted))]">High-Risk Files</div>
        <span className="text-[11px] text-[rgb(var(--muted))]">{files.length} 个文件</span>
      </div>
      <div className="grid gap-2">
        {files.map((file) => (
          <div
            key={file}
            className="grid gap-1 rounded-[20px] border border-[rgb(var(--border-subtle))] bg-[rgb(var(--panel-muted))] px-3 py-3 text-sm text-[rgb(var(--ink))] transition hover:border-[rgb(var(--border-strong))] hover:bg-[rgb(var(--panel-elevated))]"
          >
            <div className="truncate font-medium">{file}</div>
            <div className="text-xs text-[rgb(var(--muted))]">优先核查相关 finding 与上下文定位</div>
          </div>
        ))}
      </div>
    </section>
  );
}
