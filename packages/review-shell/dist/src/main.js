import { app, BrowserWindow, ipcMain } from "electron";
import { join } from "node:path";
import { FileSessionStore, GitClient, OpenAiCompatibleProvider, getReviewSession, listReviewSessions, resolveSessionsRoot, streamReviewSession } from "@app/review-backend";
import { createReviewWorkbenchHandlers } from "./ipc/review-workbench-handlers.js";
import { getPreloadFilename, getRendererUrl } from "./runtime-config.js";
function createProvider(providerProfileId) {
    return new OpenAiCompatibleProvider({
        id: providerProfileId,
        baseUrl: process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
        apiKey: process.env.OPENAI_API_KEY ?? "",
        model: process.env.OPENAI_MODEL ?? "gpt-5"
    });
}
async function createWindow() {
    const window = new BrowserWindow({
        width: 1440,
        height: 960,
        webPreferences: {
            preload: join(import.meta.dirname, getPreloadFilename()),
            contextIsolation: true,
            nodeIntegration: false
        }
    });
    const sessionStore = new FileSessionStore(resolveSessionsRoot(app.getPath("userData")));
    const handlers = createReviewWorkbenchHandlers({
        backend: {
            listRepositories: async () => [process.cwd()],
            listBranches: async (repositoryPath) => new GitClient(repositoryPath).listBranches(),
            createSession: async (request) => {
                const gitClient = new GitClient(request.repositoryPath);
                const provider = createProvider(request.providerProfileId);
                const iterator = streamReviewSession({
                    input: request,
                    dependencies: {
                        provider,
                        gitClient,
                        sessionStore
                    }
                });
                const first = await iterator.next();
                if (first.done || first.value.type !== "session-started") {
                    throw new Error("review session did not emit session-started");
                }
                void (async () => {
                    for await (const event of iterator) {
                        BrowserWindow.getAllWindows().forEach((nextWindow) => {
                            nextWindow.webContents.send(`review:session:${first.value.sessionId}`, event);
                        });
                    }
                })();
                return { sessionId: first.value.sessionId };
            },
            getSession: async (sessionId) => getReviewSession({ sessionId, sessionStore }),
            listSessions: async () => listReviewSessions({ sessionStore })
        }
    });
    ipcMain.handle("review:listRepositories", handlers.listRepositories);
    ipcMain.handle("review:listBranches", (_event, repositoryPath) => handlers.listBranches(repositoryPath));
    ipcMain.handle("review:createSession", (_event, request) => handlers.createSession(request));
    ipcMain.handle("review:getSession", (_event, sessionId) => handlers.getSession(sessionId));
    ipcMain.handle("review:listSessions", handlers.listSessions);
    await window.loadURL(getRendererUrl(process.env));
}
app.whenReady().then(createWindow);
