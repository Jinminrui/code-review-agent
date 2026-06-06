import type { ReviewFinding } from "@/lib/review-model";
type FindingListProps = {
    findings: ReviewFinding[];
    selectedFindingId: string | null;
    onSelect(id: string): void;
};
export declare function FindingList({ findings, selectedFindingId, onSelect }: FindingListProps): import("react").JSX.Element;
export {};
