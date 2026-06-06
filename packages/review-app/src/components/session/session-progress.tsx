import { sessionStatusLabel } from "@/lib/review-copy";

type SessionProgressProps = {
  status: "idle" | "running" | "partial" | "finished" | "failed";
};

export function SessionProgress({ status }: SessionProgressProps) {
  const tone =
    status === "failed"
      ? "bg-red-100 text-red-700"
      : status === "finished"
        ? "bg-emerald-100 text-emerald-700"
        : "bg-[rgb(var(--accent-soft))] text-[rgb(var(--accent-ink))]";
  const label = sessionStatusLabel[status];

  return (
    <section className="rounded-[24px] border border-[rgb(var(--border))] bg-[rgb(var(--panel-elevated))] px-4 py-3">
      <div className="flex items-center justify-between gap-4">
        <div className="grid gap-1">
          <div className="text-[11px] font-medium uppercase tracking-[0.3em] text-[rgb(var(--muted))]">
            Review Status
          </div>
          <div className="text-sm text-[rgb(var(--muted-strong))]">当前状态：{label}</div>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${tone}`}>
          {label}
        </span>
      </div>
    </section>
  );
}
