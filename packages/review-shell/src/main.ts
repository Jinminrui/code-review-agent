import { app, BrowserWindow, ipcMain } from "electron";
import { join } from "node:path";
import {
  FileSessionStore,
  GitClient,
  OpenAiCompatibleProvider,
  getReviewSession,
  listReviewSessions,
  resolveSessionsRoot,
  streamReviewSession
} from "@app/review-backend";
import { createReviewWorkbenchHandlers } from "./ipc/review-workbench-handlers.js";
import { getRendererFilePath } from "./paths.js";
import { getPreloadFilename } from "./runtime-config.js";

function createProvider() {
  return new OpenAiCompatibleProvider({
    id: "default",
    baseUrl: process.env.OPENAI_BASE_URL ?? "https://token-plan-cn.xiaomimimo.com/v1",
    apiKey: process.env.OPENAI_API_KEY ?? "tp-ci5mnu4qjlucxx7c5wy92pc5m1934clxyc7j65buukig1leh",
    model: process.env.OPENAI_MODEL ?? "mimo-v2.5-pro"
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
      listBranches: async (repositoryPath: string) => new GitClient(repositoryPath).listBranches(),
      createSession: async (request) => {
        const gitClient = new GitClient(request.repositoryPath);
        const provider = createProvider();
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
      getSession: async (sessionId: string) => getReviewSession({ sessionId, sessionStore }),
      listSessions: async () => listReviewSessions({ sessionStore }),
      deleteSession: async (sessionId: string) => sessionStore.deleteSession(sessionId),
      exportSessionToMarkdown: async (sessionId: string) =>
        sessionStore.exportSessionToMarkdown(sessionId)
    }
  });

  ipcMain.handle("review:listRepositories", handlers.listRepositories);
  ipcMain.handle("review:listBranches", (_event, repositoryPath: string) =>
    handlers.listBranches(repositoryPath)
  );
  ipcMain.handle("review:createSession", (_event, request: unknown) =>
    handlers.createSession(request)
  );
  ipcMain.handle("review:getSession", (_event, sessionId: string) =>
    handlers.getSession(sessionId)
  );
  ipcMain.handle("review:listSessions", handlers.listSessions);
  ipcMain.handle("review:deleteSession", (_event, sessionId: string) =>
    handlers.deleteSession(sessionId)
  );
  ipcMain.handle("review:exportSession", (_event, sessionId: string) =>
    handlers.exportSession(sessionId)
  );

  const rendererEntry = getRendererFilePath(app);
  if (app.isPackaged) {
    await window.loadFile(rendererEntry);
  } else {
    await window.loadURL(rendererEntry);
  }
}

// Explicitly set userData path (matches Electron default) for clarity and future customization
app.setPath("userData", join(app.getPath("appData"), app.getName()));

app.whenReady().then(createWindow);
