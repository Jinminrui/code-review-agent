type ReviewSummaryPanelProps = {
  changedFilesCount: number;
  findingsCount: number;
  highSeverityCount: number;
};

export function ReviewSummaryPanel({
  changedFilesCount,
  findingsCount,
  highSeverityCount
}: ReviewSummaryPanelProps) {
  return (
    <section className="grid gap-3 rounded-[28px] border border-[rgb(var(--border))] bg-[rgb(var(--panel))] p-4">
      <div className="text-xs font-semibold uppercase tracking-[0.24em] text-[rgb(var(--muted))]">Summary</div>
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl bg-stone-100 p-3 text-sm text-[rgb(var(--ink))]">变更文件 {changedFilesCount}</div>
        <div className="rounded-2xl bg-stone-100 p-3 text-sm text-[rgb(var(--ink))]">问题总数 {findingsCount}</div>
        <div className="rounded-2xl bg-stone-100 p-3 text-sm text-[rgb(var(--ink))]">高风险 {highSeverityCount}</div>
      </div>
    </section>
  );
}
