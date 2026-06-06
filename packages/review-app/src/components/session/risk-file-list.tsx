type RiskFileListProps = {
  files: string[];
};

export function RiskFileList({ files }: RiskFileListProps) {
  return (
    <section className="grid gap-3 rounded-[28px] border border-[rgb(var(--border))] bg-[rgb(var(--panel))] p-4">
      <div className="text-xs font-semibold uppercase tracking-[0.24em] text-[rgb(var(--muted))]">Risk Files</div>
      <div className="grid gap-2">
        {files.map((file) => (
          <div
            key={file}
            className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-3 py-2 text-sm text-[rgb(var(--ink))]"
          >
            {file}
          </div>
        ))}
      </div>
    </section>
  );
}
