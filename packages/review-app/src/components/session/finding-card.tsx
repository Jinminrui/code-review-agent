import type { ReviewFinding } from "@/lib/review-model";
import { severityTone } from "@/lib/severity";

type FindingCardProps = {
  finding: ReviewFinding;
  active: boolean;
  onSelect(id: string): void;
};

export function FindingCard({ finding, active, onSelect }: FindingCardProps) {
  return (
    <button
      type="button"
      className={`grid gap-2 rounded-[26px] border p-4 text-left transition ${severityTone[finding.severity]} ${
        active ? "ring-2 ring-[rgb(var(--accent))]" : ""
      }`}
      onClick={() => onSelect(finding.id)}
    >
      <div className="flex items-center justify-between gap-3 text-[11px] font-semibold uppercase tracking-[0.18em]">
        <span>{finding.severity}</span>
        <span className="truncate">{finding.file}</span>
      </div>
      <div className="text-sm font-semibold normal-case tracking-normal">{finding.summary}</div>
      <div className="text-sm leading-6 opacity-80 normal-case tracking-normal">{finding.explanation}</div>
    </button>
  );
}
