const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("reviewWorkbenchApi", {
  listRepositories: () => ipcRenderer.invoke("review:listRepositories"),
  selectRepository: () => ipcRenderer.invoke("review:selectRepository"),
  listBranches: (repositoryPath: string) =>
    ipcRenderer.invoke("review:listBranches", repositoryPath),
  createSession: (input: unknown) => ipcRenderer.invoke("review:createSession", input),
  getSession: (sessionId: string) => ipcRenderer.invoke("review:getSession", sessionId),
  listSessions: () => ipcRenderer.invoke("review:listSessions"),
  deleteSession: (sessionId: string) => ipcRenderer.invoke("review:deleteSession", sessionId),
  cancelSession: (sessionId: string) => ipcRenderer.invoke("review:cancelSession", sessionId),
  exportSession: (sessionId: string) => ipcRenderer.invoke("review:exportSession", sessionId),
  subscribeSession: (sessionId: string, onEvent: (event: unknown) => void) => {
    const channel = `review:session:${sessionId}`;
    const listener = (_event: unknown, payload: unknown) => onEvent(payload);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  }
});
