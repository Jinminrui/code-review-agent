import type { ReviewFinding } from "@/lib/review-model";
import { FindingCard } from "./finding-card";

type FindingListProps = {
  findings: ReviewFinding[];
  selectedFindingId: string | null;
  onSelect(id: string): void;
};

export function FindingList({ findings, selectedFindingId, onSelect }: FindingListProps) {
  return (
    <section className="grid min-h-0 grid-rows-[auto_1fr] gap-3 overflow-hidden">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[rgb(var(--muted))]">
            Review Findings
          </div>
          <div className="text-sm text-[rgb(var(--muted-strong))]">按风险与定位状态组织的问题流</div>
        </div>
        <span className="rounded-full bg-[rgb(var(--panel-muted))] px-2.5 py-1 text-[11px] text-[rgb(var(--muted-strong))]">
          {findings.length} 条
        </span>
      </div>
      <div className="grid gap-3 overflow-auto pr-1">
      {findings.map((finding) => (
        <FindingCard
          key={finding.id}
          finding={finding}
          active={selectedFindingId === finding.id}
          onSelect={onSelect}
        />
      ))}
      </div>
    </section>
  );
}
