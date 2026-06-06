type WorkbenchUiStore = {
    sidebarWidth: number;
    setSidebarWidth(width: number): void;
};
export declare const useWorkbenchUiStore: import("zustand").UseBoundStore<import("zustand").StoreApi<WorkbenchUiStore>>;
export {};
