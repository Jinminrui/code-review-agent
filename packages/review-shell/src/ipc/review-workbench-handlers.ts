import type { CreateReviewSessionRequest } from "@app/review-backend";
import { createReviewSessionRequestSchema } from "@app/review-backend";

type ReviewWorkbenchBackend = {
  listRepositories(): Promise<string[]>;
  selectRepository(): Promise<string | null>;
  listBranches(repositoryPath: string): Promise<string[]>;
  createSession(request: CreateReviewSessionRequest): Promise<{ sessionId: string }>;
  getSession(sessionId: string): Promise<unknown>;
  listSessions(): Promise<unknown[]>;
  deleteSession(sessionId: string): Promise<void>;
  exportSessionToMarkdown(sessionId: string): Promise<string>;
};

export function createReviewWorkbenchHandlers(input: {
  backend: ReviewWorkbenchBackend;
}) {
  return {
    listRepositories: () => input.backend.listRepositories(),
    selectRepository: () => input.backend.selectRepository(),
    listBranches: (repositoryPath: string) => input.backend.listBranches(repositoryPath),
    createSession: (request: unknown) =>
      input.backend.createSession(createReviewSessionRequestSchema.parse(request)),
    getSession: (sessionId: string) => input.backend.getSession(sessionId),
    listSessions: () => input.backend.listSessions(),
    deleteSession: (sessionId: string) => input.backend.deleteSession(sessionId),
    exportSession: async (sessionId: string) => {
      const markdown = await input.backend.exportSessionToMarkdown(sessionId);
      return {
        markdown,
        filename: `review-${sessionId}.md`
      };
    }
  };
}
