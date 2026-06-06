import { create } from "zustand";
export const useReviewSessionStore = create((set) => ({
    session: null,
    selectedFindingId: null,
    setSession: (session) => set({ session }),
    setSelectedFinding: (selectedFindingId) => set({ selectedFindingId })
}));
