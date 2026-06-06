import { contextBridge, ipcRenderer } from "electron";
contextBridge.exposeInMainWorld("reviewWorkbenchApi", {
    listRepositories: () => ipcRenderer.invoke("review:listRepositories"),
    listBranches: (repositoryPath) => ipcRenderer.invoke("review:listBranches", repositoryPath),
    createSession: (input) => ipcRenderer.invoke("review:createSession", input),
    getSession: (sessionId) => ipcRenderer.invoke("review:getSession", sessionId),
    listSessions: () => ipcRenderer.invoke("review:listSessions"),
    subscribeSession: (sessionId, onEvent) => {
        const channel = `review:session:${sessionId}`;
        const listener = (_event, payload) => onEvent(payload);
        ipcRenderer.on(channel, listener);
        return () => ipcRenderer.removeListener(channel, listener);
    }
});
