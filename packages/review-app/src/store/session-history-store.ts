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
