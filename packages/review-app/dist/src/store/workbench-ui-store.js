import { create } from "zustand";
export const useWorkbenchUiStore = create((set) => ({
    sidebarWidth: 360,
    setSidebarWidth: (sidebarWidth) => set({ sidebarWidth })
}));
