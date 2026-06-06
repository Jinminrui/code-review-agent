import { createReviewSessionRequestSchema } from "@app/review-backend";
export function createReviewWorkbenchHandlers(input) {
    return {
        listRepositories: () => input.backend.listRepositories(),
        listBranches: (repositoryPath) => input.backend.listBranches(repositoryPath),
        createSession: (request) => input.backend.createSession(createReviewSessionRequestSchema.parse(request)),
        getSession: (sessionId) => input.backend.getSession(sessionId),
        listSessions: () => input.backend.listSessions()
    };
}
