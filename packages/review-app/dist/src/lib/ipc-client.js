export const ipcClient = {
    listRepositories: () => window.reviewWorkbenchApi.listRepositories(),
    listBranches: (repositoryPath) => window.reviewWorkbenchApi.listBranches(repositoryPath),
    createSession: (input) => window.reviewWorkbenchApi.createSession(input),
    getSession: (sessionId) => window.reviewWorkbenchApi.getSession(sessionId),
    listSessions: () => window.reviewWorkbenchApi.listSessions(),
    subscribeSession: (sessionId, onEvent) => window.reviewWorkbenchApi.subscribeSession(sessionId, onEvent)
};
