import type { CreateReviewSessionRequest } from "@app/review-backend";
import { createReviewSessionRequestSchema } from "@app/review-backend";

type ReviewWorkbenchBackend = {
  listRepositories(): Promise<string[]>;
  listBranches(repositoryPath: string): Promise<string[]>;
  createSession(request: CreateReviewSessionRequest): Promise<{ sessionId: string }>;
  getSession(sessionId: string): Promise<unknown>;
  listSessions(): Promise<unknown[]>;
};

export function createReviewWorkbenchHandlers(input: {
  backend: ReviewWorkbenchBackend;
}) {
  return {
    listRepositories: () => input.backend.listRepositories(),
    listBranches: (repositoryPath: string) => input.backend.listBranches(repositoryPath),
    createSession: (request: unknown) =>
      input.backend.createSession(createReviewSessionRequestSchema.parse(request)),
    getSession: (sessionId: string) => input.backend.getSession(sessionId),
    listSessions: () => input.backend.listSessions()
  };
}
