/**
 * 模块职责：连接 Electron 主进程、IPC 和 renderer，负责桌面生命周期与权限边界。
 * 边界约束：IPC 入参先校验，再调用 backend application；不要把主进程能力直接暴露给页面。
 * 维护提示：修改时优先保持现有契约和错误语义，并同步更新相关测试。
 */
import { app, BrowserWindow, dialog, ipcMain } from "electron";
import { join } from "node:path";
import {
  getReviewSession,
  listReviewSessions,
  streamReviewSession
} from "@app/review-engine";
import {
  FileSessionStore,
  GitClient,
  OpenAiCompatibleProvider,
  resolveSessionsRoot,
  configureLogging
} from "@app/review-infrastructure";
import { createReviewWorkbenchHandlers } from "./ipc/review-workbench-handlers.js";
import { loadDotEnv } from "./environment.js";
import { getRendererFilePath } from "./paths.js";
import { resolveOpenAiProviderCapabilities, resolveOpenAiProviderConfig } from "./provider-config.js";
import { getPreloadFilename } from "./runtime-config.js";

loadDotEnv();

function createProvider() {
  const config = resolveOpenAiProviderConfig();
  return new OpenAiCompatibleProvider({
    id: "default",
    ...config,
    capabilities: resolveOpenAiProviderCapabilities()
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
          mode: "hybrid",
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

app.whenReady().then(async () => {
  configureLogging({ directory: app.getPath("logs") });
  await createWindow();
});
