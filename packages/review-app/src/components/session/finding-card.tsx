import type { ReviewFinding } from "@/lib/review-model";
import { findingStatusLabel, severityLabel } from "@/lib/review-copy";
import { severityTone } from "@/lib/severity";

type FindingCardProps = {
  finding: ReviewFinding;
  active: boolean;
  onSelect(id: string): void;
};

export function FindingCard({ finding, active, onSelect }: FindingCardProps) {
  const lineLabel =
    finding.status === "file-level"
      ? findingStatusLabel["file-level"]
      : `第 ${finding.startLine ?? "?"}${finding.endLine && finding.endLine !== finding.startLine ? `-${finding.endLine}` : ""} 行`;

  return (
    <button
      type="button"
      className={`grid gap-3 rounded-[22px] border px-4 py-4 text-left transition ${severityTone[finding.severity]} ${
        active
          ? "border-[rgb(var(--accent-border))] bg-[rgb(var(--accent-surface))] shadow-[inset_0_1px_0_rgba(255,255,255,0.65),0_12px_28px_rgba(184,112,75,0.08)]"
          : "hover:-translate-y-0.5 hover:border-[rgb(var(--border-strong))] hover:shadow-[0_14px_32px_rgba(29,31,35,0.05)]"
      }`}
      onClick={() => onSelect(finding.id)}
    >
      <div className="flex items-center justify-between gap-3 text-[11px] font-semibold uppercase tracking-[0.18em]">
        <span>{severityLabel[finding.severity]}</span>
        <span>{finding.category}</span>
      </div>
      <div className="text-sm font-semibold normal-case tracking-normal text-[rgb(var(--ink))]">{finding.summary}</div>
      <div className="grid gap-1 text-sm normal-case tracking-normal text-[rgb(var(--muted-strong))]">
        <div className="truncate">{finding.file}</div>
        <div className="text-xs uppercase tracking-[0.14em] text-[rgb(var(--muted))]">{lineLabel}</div>
      </div>
      <div className="text-sm leading-6 normal-case tracking-normal text-[rgb(var(--muted-strong))]">
        {finding.evidence ?? finding.suggestion ?? finding.explanation}
      </div>
    </button>
  );
}
