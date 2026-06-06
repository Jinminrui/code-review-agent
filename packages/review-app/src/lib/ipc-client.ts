import type { ReviewSessionDetail } from "./review-model";

export type CreateSessionInput = {
  repositoryPath: string;
  baseRef: string;
  targetRef: string;
  providerProfileId: string;
};

export type ReviewWorkbenchApi = {
  listRepositories(): Promise<string[]>;
  listBranches(repositoryPath: string): Promise<string[]>;
  createSession(input: CreateSessionInput): Promise<{ sessionId: string }>;
  getSession(sessionId: string): Promise<ReviewSessionDetail>;
  listSessions(): Promise<ReviewSessionDetail[]>;
  subscribeSession(sessionId: string, onEvent: (event: unknown) => void): () => void;
};

declare global {
  interface Window {
    reviewWorkbenchApi: ReviewWorkbenchApi;
  }
}

export const ipcClient = {
  listRepositories: () => window.reviewWorkbenchApi.listRepositories(),
  listBranches: (repositoryPath: string) => window.reviewWorkbenchApi.listBranches(repositoryPath),
  createSession: (input: CreateSessionInput) => window.reviewWorkbenchApi.createSession(input),
  getSession: (sessionId: string) => window.reviewWorkbenchApi.getSession(sessionId),
  listSessions: () => window.reviewWorkbenchApi.listSessions(),
  subscribeSession: (sessionId: string, onEvent: (event: unknown) => void) =>
    window.reviewWorkbenchApi.subscribeSession(sessionId, onEvent)
};
