/**
 * 模块职责：承载本模块的稳定业务逻辑，并对外提供边界清晰的类型或函数。
 * 边界约束：输入数据应在边界处校验；不要在本模块内绕过既定的分层和 IPC 约束。
 * 维护提示：修改时优先保持现有契约和错误语义，并同步更新相关测试。
 */
import { create } from 'zustand';
import type { SessionSummary } from '@/lib/review-model';
import { ipcClient } from '@/lib/ipc-client';

type SessionHistoryStore = {
  sessions: SessionSummary[];
  isLoading: boolean;
  error: string | null;

  fetchSessions(): Promise<void>;
  deleteSession(sessionId: string): Promise<void>;
  exportSession(sessionId: string): Promise<void>;
  clearError(): void;
};

export const useSessionHistoryStore = create<SessionHistoryStore>((set, get) => ({
  sessions: [],
  isLoading: false,
  error: null,

  fetchSessions: async () => {
    set({ isLoading: true, error: null });
    try {
      const sessions = await ipcClient.listSessions();
      set({ sessions, isLoading: false });
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
      set({ error: '加载历史记录失败', isLoading: false });
    }
  },

  deleteSession: async (sessionId: string) => {
    try {
      await ipcClient.deleteSession(sessionId);
      const sessions = get().sessions.filter(s => s.sessionId !== sessionId);
      set({ sessions });
    } catch (error) {
      console.error('Failed to delete session:', error);
      set({ error: '删除会话失败' });
    }
  },

  exportSession: async (sessionId: string) => {
    try {
      const { markdown, filename } = await ipcClient.exportSession(sessionId);
      const blob = new Blob([markdown], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export session:', error);
      set({ error: '导出会话报告失败' });
    }
  },

  clearError: () => set({ error: null })
}));
