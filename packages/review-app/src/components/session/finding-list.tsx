import type { ReviewFinding } from "@/lib/review-model";
import { FindingCard } from "./finding-card";

type FindingListProps = {
  findings: ReviewFinding[];
  selectedFindingId: string | null;
  onSelect(id: string): void;
};

export function FindingList({ findings, selectedFindingId, onSelect }: FindingListProps) {
  return (
    <section className="grid gap-3">
      {findings.map((finding) => (
        <FindingCard
          key={finding.id}
          finding={finding}
          active={selectedFindingId === finding.id}
          onSelect={onSelect}
        />
      ))}
    </section>
  );
}
