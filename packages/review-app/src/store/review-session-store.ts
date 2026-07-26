/**
 * 模块职责：承载本模块的稳定业务逻辑，并对外提供边界清晰的类型或函数。
 * 边界约束：输入数据应在边界处校验；不要在本模块内绕过既定的分层和 IPC 约束。
 * 维护提示：修改时优先保持现有契约和错误语义，并同步更新相关测试。
 */
import { create } from "zustand";
import type { ReviewFinding, ReviewSessionDetail } from "@/lib/review-model";

type ReviewSessionStore = {
  session: ReviewSessionDetail | null;
  selectedFindingId: string | null;
  error: string | null;
  setSession(session: ReviewSessionDetail | null): void;
  setSelectedFinding(id: string | null): void;
  setError(error: string | null): void;
  appendUnitResult(findings: ReviewFinding[], diffByFile?: ReviewSessionDetail["diffByFile"]): void;
  updateSessionStatus(status: ReviewSessionDetail["status"]): void;
};

export const useReviewSessionStore = create<ReviewSessionStore>((set) => ({
  session: null,
  selectedFindingId: null,
  error: null,
  setSession: (session) => set({ session }),
  setSelectedFinding: (selectedFindingId) => set({ selectedFindingId }),
  setError: (error) => set({ error }),
  appendUnitResult: (findings, diffByFile = {}) =>
    set((state) => {
      // 流式事件只追加当前单元结果，并合并对应文件 diff，避免覆盖已完成单元。
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
