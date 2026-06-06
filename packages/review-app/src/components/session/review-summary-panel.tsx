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
    <section className="grid gap-4 rounded-[28px] border border-[rgb(var(--border))] bg-[rgb(var(--panel-elevated))] p-5">
      <div className="grid gap-2">
        <div className="text-[11px] font-medium uppercase tracking-[0.3em] text-[rgb(var(--muted))]">Code Review 摘要</div>
        <p className="text-[14px] leading-6 text-[rgb(var(--ink))]">
          本次改动聚焦于 Code Review 会话与差异验证链路，建议优先核查高风险问题。
        </p>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-[22px] border border-[rgb(var(--border-subtle))] bg-[rgb(var(--panel-muted))] p-3 text-sm text-[rgb(var(--ink))]">
          变更文件 {changedFilesCount}
        </div>
        <div className="rounded-[22px] border border-[rgb(var(--border-subtle))] bg-[rgb(var(--panel-muted))] p-3 text-sm text-[rgb(var(--ink))]">
          问题总数 {findingsCount}
        </div>
        <div className="rounded-[22px] border border-[rgb(var(--border-subtle))] bg-[rgb(var(--panel-muted))] p-3 text-sm text-[rgb(var(--ink))]">
          高风险 {highSeverityCount}
        </div>
      </div>
    </section>
  );
}
