/**
 * 模块职责：连接 Electron 主进程、IPC 和 renderer，负责桌面生命周期与权限边界。
 * 边界约束：IPC 入参先校验，再调用 backend application；不要把主进程能力直接暴露给页面。
 * 维护提示：修改时优先保持现有契约和错误语义，并同步更新相关测试。
 */
import type { App } from "electron";
import { join } from "node:path";

/**
 * Returns the renderer entry suitable for Electron's loadFile/loadURL APIs.
 * - Dev mode: returns the Vite dev server URL (for loadURL)
 * - Production (packaged): returns plain file path (for loadFile)
 */
export function getRendererFilePath(app: App): string {
  if (app.isPackaged) {
    return join(app.getAppPath(), "renderer", "index.html");
  }

  return "http://127.0.0.1:5173";
}
