import { create } from "zustand";

type WorkbenchUiStore = {
  sidebarWidth: number;
  setSidebarWidth(width: number): void;
};

export const useWorkbenchUiStore = create<WorkbenchUiStore>((set) => ({
  sidebarWidth: 360,
  setSidebarWidth: (sidebarWidth) => set({ sidebarWidth })
}));
