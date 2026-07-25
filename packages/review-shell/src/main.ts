import { app, BrowserWindow, dialog, ipcMain } from "electron";
import { join } from "node:path";
import {
  getReviewSession,
  listReviewSessions,
  streamReviewSession
} from "@app/review-backend";
import {
  FileSessionStore,
  GitClient,
  OpenAiCompatibleProvider,
  resolveSessionsRoot
} from "@app/review-backend/infrastructure";
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
  // 运行中的 AbortController 按 sessionId 保存，取消操作只影响对应会话。
  const runningSessions = new Map<string, AbortController>();

  const handlers = createReviewWorkbenchHandlers({
    backend: {
      listRepositories: async () => [process.cwd()],
      selectRepository: async () => {
        const result = await dialog.showOpenDialog(window, {
          title: "选择本地 Git 仓库",
          properties: ["openDirectory"]
        });

        if (result.canceled || !result.filePaths[0]) {
          return null;
        }

        return result.filePaths[0];
      },
      listBranches: async (repositoryPath: string) => new GitClient(repositoryPath).listBranches(),
      createSession: async (request) => {
        // 先消费 session-started 拿到 ID，再后台继续消费异步事件，IPC 调用可以快速返回。
        const gitClient = new GitClient(request.repositoryPath);
        const provider = createProvider();
        const abortController = new AbortController();
        const iterator = streamReviewSession({
          input: request,
          signal: abortController.signal,
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

        runningSessions.set(first.value.sessionId, abortController);

        void (async () => {
          try {
            // first.value 是 session-started 事件，需要单独发送一次。
            // iterator.next() 已经消费了它，for await 循环只会从第二个事件开始迭代，
            // 因此必须在此处显式发送，否则前端会丢失该事件。
            BrowserWindow.getAllWindows().forEach((nextWindow) => {
              nextWindow.webContents.send(`review:session:${first.value.sessionId}`, first.value);
            });

            for await (const event of iterator) {
              BrowserWindow.getAllWindows().forEach((nextWindow) => {
                nextWindow.webContents.send(`review:session:${first.value.sessionId}`, event);
              });
            }
          } finally {
            runningSessions.delete(first.value.sessionId);
          }
        })();

        return { sessionId: first.value.sessionId };
      },
      getSession: async (sessionId: string) => getReviewSession({ sessionId, sessionStore }),
      listSessions: async () => listReviewSessions({ sessionStore }),
      deleteSession: async (sessionId: string) => sessionStore.deleteSession(sessionId),
      cancelSession: async (sessionId: string) => {
        runningSessions.get(sessionId)?.abort();
      },
      exportSessionToMarkdown: async (sessionId: string) =>
        sessionStore.exportSessionToMarkdown(sessionId)
    }
  });

  ipcMain.handle("review:listRepositories", handlers.listRepositories);
  ipcMain.handle("review:selectRepository", handlers.selectRepository);
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
  ipcMain.handle("review:cancelSession", (_event, sessionId: string) =>
    handlers.cancelSession(sessionId)
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
