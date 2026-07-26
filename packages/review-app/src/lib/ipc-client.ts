/**
 * 模块职责：承载本模块的稳定业务逻辑，并对外提供边界清晰的类型或函数。
 * 边界约束：输入数据应在边界处校验；不要在本模块内绕过既定的分层和 IPC 约束。
 * 维护提示：修改时优先保持现有契约和错误语义，并同步更新相关测试。
 */
import type { ReviewSessionEvent } from "@app/review-backend/contracts";
import type { ReviewSessionDetail, SessionSummary } from "./review-model";

export type CreateSessionInput = {
  repositoryPath: string;
  baseRef: string;
  targetRef: string;
};

export type ReviewWorkbenchApi = {
  listRepositories(): Promise<string[]>;
  selectRepository(): Promise<string | null>;
  listBranches(repositoryPath: string): Promise<string[]>;
  createSession(input: CreateSessionInput): Promise<{ sessionId: string }>;
  getSession(sessionId: string): Promise<ReviewSessionDetail>;
  listSessions(): Promise<SessionSummary[]>;
  deleteSession(sessionId: string): Promise<void>;
  cancelSession(sessionId: string): Promise<void>;
  exportSession(sessionId: string): Promise<{ markdown: string; filename: string }>;
  subscribeSession(sessionId: string, onEvent: (event: ReviewSessionEvent) => void): () => void;
};

declare global {
  interface Window {
    reviewWorkbenchApi: ReviewWorkbenchApi;
  }
}

// renderer 只依赖这一层，不直接接触 Electron ipcRenderer，便于测试和替换 mock API。
export const ipcClient = {
  listRepositories: () => window.reviewWorkbenchApi.listRepositories(),
  selectRepository: () => window.reviewWorkbenchApi.selectRepository(),
  listBranches: (repositoryPath: string) => window.reviewWorkbenchApi.listBranches(repositoryPath),
  createSession: (input: CreateSessionInput) => window.reviewWorkbenchApi.createSession(input),
  getSession: (sessionId: string) => window.reviewWorkbenchApi.getSession(sessionId),
  listSessions: () => window.reviewWorkbenchApi.listSessions(),
  deleteSession: (sessionId: string) => window.reviewWorkbenchApi.deleteSession(sessionId),
  cancelSession: (sessionId: string) => window.reviewWorkbenchApi.cancelSession(sessionId),
  exportSession: (sessionId: string) => window.reviewWorkbenchApi.exportSession(sessionId),
  subscribeSession: (sessionId: string, onEvent: (event: ReviewSessionEvent) => void) =>
    window.reviewWorkbenchApi.subscribeSession(sessionId, onEvent)
};
