import type { ReviewSessionDetail, ReviewSessionEvent, SessionSummary } from "./review-model";

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
  exportSession(sessionId: string): Promise<{ markdown: string; filename: string }>;
  subscribeSession(sessionId: string, onEvent: (event: ReviewSessionEvent) => void): () => void;
};

declare global {
  interface Window {
    reviewWorkbenchApi: ReviewWorkbenchApi;
  }
}

export const ipcClient = {
  listRepositories: () => window.reviewWorkbenchApi.listRepositories(),
  selectRepository: () => window.reviewWorkbenchApi.selectRepository(),
  listBranches: (repositoryPath: string) => window.reviewWorkbenchApi.listBranches(repositoryPath),
  createSession: (input: CreateSessionInput) => window.reviewWorkbenchApi.createSession(input),
  getSession: (sessionId: string) => window.reviewWorkbenchApi.getSession(sessionId),
  listSessions: () => window.reviewWorkbenchApi.listSessions(),
  deleteSession: (sessionId: string) => window.reviewWorkbenchApi.deleteSession(sessionId),
  exportSession: (sessionId: string) => window.reviewWorkbenchApi.exportSession(sessionId),
  subscribeSession: (sessionId: string, onEvent: (event: ReviewSessionEvent) => void) =>
    window.reviewWorkbenchApi.subscribeSession(sessionId, onEvent)
};
