import type { App } from "electron";
import { join } from "node:path";

/**
 * Returns the renderer entry URL/path.
 * - Dev mode: returns the Vite dev server URL
 * - Production (packaged): returns file:// URL to the bundled renderer HTML
 */
export function getRendererEntryPath(app: App): string {
  if (app.isPackaged) {
    return `file://${join(app.getAppPath(), "renderer", "index.html")}`;
  }

  return "http://127.0.0.1:5173";
}

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
