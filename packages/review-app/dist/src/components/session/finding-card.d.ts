import type { ReviewFinding } from "@/lib/review-model";
type FindingCardProps = {
    finding: ReviewFinding;
    active: boolean;
    onSelect(id: string): void;
};
export declare function FindingCard({ finding, active, onSelect }: FindingCardProps): import("react").JSX.Element;
export {};
