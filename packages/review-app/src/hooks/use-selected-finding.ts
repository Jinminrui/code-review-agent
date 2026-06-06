import { useReviewSessionStore } from "@/store/review-session-store";

export function useSelectedFinding() {
  return useReviewSessionStore((state) => {
    if (!state.session || !state.selectedFindingId) {
      return null;
    }

    return state.session.findings.find((finding) => finding.id === state.selectedFindingId) ?? null;
  });
}
