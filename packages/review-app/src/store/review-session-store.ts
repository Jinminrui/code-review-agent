import { create } from "zustand";
import type { ReviewSessionDetail } from "@/lib/review-model";

type ReviewSessionStore = {
  session: ReviewSessionDetail | null;
  selectedFindingId: string | null;
  setSession(session: ReviewSessionDetail | null): void;
  setSelectedFinding(id: string | null): void;
};

export const useReviewSessionStore = create<ReviewSessionStore>((set) => ({
  session: null,
  selectedFindingId: null,
  setSession: (session) => set({ session }),
  setSelectedFinding: (selectedFindingId) => set({ selectedFindingId })
}));
