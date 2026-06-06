export function DiffEmptyState() {
  return (
    <div className="grid h-full place-items-center rounded-[28px] border border-dashed border-[rgb(var(--border))] bg-[rgb(var(--panel))] p-8">
      <div className="grid max-w-md gap-3 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[rgb(var(--muted))]">Evidence Desk</p>
        <h2 className="text-xl font-semibold text-[rgb(var(--ink))]">从左侧选择一条问题，开始核查证据</h2>
        <p className="text-sm leading-6 text-[rgb(var(--muted-strong))]">
          这里会展示当前问题的上下文、证据摘要与对应差异片段，帮助你快速完成验证。
        </p>
      </div>
    </div>
  );
}
