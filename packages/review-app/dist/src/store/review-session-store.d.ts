import type { ReviewSessionDetail } from "@/lib/review-model";
type ReviewSessionStore = {
    session: ReviewSessionDetail | null;
    selectedFindingId: string | null;
    setSession(session: ReviewSessionDetail | null): void;
    setSelectedFinding(id: string | null): void;
};
export declare const useReviewSessionStore: import("zustand").UseBoundStore<import("zustand").StoreApi<ReviewSessionStore>>;
export {};
