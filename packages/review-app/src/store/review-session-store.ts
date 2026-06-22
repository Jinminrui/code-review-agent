import { create } from "zustand";
import type { ReviewFinding, ReviewSessionDetail } from "@/lib/review-model";

type ReviewSessionStore = {
  session: ReviewSessionDetail | null;
  selectedFindingId: string | null;
  error: string | null;
  setSession(session: ReviewSessionDetail | null): void;
  setSelectedFinding(id: string | null): void;
  setError(error: string | null): void;
  addFindings(findings: ReviewFinding[], diffByFile?: ReviewSessionDetail["diffByFile"]): void;
  updateSessionStatus(status: ReviewSessionDetail["status"]): void;
};

export const useReviewSessionStore = create<ReviewSessionStore>((set) => ({
  session: null,
  selectedFindingId: null,
  error: null,
  setSession: (session) => set({ session }),
  setSelectedFinding: (selectedFindingId) => set({ selectedFindingId }),
  setError: (error) => set({ error }),
  addFindings: (findings, diffByFile = {}) =>
    set((state) => {
      if (!state.session) return state;
      return {
        session: {
          ...state.session,
          findings: [...state.session.findings, ...findings],
          diffByFile: {
            ...state.session.diffByFile,
            ...diffByFile
          },
          summary: {
            ...state.session.summary,
            findingsCount: state.session.summary.findingsCount + findings.length,
            highSeverityCount:
              state.session.summary.highSeverityCount +
              findings.filter((f) => f.severity === "high").length
          }
        }
      };
    }),
  updateSessionStatus: (status) =>
    set((state) => {
      if (!state.session) return state;
      return { session: { ...state.session, status } };
    })
}));
